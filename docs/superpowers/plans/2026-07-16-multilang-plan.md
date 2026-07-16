# 多语言词库集成 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将英语单词学习应用扩展为多语言词汇学习工具，支持日语、韩语、德语等语种，同时修复"读释义"功能不生效的bug

**Architecture:** 重构 DataLoader 为可实例化模式，每种语言独立实例；Store 增加 currentLanguage 状态；TS 根据语言选择发音方式（英语→有道API，其他→Web Speech）；首页UI增加语言Tab切换

**Tech Stack:** React + TypeScript + Zustand + Tailwind CSS + Web Speech API

## Global Constraints

- 英语数据路径保持 `/data/words-{index}.json` 不变，不移动文件
- 词表ID全局唯一，格式为 `{lang}_{tag}` 或兼容现有ID
- 所有语言的 Word 数据格式保持一致（id, word, phonetic, pos, definition, tag, example, exampleTranslation）
- TTS 英语优先走有道API，其他语言走 Web Speech API
- 进度按词表ID存储，不跨语言共享

---

### Task 1: 修复"朗读释义"不生效的bug

**Files:**
- Modify: `src/hooks/useTTS.ts:230-237`
- Modify: `src/utils/storage.ts:46-52`

**Bug分析：**
1. `useAutoPlay` 的 `useEffect` 依赖数组只包含 `isPlaying`, `isLoading`, `currentWord`, `speak`, `nextWord`, `stop`, `resetCancel`，不包含 `settings.readDefinition` 和 `settings.readExample`
2. 用户在 SettingsModal 中切换 `readDefinition` 开关时，由于依赖数组不包含该值，effect 不会重新执行，导致新设置不生效
3. `storage.ts` 中 `getSettings()` 的默认返回值缺少 `readDefinition` 字段，已有 localStorage 数据的用户获取到的 settings 可能没有该字段

**Interfaces:**
- Consumes: `useAppStore.getState().settings` (原有接口)
- Produces: 修复后的 `useAutoPlay` 依赖数组

- [ ] **Step 1: 在 storage.ts 默认值中添加 readDefinition**

```typescript
// src/utils/storage.ts
return {
  speed: 0.5,
  speechRate: 1.0,
  readDefinition: false,    // ← 新增
  readExample: false,
  accent: 'us',
  autoPlay: true,
};
```

- [ ] **Step 2: 在 useAutoPlay 的 useEffect 依赖数组中添加 settings 相关字段**

```typescript
// src/hooks/useTTS.ts
useEffect(() => {
  // ... 现有逻辑
}, [
  isPlaying,
  isLoading,
  currentWord,
  speak,
  nextWord,
  stop,
  resetCancel,
  // 新增依赖：当用户在设置中更改这些开关时，effect 重新执行
  useAppStore.getState().settings.readDefinition,
  useAppStore.getState().settings.readExample,
  useAppStore.getState().settings.speed,
]);
```

- [ ] **Step 3: 验证修复**

```bash
npm run dev
```
手动测试：
1. 进入学习模式，开启自动朗读
2. 打开设置，开启"朗读中文释义"
3. 观察是否在单词发音后朗读中文释义
4. 关闭"朗读中文释义"，观察是否停止朗读释义

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useTTS.ts src/utils/storage.ts
git commit -m "fix: 朗读释义开关不生效（useEffect 缺少依赖项）
- 在 useAutoPlay 的 useEffect 依赖数组中添加 readDefinition/readExample/speed
- 在 storage.ts 默认值中添加 readDefinition 字段
Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: 重构 DataLoader 为多语言实例化

**Files:**
- Create: `src/utils/languageRegistry.ts`
- Modify: `src/utils/dataLoader.ts`
- Modify: `src/config/wordLists.ts`
- Modify: `src/types/word.ts`

**说明：**
DataLoader 从单例改为可实例化，每种语言独立实例。`languageRegistry.ts` 管理语言配置和 DataLoader 实例。

**Interfaces:**
- Consumes: 无
- Produces: `DataLoader` (可实例化类), `DataLoaderConfig`, `getDataLoader(language)`, `LANGUAGE_CONFIGS`, `LANGUAGES`, `TTSConfig`

- [ ] **Step 1: 重构 DataLoader 为可实例化类**

```typescript
// src/utils/dataLoader.ts
import { Word, WordShard, DataLoaderConfig } from '../types/word';

export class DataLoader {
  private config: DataLoaderConfig;
  private cache: Map<number, Word[]> = new Map();
  private loading: Map<number, Promise<Word[]>> = new Map();

  constructor(config: DataLoaderConfig) {
    this.config = config;
  }

  async loadShard(index: number): Promise<Word[]> {
    if (this.cache.has(index)) {
      return this.cache.get(index)!;
    }
    if (this.loading.has(index)) {
      return this.loading.get(index)!;
    }
    const loadPromise = this._fetchShard(index);
    this.loading.set(index, loadPromise);
    return loadPromise;
  }

  private async _fetchShard(index: number): Promise<Word[]> {
    try {
      const { basePath, filePattern } = this.config;
      const filename = filePattern.replace('{index}', String(index).padStart(3, '0'));
      const response = await fetch(`${basePath}${filename}`);
      if (!response.ok) {
        throw new Error(`Failed to load shard ${index} from ${basePath}`);
      }
      const data: WordShard = await response.json();
      this.cache.set(index, data.words);
      this.loading.delete(index);
      return data.words;
    } catch (error) {
      this.loading.delete(index);
      throw error;
    }
  }

  async getWord(globalIndex: number): Promise<Word | null> {
    const { shardSize } = this.config;
    const shardIndex = Math.floor(globalIndex / shardSize) + 1;
    const localIndex = globalIndex % shardSize;

    try {
      const words = await this.loadShard(shardIndex);
      return words[localIndex] || null;
    } catch (error) {
      console.error('Failed to get word:', error);
      return null;
    }
  }

  async preloadAdjacent(currentIndex: number): Promise<void> {
    const { shardSize, totalShards } = this.config;
    const currentShard = Math.floor(currentIndex / shardSize) + 1;

    const toPreload = [
      currentShard - 1,
      currentShard,
      currentShard + 1,
    ].filter(i => i >= 1 && i <= totalShards);

    await Promise.all(toPreload.map(i => this.loadShard(i).catch(() => {})));
  }

  clearCache(): void {
    this.cache.clear();
    this.loading.clear();
  }

  getTotalWords(): number {
    return this.config.shardSize * (this.config.totalShards - 1) + this.config.lastShardSize;
  }
}

// 保留实例以供向后兼容，但标记为废弃
/** @deprecated 使用 languageRegistry.getDataLoader('en') 替代 */
export const dataLoader = new DataLoader({
  basePath: '/data/',
  shardSize: 1000,
  totalShards: 17,
  filePattern: 'words-{index}.json',
  lastShardSize: 194,
});
```

