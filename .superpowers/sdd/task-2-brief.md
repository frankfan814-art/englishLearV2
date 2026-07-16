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

