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