- [ ] **Step 2: 在 types/word.ts 中添加 DataLoaderConfig 类型**

```typescript
// src/types/word.ts 新增
export interface DataLoaderConfig {
  basePath: string;
  shardSize: number;
  totalShards: number;
  filePattern: string;   // 支持 {index} 占位符
  lastShardSize: number; // 最后一个分片的实际单词数
}
```

- [ ] **Step 3: 创建 languageRegistry.ts**

```typescript
// src/utils/languageRegistry.ts
import { DataLoader } from './dataLoader';
import { DataLoaderConfig } from '../types/word';

export const LANGUAGE_CONFIGS: Record<string, DataLoaderConfig> = {
  en: {
    basePath: '/data/',
    shardSize: 1000,
    totalShards: 17,
    filePattern: 'words-{index}.json',
    lastShardSize: 194,
  },
  ja: {
    basePath: '/data/ja/',
    shardSize: 5000,
    totalShards: 4,
    filePattern: 'words-{index}.json',
    lastShardSize: 5000,
  },
  ko: {
    basePath: '/data/ko/',
    shardSize: 5000,
    totalShards: 1,
    filePattern: 'words-{index}.json',
    lastShardSize: 5000,
  },
  de: {
    basePath: '/data/de/',
    shardSize: 5000,
    totalShards: 1,
    filePattern: 'words-{index}.json',
    lastShardSize: 5000,
  },
};

const loaders = new Map<string, DataLoader>();

export function getDataLoader(language: string): DataLoader {
  if (!loaders.has(language)) {
    const config = LANGUAGE_CONFIGS[language];
    if (!config) {
      throw new Error(`Unknown language: ${language}`);
    }
    loaders.set(language, new DataLoader(config));
  }
  return loaders.get(language)!;
}

export function getTotalWords(language: string): number {
  const config = LANGUAGE_CONFIGS[language];
  if (!config) return 0;
  return config.shardSize * (config.totalShards - 1) + config.lastShardSize;
}
```

- [ ] **Step 4: 重构 wordLists.ts 添加语言配置**

```typescript
// src/config/wordLists.ts
export interface TTSConfig {
  mode: 'youdao' | 'webspeech';
  webspeechLang?: string;
  accentOptions: { label: string; value: string }[];
  defaultAccent: string;
}

export interface Language {
  code: string;
  name: string;
  flag: string;
  ttsConfig: TTSConfig;
}

export const LANGUAGES: Language[] = [
  {
    code: 'en', name: '英语', flag: '🇺🇸',
    ttsConfig: {
      mode: 'youdao',
      accentOptions: [{ label: '美式', value: 'us' }, { label: '英式', value: 'uk' }],
      defaultAccent: 'us',
    },
  },
  {
    code: 'ja', name: '日语', flag: '🇯🇵',
    ttsConfig: {
      mode: 'webspeech',
      webspeechLang: 'ja-JP',
      accentOptions: [{ label: '标准', value: 'ja-JP' }],
      defaultAccent: 'ja-JP',
    },
  },
  {
    code: 'ko', name: '韩语', flag: '🇰🇷',
    ttsConfig: {
      mode: 'webspeech',
      webspeechLang: 'ko-KR',
      accentOptions: [{ label: '标准', value: 'ko-KR' }],
      defaultAccent: 'ko-KR',
    },
  },
  {
    code: 'de', name: '德语', flag: '🇩🇪',
    ttsConfig: {
      mode: 'webspeech',
      webspeechLang: 'de-DE',
      accentOptions: [{ label: '标准', value: 'de-DE' }],
      defaultAccent: 'de-DE',
    },
  },
];

export const WORD_LISTS: WordList[] = [
  // English
  { id: 'toefl', name: '托福词汇', tag: 'toefl', language: 'en' },
  { id: 'gre', name: 'GRE词汇', tag: 'gre', language: 'en' },
  { id: 'cet6', name: '六级词汇', tag: 'cet6', language: 'en' },
  { id: 'ky', name: '考研词汇', tag: 'ky', language: 'en' },
  { id: 'ielts', name: '雅思词汇', tag: 'ielts', language: 'en' },
  { id: 'cet4', name: '四级词汇', tag: 'cet4', language: 'en' },
  { id: 'gk', name: '高考词汇', tag: 'gk', language: 'en' },
  { id: 'other', name: '其他词汇', tag: '', language: 'en' },
  { id: 'en_all', name: '全部单词', tag: '*', language: 'en' },
  // Japanese
  { id: 'ja_all', name: '全部单词', tag: '*', language: 'ja' },
  // Korean
  { id: 'ko_all', name: '全部单词', tag: '*', language: 'ko' },
  // German
  { id: 'de_all', name: '全部单词', tag: '*', language: 'de' },
];

export function getListsByLanguage(language: string): WordList[] {
  return WORD_LISTS.filter(list => list.language === language);
}

export function getLanguageInfo(code: string): Language | undefined {
  return LANGUAGES.find(lang => lang.code === code);
}

export function getWordListById(id: string): WordList | undefined {
  return WORD_LISTS.find(list => list.id === id);
}

export function getWordListIds(): string[] {
  return WORD_LISTS.map(list => list.id);
}
```

- [ ] **Step 5: 验证**

```bash
npm run build
```
确保没有 TypeScript 编译错误。

- [ ] **Step 6: Commit**

```bash
git add src/utils/dataLoader.ts src/utils/languageRegistry.ts src/types/word.ts src/config/wordLists.ts
git commit -m "refactor: DataLoader 重构为多语言实例化模式
- DataLoader 改为可实例化类，接收 DataLoaderConfig 配置
- 新增 languageRegistry.ts 管理语言配置和 DataLoader 实例
- wordLists.ts 新增 LANGUAGES 注册表和 getListsByLanguage 辅助函数
- 向后兼容保留 dataLoader 单例引用
Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: 重构 Store 添加多语言支持

**Files:**
- Modify: `src/store/useAppStore.ts`
- Modify: `src/utils/wordListIndex.ts`
- Modify: `src/utils/storage.ts`

**说明：**
Store 增加 `currentLanguage` 状态和 `switchLanguage` action，修改 `initialize` 和 `switchList` 使用语言感知的 DataLoader。

**Interfaces:**
- Consumes: `getDataLoader(language)`, `getTotalWords(language)`, `getListsByLanguage(language)`, `LANGUAGE_CONFIGS`
- Produces: `currentLanguage`, `switchLanguage(lang)`, 改造后的 `initialize`, `switchList`

- [ ] **Step 1: 增加 storage 中 currentLanguage 的存取**

```typescript
// src/utils/storage.ts 新增
const KEY_CURRENT_LANGUAGE = 'vocab_current_language';

export function getCurrentLanguage(): string {
  return localStorage.getItem(KEY_CURRENT_LANGUAGE) || 'en';
}

export function saveCurrentLanguage(language: string): void {
  localStorage.setItem(KEY_CURRENT_LANGUAGE, language);
}
```

- [ ] **Step 2: 改造 wordListIndex.ts 支持按语言构建索引**

```typescript
// src/utils/wordListIndex.ts
import { getDataLoader, getTotalWords } from './languageRegistry';

// wordListIndexCache 改为按语言缓存
let wordListIndexCache: Map<string, Map<string, Set<number>>> = new Map();
let indexBuildPromises: Map<string, Promise<Map<string, Set<number>>>> = new Map();

export async function buildWordListIndex(language: string = 'en'): Promise<Map<string, Set<number>>> {
  if (wordListIndexCache.has(language)) {
    return wordListIndexCache.get(language)!;
  }

  if (indexBuildPromises.has(language)) {
    return indexBuildPromises.get(language)!;
  }

  const buildPromise = (async () => {
    const index = new Map<string, Set<number>>();
    const loader = getDataLoader(language);
    const totalWords = getTotalWords(language);

    for (let globalIndex = 0; globalIndex < totalWords; globalIndex++) {
      try {
        const word = await loader.getWord(globalIndex);
        if (word) {
          const tag = word.tag || '';
          if (tag === '') {
            if (!index.has('')) {
              index.set('', new Set());
            }
            index.get('')!.add(globalIndex);
          } else {
            const tags = tag.split(/\s+/).filter(t => t);
            for (const t of tags) {
              if (!index.has(t)) {
                index.set(t, new Set());
              }
              index.get(t)!.add(globalIndex);
            }
          }
        }
      } catch (err) {
        console.error(`[${language}] Failed to load word at index ${globalIndex}:`, err);
      }
    }

    wordListIndexCache.set(language, index);
    indexBuildPromises.delete(language);
    return index;
  })();

  indexBuildPromises.set(language, buildPromise);
  return buildPromise;
}

export async function getWordIndexesByTag(tag: string, language: string = 'en'): Promise<number[]> {
  const index = await buildWordListIndex(language);
  const indexes = index.get(tag);

  if (!indexes) {
    return [];
  }

  return Array.from(indexes).sort((a, b) => a - b);
}

export async function getWordCountByTag(tag: string, language: string = 'en'): Promise<number> {
  const index = await buildWordListIndex(language);
  const indexes = index.get(tag);
  return indexes ? indexes.size : 0;
}

export function clearWordListIndexCache(language?: string): void {
  if (language) {
    wordListIndexCache.delete(language);
    indexBuildPromises.delete(language);
  } else {
    wordListIndexCache.clear();
    indexBuildPromises.clear();
  }
}
```

- [ ] **Step 3: 改造 useAppStore.ts**

```typescript
// src/store/useAppStore.ts
// 需要的改动：
// 1. 新增字段：currentLanguage, wordIndexTotal
// 2. 新增 action: switchLanguage
// 3. 改造 initialize: 从 storage 恢复语言，使用对应 DataLoader
// 4. 改造 switchList: 根据词表语言获取 DataLoader
// 5. 改造 loadListWord: 使用当前语言的 DataLoader
// 6. totalWords 不再固定为 16194

// 关键改动点（在现有代码基础上修改）：

// 1. 导入增加
// + import { getDataLoader, getTotalWords } from '../utils/languageRegistry';
// + import { getLanguageInfo, LANGUAGES } from '../config/wordLists';

// 2. interface 新增字段
// currentLanguage: string;
// wordIndexTotal: number;

// 3. 初始状态
// language: 'en' → 改为 currentLanguage: getCurrentLanguage()
// wordIndexTotal: getTotalWords(getCurrentLanguage()),

// 4. initialize 方法
// 从 storage 恢复语言，用对应语言的 DataLoader 构建索引

// 5. 新增 switchLanguage action
// switchLanguage: async (lang: string) => {
//   const { listProgress, currentList, currentRound, currentIndex, completedRounds } = get();
//   
//   // 保存当前词表进度
//   const currentProgress: ProgressData = {
//     currentRound, currentIndex, completedRounds,
//     lastUpdate: new Date().toISOString(),
//   };
//   const updatedListProgress = { ...listProgress, [currentList]: currentProgress };
//   
//   // 切换 DataLoader
//   const newTotalWords = getTotalWords(lang);
//   
//   // 查找该语言默认词表
//   const langLists = getListsByLanguage(lang);
//   const defaultListId = lang === 'en' ? 'all' : (langLists.find(l => l.tag === '*')?.id || langLists[0]?.id);
//   
//   // 更新语言配置（切换 accont）
//   const langInfo = getLanguageInfo(lang);
//   const newSettings = { ...get().settings };
//   if (langInfo && langInfo.ttsConfig.defaultAccent) {
//     newSettings.accent = langInfo.ttsConfig.defaultAccent;
//   }
//   
//   // 构建新语言的索引
//   await buildWordListIndex(lang);
//   
//   // 切换状态
//   set({
//     currentLanguage: lang,
//     currentList: defaultListId || 'all',
//     wordIndexesInList: Array.from({ length: newTotalWords }, (_, i) => i),
//     listTotalWords: newTotalWords,
//     wordIndexTotal: newTotalWords,
//     currentRound: 1,
//     currentIndex: 0,
//     completedRounds: 0,
//     listProgress: updatedListProgress,
//     settings: newSettings,
//     isLoading: true,
//   });
//   
//   saveCurrentLanguage(lang);
//   saveCurrentList(defaultListId || 'all');
//   saveListProgress(updatedListProgress);
//   storage.saveSettings(newSettings);
//   
//   await get().loadListWord();
// },

// 6. switchList 改造
// 查找词表时使用 getWordListById，获取 language 字段
// 如果是 en_all / ja_all 等 '*' 词表，使用当前语言的全部索引
// 否则根据 tag 和 language 获取索引（getWordIndexesByTag 传 language）

// 7. loadListWord 改造
// 使用 getDataLoader(get().currentLanguage) 替代旧的 dataLoader
```

由于改动较大，下面给出修改后的完整文件内容：

```typescript
// src/store/useAppStore.ts 完整文件
import { create } from 'zustand';
import { Word, Settings, ProgressData } from '../types/word';
import {
  storage, getCurrentList, getListProgress, saveCurrentList,
  saveListProgress, saveListProgressById, getCurrentLanguage, saveCurrentLanguage
} from '../utils/storage';
import { getDataLoader, getTotalWords } from '../utils/languageRegistry';
import { getListsByLanguage, getLanguageInfo, getWordListById } from '../config/wordLists';

interface AppState {
  currentWord: Word | null;
  isLoading: boolean;
  error: string | null;
  currentRound: number;
  currentIndex: number;
  completedRounds: number;
  totalWords: number;
  isPlaying: boolean;
  isLearningMode: boolean;
  settings: Settings;
  masteredWords: Record<number, { word: string; definition: string }>;
  currentList: string;
  listProgress: Record<string, ProgressData>;
  wordIndexesInList: number[];
  listTotalWords: number;

  // 多语言
  currentLanguage: string;
  wordIndexTotal: number;

  initialize: () => Promise<void>;
  loadCurrentWord: () => Promise<void>;
  nextWord: () => void;
  prevWord: () => void;
  togglePlay: () => void;
  startLearning: () => void;
  quitLearning: () => void;
  updateSettings: (newSettings: Partial<Settings>) => void;
  resetProgress: () => void;
  markMastered: () => void;
  unmarkMastered: (index: number) => void;
  switchList: (listId: string) => Promise<void>;
  loadListWord: () => Promise<void>;
  switchLanguage: (lang: string) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  currentWord: null,
  isLoading: true,
  error: null,
  currentRound: 1,
  currentIndex: 0,
  completedRounds: 0,
  totalWords: getTotalWords(getCurrentLanguage()),
  isPlaying: false,
  isLearningMode: false,
  settings: storage.getSettings(),
  masteredWords: storage.getMasteredWords(),
  currentLanguage: getCurrentLanguage(),
  currentList: getCurrentList(),
  listProgress: getListProgress(),
  wordIndexesInList: [],
  listTotalWords: getTotalWords(getCurrentLanguage()),
  wordIndexTotal: getTotalWords(getCurrentLanguage()),

  initialize: async () => {
    const progress = storage.getProgress();
    const currentLanguage = getCurrentLanguage();
    const currentList = getCurrentList();
    const listProgress = getListProgress();
    const totalWords = getTotalWords(currentLanguage);

    set({
      currentRound: progress.currentRound,
      currentIndex: progress.currentIndex,
      completedRounds: progress.completedRounds,
      settings: storage.getSettings(),
      masteredWords: storage.getMasteredWords(),
      currentLanguage,
      currentList,
      listProgress,
      isLoading: true,
      totalWords,
      wordIndexTotal: totalWords,
    });

    // Build word list index for current language
    const { buildWordListIndex } = await import('../utils/wordListIndex');
    await buildWordListIndex(currentLanguage);

    // Load word indexes for current list
    if (currentList === 'all' || currentList === `${currentLanguage}_all`) {
      set({
        wordIndexesInList: Array.from({ length: totalWords }, (_, i) => i),
        listTotalWords: totalWords,
      });
    } else {
      const { getWordIndexesByTag } = await import('../utils/wordListIndex');
      const wordList = getWordListById(currentList);

      if (wordList) {
        const indexes = await getWordIndexesByTag(wordList.tag, currentLanguage);
        set({
          wordIndexesInList: indexes,
          listTotalWords: indexes.length,
        });
      }
    }

    await get().loadListWord();
  },

  loadCurrentWord: async () => {
    await get().loadListWord();
  },

  loadListWord: async () => {
    const { currentIndex, wordIndexesInList, currentLanguage } = get();

    if (wordIndexesInList.length === 0) {
      set({ currentWord: null, isLoading: false });
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const globalIndex = wordIndexesInList[currentIndex];
      const loader = getDataLoader(currentLanguage);
      const word = await loader.getWord(globalIndex);

      if (word) {
        set({ currentWord: word, isLoading: false });
        loader.preloadAdjacent(globalIndex);
      } else {
        set({ error: 'Word not found', isLoading: false });
      }
    } catch (err) {
      set({ error: 'Failed to load word', isLoading: false });
    }
  },

  nextWord: () => {
    const { currentIndex, wordIndexesInList, listTotalWords, masteredWords, currentList } = get();

    if (wordIndexesInList.length === 0) return;

    let newIndex = currentIndex;
    let attempts = 0;

    do {
      newIndex = (newIndex + 1) % listTotalWords;
      attempts++;
    } while (
      masteredWords[wordIndexesInList[newIndex]] !== undefined
      && attempts < listTotalWords
    );

    const newCompletedRounds = attempts >= listTotalWords
      ? get().completedRounds + 1
      : get().completedRounds;

    const newRound = attempts >= listTotalWords
      ? get().currentRound + 1
      : get().currentRound;

    set({
      currentIndex: newIndex,
      currentRound: newRound,
      completedRounds: newCompletedRounds,
    });

    const progress: ProgressData = {
      currentRound: newRound,
      currentIndex: newIndex,
      completedRounds: newCompletedRounds,
      lastUpdate: new Date().toISOString(),
    };

    if (currentList === 'all' || currentList === `${get().currentLanguage}_all`) {
      storage.saveProgress(progress);
    } else {
      saveListProgressById(currentList, progress);
    }

    get().loadListWord();
  },

  prevWord: () => {
    const { currentIndex, wordIndexesInList, listTotalWords, masteredWords, currentList } = get();

    if (wordIndexesInList.length === 0) return;

    let newIndex = currentIndex;
    let attempts = 0;

    do {
      newIndex = newIndex === 0 ? listTotalWords - 1 : newIndex - 1;
      attempts++;
    } while (
      masteredWords[wordIndexesInList[newIndex]] !== undefined
      && attempts < listTotalWords
    );

    set({ currentIndex: newIndex });

    const progress: ProgressData = {
      currentRound: get().currentRound,
      currentIndex: newIndex,
      completedRounds: get().completedRounds,
      lastUpdate: new Date().toISOString(),
    };

    if (currentList === 'all' || currentList === `${get().currentLanguage}_all`) {
      storage.saveProgress(progress);
    } else {
      saveListProgressById(currentList, progress);
    }

    get().loadListWord();
  },

  togglePlay: () => {
    const { settings, isPlaying } = get();
    const newIsPlaying = !isPlaying;
    set({ isPlaying: newIsPlaying });
    storage.saveSettings({ ...settings, autoPlay: newIsPlaying });
  },

  startLearning: () => {
    set({ isLearningMode: true, isPlaying: true });
    storage.saveSettings({ ...get().settings, autoPlay: true });
  },

  quitLearning: () => {
    set({ isLearningMode: false, isPlaying: false });
  },

  updateSettings: (newSettings) => {
    const updated = { ...get().settings, ...newSettings };
    set({ settings: updated });
    storage.saveSettings(updated);
  },

  resetProgress: () => {
    const { currentList, listProgress } = get();

    const updatedListProgress = { ...listProgress };
    if (currentList === 'all' || currentList === `${get().currentLanguage}_all`) {
      storage.resetProgress();
    } else {
      delete updatedListProgress[currentList];
    }
    saveListProgress(updatedListProgress);

    set({
      currentRound: 1,
      currentIndex: 0,
      completedRounds: 0,
      listProgress: updatedListProgress,
    });
    get().loadListWord();
  },

  markMastered: () => {
    const { currentWord, currentIndex, wordIndexesInList, masteredWords } = get();
    if (!currentWord || wordIndexesInList.length === 0) return;

    const globalIndex = wordIndexesInList[currentIndex];
    const cleanDef = currentWord.definition.replace(/^[a-z]+\.\s*/i, '').trim();
    const newMastered = { ...masteredWords, [globalIndex]: { word: currentWord.word, definition: cleanDef } };

    set({ masteredWords: newMastered });
    storage.saveMasteredWords(newMastered);

    get().nextWord();
  },

  unmarkMastered: (index: number) => {
    const { masteredWords } = get();
    const newMastered = { ...masteredWords };
    delete newMastered[index];

    set({ masteredWords: newMastered });
    storage.saveMasteredWords(newMastered);
  },

  switchList: async (listId: string) => {
    const { listProgress, currentList, currentRound, currentIndex, completedRounds, currentLanguage } = get();

    // Save current progress
    const currentProgress: ProgressData = {
      currentRound, currentIndex, completedRounds,
      lastUpdate: new Date().toISOString(),
    };
    const updatedListProgress = { ...listProgress, [currentList]: currentProgress };

    let newWordIndexesInList: number[];
    let newListTotalWords: number;

    const wordList = getWordListById(listId);
    const lang = wordList?.language || currentLanguage;

    if (listId === 'all' || listId === `${lang}_all`) {
      const total = getTotalWords(lang);
      newWordIndexesInList = Array.from({ length: total }, (_, i) => i);
      newListTotalWords = total;
    } else if (wordList) {
      const { getWordIndexesByTag } = await import('../utils/wordListIndex');
      newWordIndexesInList = await getWordIndexesByTag(wordList.tag, lang);
      newListTotalWords = newWordIndexesInList.length;
    } else {
      console.error(`Word list not found: ${listId}`);
      return;
    }

    const targetProgress = updatedListProgress[listId] || {
      currentRound: 1, currentIndex: 0, completedRounds: 0,
      lastUpdate: new Date().toISOString(),
    };

    set({
      currentList: listId,
      wordIndexesInList: newWordIndexesInList,
      listTotalWords: newListTotalWords,
      currentRound: targetProgress.currentRound,
      currentIndex: targetProgress.currentIndex,
      completedRounds: targetProgress.completedRounds,
      listProgress: updatedListProgress,
      isLoading: true,
    });

    saveCurrentList(listId);
    saveListProgress(updatedListProgress);

    await get().loadListWord();
  },

  switchLanguage: async (lang: string) => {
    const { listProgress, currentList, currentRound, currentIndex, completedRounds } = get();

    // Save current list progress
    const currentProgress: ProgressData = {
      currentRound, currentIndex, completedRounds,
      lastUpdate: new Date().toISOString(),
    };
    const updatedListProgress = { ...listProgress, [currentList]: currentProgress };

    // Get default list for new language
    const langLists = getListsByLanguage(lang);
    // 如果当前是 'all' 或 'en_all'，新语言也选对应的 '_all' 词表
    const defaultListId = langLists.find(l => l.id === `${lang}_all`)?.id || langLists[0]?.id || 'all';
    const totalWords = getTotalWords(lang);

    // Update accent for new language
    const langInfo = getLanguageInfo(lang);
    const newSettings = { ...get().settings };
    if (langInfo && langInfo.ttsConfig.defaultAccent) {
      newSettings.accent = langInfo.ttsConfig.defaultAccent;
    }

    // Build index for new language
    const { buildWordListIndex } = await import('../utils/wordListIndex');
    await buildWordListIndex(lang);

    // Load target progress (or start fresh)
    const targetProgress = updatedListProgress[defaultListId] || {
      currentRound: 1, currentIndex: 0, completedRounds: 0,
      lastUpdate: new Date().toISOString(),
    };

    set({
      currentLanguage: lang,
      currentList: defaultListId,
      wordIndexesInList: Array.from({ length: totalWords }, (_, i) => i),
      listTotalWords: totalWords,
      wordIndexTotal: totalWords,
      totalWords,
      currentRound: targetProgress.currentRound,
      currentIndex: targetProgress.currentIndex,
      completedRounds: targetProgress.completedRounds,
      listProgress: updatedListProgress,
      settings: newSettings,
      isLoading: true,
    });

    saveCurrentLanguage(lang);
    saveCurrentList(defaultListId);
    saveListProgress(updatedListProgress);
    storage.saveSettings(newSettings);

    await get().loadListWord();
  },
}));
```

- [ ] **Step 4: 验证**

```bash
npm run build
```
确保没有 TypeScript 编译错误。

- [ ] **Step 5: Commit**

```bash
git add src/store/useAppStore.ts src/utils/wordListIndex.ts src/utils/storage.ts
git commit -m "feat: Store 增加多语言状态和 switchLanguage
- currentLanguage 状态及持久化存储
- wordListIndex 支持按语言构建索引
- switchList 适配多语言词表
- 切换语言自动更新 accent 设置
Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: 改造 TTS 支持多语言

**Files:**
- Modify: `src/hooks/useTTS.ts`

**说明：**
`useTTS` 和 `useAutoPlay` 根据当前语言选择发音方式：英语走有道API，其他语言走 Web Speech API。

**Interfaces:**
- Consumes: `currentLanguage` (from store), `getLanguageInfo(lang)`
- Produces: 语言感知的 `speakByLanguage`, `speakExample`, 改造后的 `useAutoPlay`

- [ ] **Step 1: 添加 speakByLanguage 方法**

```typescript
// src/hooks/useTTS.ts 新增
import { getLanguageInfo } from '../config/wordLists';

// 在 useTTS hook 内新增方法
const speakByLanguage = useCallback(async (
  speakId: number,
  text: string,
  language: string,
  accent: string,
  rate: number = 1.0
): Promise<boolean> => {
  const langConfig = getLanguageInfo(language);
  if (!langConfig) {
    // 未知语言，用 Web Speech 兜底
    return await speakTTS(speakId, text, 'en-US', rate);
  }

  const { ttsConfig } = langConfig;

  if (ttsConfig.mode === 'youdao') {
    return await speakRealAudio(speakId, text, accent as 'us' | 'uk', rate);
  }

  const lang = ttsConfig.webspeechLang || `${language}-${language.toUpperCase()}`;
  return await speakTTS(speakId, text, lang, rate);
}, [speakRealAudio, speakTTS]);

// 返回增加 speakByLanguage
return { speak, speakChinese, speakByLanguage, stop, resetCancel };
```

- [ ] **Step 2: 改造 useAutoPlay 使用语言感知发音**

```typescript
// useAutoPlay 中
const { speak, speakChinese, speakByLanguage, stop, resetCancel } = useTTS();

// 在 playCurrentWord 中：
const currentLanguage = useAppStore.getState().currentLanguage;
const currentSettings = useAppStore.getState().settings;

// 1. 读单词
const success = await speakByLanguage(
  speakId, currentWord.word, currentLanguage,
  currentSettings.accent, currentSettings.speechRate || 1.0
);

// 4. 读例句（如果开了）
if (currentSettings.readExample && currentWord.example) {
  const exampleSuccess = await speakByLanguage(
    speakId, currentWord.example, currentLanguage,
    currentSettings.accent, currentSettings.speechRate || 1.0
  );
}
```

- [ ] **Step 3: 完整修改 useTTS.ts 中的 useAutoPlay**

```typescript
// useAutoPlay 完整修改
export function useAutoPlay() {
  const { speak, speakChinese, speakByLanguage, stop, resetCancel } = useTTS();

  const isPlaying = useAppStore(state => state.isPlaying);
  const isLoading = useAppStore(state => state.isLoading);
  const currentWord = useAppStore(state => state.currentWord);
  const nextWord = useAppStore(state => state.nextWord);

  useEffect(() => {
    let isActive = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    if (!isPlaying || !currentWord || isLoading) {
      stop();
      return;
    }

    resetCancel();

    const playCurrentWord = async () => {
      const state = useAppStore.getState();
      const settings = state.settings;
      const currentLanguage = state.currentLanguage;

      // 1. 读单词（语言感知）
      const success = await speakByLanguage(
        Date.now(), currentWord.word, currentLanguage,
        settings.accent, settings.speechRate || 1.0
      );

      if (!isActive) return;

      if (!success) {
        console.warn('[AutoPlay] Speech failed, stopping playback');
        useAppStore.setState({ isPlaying: false });
        return;
      }

      // 2. 停顿
      await new Promise(r => setTimeout(r, 300));
      if (!isActive) return;

      const currentSettings = useAppStore.getState().settings;

      // 3. 读中文释义
      if (currentSettings.readDefinition && currentWord.definition) {
        const cleanDef = currentWord.definition.replace(/^[a-z]+\.\s*/i, '').trim();
        if (cleanDef) {
          const defSuccess = await speakChinese(cleanDef, settings.speechRate || 1.0);
          if (!isActive) return;
          if (!defSuccess) {
            console.warn('[AutoPlay] Definition speech failed, but continuing');
          }
          await new Promise(r => setTimeout(r, 300));
        }
      }

      if (!isActive) return;

      // 4. 读例句（语言感知）
      if (currentSettings.readExample && currentWord.example) {
        const exampleSuccess = await speakByLanguage(
          Date.now(), currentWord.example, currentLanguage,
          currentSettings.accent, currentSettings.speechRate || 1.0
        );
        if (!isActive) return;
        if (!exampleSuccess) {
          console.warn('[AutoPlay] Example speech failed, but continuing');
        }
        await new Promise(r => setTimeout(r, 500));
      }

      // 5. 等待间隔
      timeoutId = setTimeout(() => {
        if (isActive) {
          const stillPlaying = useAppStore.getState().isPlaying;
          if (stillPlaying) {
            nextWord();
          }
        }
      }, currentSettings.speed * 1000);
    };

    playCurrentWord();

    return () => {
      isActive = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      stop();
    };
  }, [
    isPlaying,
    isLoading,
    currentWord,
    speakByLanguage,
    nextWord,
    stop,
    resetCancel,
    useAppStore.getState().settings.readDefinition,
    useAppStore.getState().settings.readExample,
    useAppStore.getState().settings.speed,
  ]);
}
```

- [ ] **Step 4: 验证**

```bash
npm run build
```
确保没有 TypeScript 编译错误。

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useTTS.ts
git commit -m "feat: TTS 支持多语言发音
- 新增 speakByLanguage 方法，英语走有道API，其他走Web Speech
- useAutoPlay 使用语言感知的 speakByLanguage
- 修复 readDefinition 依赖缺失问题
Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: 首页 UI 添加语言 Tab 切换

**Files:**
- Modify: `src/components/Home.tsx`
- Modify: `src/components/WordListSelect.tsx`
- Modify: `src/App.tsx`

**说明：**
首页添加语言 Tab 栏，切换时更新语言状态。词表选择列表根据当前语言过滤显示。

- [ ] **Step 1: 改造 Home.tsx 添加语言 Tab 栏**

```typescript
// src/components/Home.tsx
// 新增 LanguageTabBar 组件，在 Logo 和 快速开始按钮 之间插入

import { LANGUAGES, getListsByLanguage, getLanguageInfo } from '../config/wordLists';
import { getTotalWords } from '../utils/languageRegistry';

// 在 Home 组件内
const { currentLanguage, switchLanguage, completedRounds, currentRound, currentIndex, switchList, startLearning } = useAppStore();
const [showListSelect, setShowListSelect] = useState(false);

const totalWords = getTotalWords(currentLanguage);
const percentage = totalWords > 0 ? ((currentIndex + 1) / totalWords) * 100 : 0;

const handleQuickStart = async () => {
  // 快速开始：当前语言的全部单词
  const langInfo = getLanguageInfo(currentLanguage);
  if (langInfo) {
    await switchList(`${currentLanguage}_all`);
  } else {
    await switchList('all');
  }
  unlockAudio();
  startLearning();
};

// 在 Logo 下方添加 Language Tab 栏
```

```tsx
{/* Language Tabs */}
<div className="flex gap-1.5 mb-6 bg-background/50 rounded-xl p-1 border border-white/5 w-full">
  {LANGUAGES.map((lang) => (
    <button
      key={lang.code}
      onClick={() => {
        if (lang.code !== currentLanguage) {
          switchLanguage(lang.code);
        }
      }}
      className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
        currentLanguage === lang.code
          ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
      }`}
    >
      <span className="text-base">{lang.flag}</span>
      <span>{lang.name}</span>
    </button>
  ))}
</div>
```

- [ ] **Step 2: 改造 WordListSelect.tsx 按语言过滤**

```typescript
// src/components/WordListSelect.tsx
// 修改 loadListStats 函数

const loadListStats = async () => {
  setLoading(true);
  const { currentLanguage } = useAppStore.getState();
  const listsWithStats: WordListWithStats[] = [];

  const filteredLists = WORD_LISTS.filter(list => list.language === currentLanguage);

  for (const list of filteredLists) {
    const wordCount = list.tag === '*'
      ? getTotalWords(currentLanguage)
      : await getWordCountByTag(list.tag, currentLanguage);  // 传入 language 参数
    listsWithStats.push({
      ...list,
      wordCount,
      progress: listProgress[list.id],
    });
  }

  setLists(listsWithStats);
  setLoading(false);
};
```

- [ ] **Step 3: 验证**

```bash
npm run build
```
手动测试：
1. 首页显示语言Tab（英语/日语/韩语/德语）
2. 点击日语Tab → 切换到日语，进度重置
3. 点击"快速开始" → 进入日语学习模式
4. 返回首页 → 点击韩语Tab → 切换到韩语

- [ ] **Step 4: Commit**

```bash
git add src/components/Home.tsx src/components/WordListSelect.tsx
git commit -m "feat: 首页添加语言Tab切换
- 新增 LanguageTabBar 组件，支持英语/日语/韩语/德语切换
- WordListSelect 按当前语言过滤显示词表
- 快速开始使用当前语言的默认词表
Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: 学习页 UI 适配多语言

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/WordCard.tsx`
- Modify: `src/components/ProgressBar.tsx`
- Modify: `src/components/SettingsModal.tsx`

**说明：**
学习页面的 Header Logo、WordCard 显示、Settings 发音口音选项根据当前语言适配。

- [ ] **Step 1: 改造 App.tsx 中的 Header**

```tsx
// 在 App.tsx 的 Header 部分
// Logo 字母根据语言变化

const languageLogo = {
  en: 'E', ja: '日', ko: '한', de: 'D',
}[currentLanguage] || 'E';

// 标题区域
<span className="text-base font-semibold text-foreground">
  单词朗读
</span>
<p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
  {currentLanguage === 'en' ? 'Vocab Master' : 
   currentLanguage === 'ja' ? '日本語マスター' :
   currentLanguage === 'ko' ? '단어 마스터' :
   currentLanguage === 'de' ? 'Wortmeister' : 'Vocab Master'}
</p>
```

- [ ] **Step 2: 改造 SettingsModal.tsx 发音口音部分**

```tsx
// 在 SettingsModal 中，根据当前语言显示 accent 选项
import { getLanguageInfo } from '../config/wordLists';

// 在组件内部
const { currentLanguage } = useAppStore();
const langInfo = getLanguageInfo(currentLanguage);
const accentOptions = langInfo?.ttsConfig.accentOptions || [];

// 发音口音区域
<div>
  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
    发音口音
  </label>
  {accentOptions.length > 1 ? (
    <div className="grid grid-cols-2 gap-3">
      {accentOptions.map(opt => (
        <Button
          key={opt.value}
          variant={settings.accent === opt.value ? 'default' : 'outline'}
          onClick={() => onUpdateSettings({ accent: opt.value })}
          className="justify-start gap-2"
        >
          <span className="font-medium">{opt.label}</span>
        </Button>
      ))}
    </div>
  ) : (
    <div className="bg-muted/50 rounded-xl p-4 text-center">
      <span className="text-sm text-muted-foreground">标准发音</span>
    </div>
  )}
</div>
```

- [ ] **Step 3: 改造 WordCard.tsx 适配多语言展示**

```tsx
// WordCard 中，tag 显示逻辑
// 如果 word.tag 为空，显示语言类型
const tagDisplay = word.tag 
  ? word.tag.split(' ')[0].toUpperCase() 
  : (language === 'ja' ? '日本語' : 
     language === 'ko' ? '한국어' : 
     language === 'de' ? 'DEUTSCH' : 'VOCAB');

// parseDefinition 只对英文释义有效（有 a./n./v. 前缀）
// 日语/韩语/德语释义直接显示，不解析 pos
```

- [ ] **Step 4: 验证**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/components/WordCard.tsx src/components/SettingsModal.tsx
git commit -m "feat: 学习页UI适配多语言
- Header Logo 和副标题随语言变化
- Settings 发音口音动态显示（英语显示美式/英式，其他显示标准）
- WordCard 标签显示随语言变化
Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: 集成测试与最终验证

**Files:**
- 无代码修改

**说明：**
端到端测试多语言学习流程，确保英语功能不受影响，新语言功能正常工作。

- [ ] **Step 1: 启动开发服务器**

```bash
npm run dev
```

- [ ] **Step 2: 测试英语功能回归**

1. 访问首页，确认默认显示英语Tab选中
2. 点击"快速开始" → 进入英语学习模式
3. 自动播放：单词发音（有道API）→ 中文释义发音 → 例句发音
4. 点击"已掌握" → 单词被标记，跳到下一个
5. 打开设置 → 切换美式/英式发音 → 朗读释义开关 → 朗读例句开关
6. 返回首页，确认进度显示

- [ ] **Step 3: 测试日语功能**

1. 点击"日语"Tab
2. 点击"快速开始" → 进入日语学习模式
3. 确认 WordCard 显示日语单词、假名读音、中文释义、日语例句
4. 自动播放：日语单词发音（Web Speech）→ 中文释义发音 → 日语例句发音
5. 打开设置 → 确认发音口音显示"标准发音"
6. 返回首页，确认进度已切换

- [ ] **Step 4: 测试韩语和德语**

1. 点击"韩语"Tab → 快速开始 → 确认韩语单词显示和发音
2. 返回 → 点击"德语"Tab → 快速开始 → 确认德语单词显示和发音

- [ ] **Step 5: 测试语言切换后进度独立**

1. 英语学习到第10个词 → 切换到日语 → 英语进度应保存
2. 日语学习到第5个词 → 切回英语 → 回到第10个词
3. 确认 mastered 单词跨语言不共享

- [ ] **Step 6: 检查 localStorage**

```javascript
// 在浏览器控制台
console.log(localStorage.getItem('vocab_current_language'));
console.log(localStorage.getItem('vocab_list_progress'));
console.log(localStorage.getItem('vocab_mastered'));
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: 多语言词库集成完成
- 支持英语/日语/韩语/德语四种语言切换
- 英语发音使用有道API，其他语言使用Web Speech API
- 各语言学习进度独立存储
- 修复朗读释义开关不生效的bug
Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```