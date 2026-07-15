# 单词表系统与朗读增强实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复长单词显示和黑屏问题，实现单词表分类系统，增强朗读功能支持读中文释义。

**Architecture:** 渐进式扩展现有 Zustand store 架构，新增词表配置和索引模块，改造首页和设置页面，集成 Wake Lock API。

**Tech Stack:** React 18, TypeScript, Zustand, Tailwind CSS, Wake Lock API

## Global Constraints

- 保持向后兼容，不破坏现有用户数据
- 已掌握单词全局生效，不按词表隔离
- 词表切换时各自进度独立保存
- 默认语言为 'en'，架构预留多语种扩展
- 单词可属于多个词表（tag 可组合）

---

## File Structure

### 新增文件
```
src/
  config/
    wordLists.ts           # 词表配置定义
  hooks/
    useWakeLock.ts         # Wake Lock 屏幕常亮
  components/
    WordListSelect.tsx     # 词表选择页面
  utils/
    wordListIndex.ts       # 词表索引构建与查询
```

### 修改文件
```
src/
  types/
    word.ts                # Settings 类型扩展
  utils/
    storage.ts             # 新增词表进度存储
    dataLoader.ts          # 新增词表索引方法
  store/
    useAppStore.ts         # 新增词表相关状态和 actions
  hooks/
    useTTS.ts              # 改造 useAutoPlay 支持读释义
  components/
    Home.tsx               # 改造为双入口
    SettingsModal.tsx      # 新增读释义开关
    ProgressBar.tsx        # 显示当前词表名称
    WordCard.tsx           # 修复长单词样式
  index.css                # 新增 .word-title 样式
  App.tsx                  # 集成 Wake Lock
```

---

## Phase 1: Bug 修复

### Task 1: 修复长单词溢出和字母底部裁剪

**Files:**
- Modify: `src/components/WordCard.tsx:134`
- Modify: `src/index.css` (新增样式)

**Interfaces:**
- Consumes: 无
- Produces: `.word-title` CSS 类

- [ ] **Step 1: 修改 WordCard.tsx 单词标题样式**

修改 `src/components/WordCard.tsx` 第 134 行：

```tsx
// 修改前：
<h1 className="text-5xl sm:text-6xl font-bold text-gradient text-center mb-6 tracking-tight">
  {word.word}
</h1>

// 修改后：
<h1 className="word-title text-gradient text-center mb-6 tracking-tight">
  {word.word}
</h1>
```

- [ ] **Step 2: 在 index.css 新增 .word-title 样式**

在 `src/index.css` 文件末尾添加：

```css
/* Word title responsive sizing */
.word-title {
  font-size: clamp(1.75rem, 8vw, 3.75rem);
  font-weight: 700;
  word-break: break-word;
  line-height: 1.4;
  padding-bottom: 4px;
  max-width: 100%;
}
```

- [ ] **Step 3: 手动测试**

运行 `npm run dev`，在浏览器中测试：
1. 打开应用进入学习页面
2. 检查普通单词显示是否正常
3. 检查长单词（如 "electroencephalogram"）是否自动换行或缩小
4. 检查字母 g、y、p 下缘是否完整显示

- [ ] **Step 4: 提交**

```bash
git add src/components/WordCard.tsx src/index.css
git commit -m "fix(ui): resolve long word overflow and letter clipping issues

- Use responsive font sizing with clamp() for word title
- Add word-break for long words to wrap
- Increase line-height and padding for descenders

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: 实现 Wake Lock 屏幕常亮

**Files:**
- Create: `src/hooks/useWakeLock.ts`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `isPlaying: boolean` (from store)
- Produces: `useWakeLock(enabled: boolean): void`

- [ ] **Step 1: 创建 useWakeLock hook**

创建 `src/hooks/useWakeLock.ts`：

```typescript
import { useEffect, useRef } from 'react';

/**
 * Keep screen awake while enabled (e.g., during audio playback)
 * Uses Screen Wake Lock API with graceful fallback for unsupported browsers
 */
export function useWakeLock(enabled: boolean) {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const enabledRef = useRef(enabled);

  // Keep enabledRef in sync
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      // Release Wake Lock when disabled
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
      return;
    }

    // Check browser support
    if (!('wakeLock' in navigator)) {
      console.warn('[WakeLock] API not supported in this browser');
      return;
    }

    // Request Wake Lock
    const requestWakeLock = async () => {
      try {
        const wakeLock = await navigator.wakeLock.request('screen');
        wakeLockRef.current = wakeLock;

        // Listen for automatic release (tab switch, minimize, etc.)
        wakeLock.addEventListener('release', () => {
          wakeLockRef.current = null;
          // Re-acquire if still enabled and page is visible
          if (enabledRef.current && !document.hidden) {
            requestWakeLock();
          }
        });
      } catch (err) {
        console.warn('[WakeLock] Request failed:', err);
      }
    };

    requestWakeLock();

    // Cleanup
    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, [enabled]);

  // Re-acquire wake lock when page becomes visible again
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && enabledRef.current && !wakeLockRef.current) {
        if ('wakeLock' in navigator) {
          navigator.wakeLock.request('screen')
            .then(wakeLock => {
              wakeLockRef.current = wakeLock;
              wakeLock.addEventListener('release', () => {
                wakeLockRef.current = null;
              });
            })
            .catch(() => {});
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);
}
```

- [ ] **Step 2: 在 App.tsx 中集成 Wake Lock**

修改 `src/App.tsx`，在文件顶部添加 import：

```typescript
import { useWakeLock } from './hooks/useWakeLock';
```

在 `App` 函数体内，`useAutoPlay()` 之后添加：

```typescript
// Keep screen awake during playback
useWakeLock(isPlaying);
```

完整位置参考：

```typescript
function App() {
  // ... existing state and hooks

  useAutoPlay();

  // Keep screen awake during playback
  useWakeLock(isPlaying);

  // ... rest of the component
}
```

- [ ] **Step 3: 手动测试**

运行 `npm run dev`，测试：
1. 点击"开始学习"进入学习页面
2. 点击"自动朗读"开始播放
3. 等待 1-2 分钟，观察屏幕是否保持常亮（不会自动锁屏）
4. 点击"暂停朗读"，Wake Lock 应释放
5. 切换到其他标签页再切回来，确认 Wake Lock 重新获取

- [ ] **Step 4: 提交**

```bash
git add src/hooks/useWakeLock.ts src/App.tsx
git commit -m "feat(wake-lock): keep screen awake during playback

- Add useWakeLock hook using Screen Wake Lock API
- Re-acquire wake lock on visibility change
- Graceful fallback for unsupported browsers

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Phase 2: 单词表系统核心

### Task 3: 创建词表配置和类型定义

**Files:**
- Create: `src/config/wordLists.ts`
- Modify: `src/types/word.ts`

**Interfaces:**
- Consumes: 无
- Produces: `WordList` 接口, `WORD_LISTS` 数组, `Settings.readDefinition`

- [ ] **Step 1: 扩展 Settings 类型**

修改 `src/types/word.ts`，在 `Settings` 接口中添加新字段：

```typescript
export interface Settings {
  speed: number;
  speechRate?: number;
  readExample?: boolean;
  readDefinition?: boolean;   // 新增：读中文释义
  accent: 'us' | 'uk';
  autoPlay: boolean;
}
```

- [ ] **Step 2: 创建词表配置文件**

创建 `src/config/wordLists.ts`：

```typescript
/**
 * Word list configuration
 * Each list corresponds to a tag in the word data
 */

export interface WordList {
  id: string;           // Unique identifier: 'toefl', 'gre', etc.
  name: string;         // Display name: '托福词汇', 'GRE词汇', etc.
  tag: string;          // Corresponding tag in word data
  language: string;     // Language code: 'en', 'ja', 'ko', etc.
  description?: string; // Optional description
}

/**
 * Predefined word lists based on existing tag data
 * Words can belong to multiple lists (tags can be combined)
 */
export const WORD_LISTS: WordList[] = [
  { id: 'toefl', name: '托福词汇', tag: 'toefl', language: 'en' },
  { id: 'gre', name: 'GRE词汇', tag: 'gre', language: 'en' },
  { id: 'cet6', name: '六级词汇', tag: 'cet6', language: 'en' },
  { id: 'ky', name: '考研词汇', tag: 'ky', language: 'en' },
  { id: 'ielts', name: '雅思词汇', tag: 'ielts', language: 'en' },
  { id: 'cet4', name: '四级词汇', tag: 'cet4', language: 'en' },
  { id: 'gk', name: '高考词汇', tag: 'gk', language: 'en' },
  { id: 'other', name: '其他词汇', tag: '', language: 'en' },
];

/**
 * Get word list by ID
 */
export function getWordListById(id: string): WordList | undefined {
  return WORD_LISTS.find(list => list.id === id);
}

/**
 * Get all word list IDs
 */
export function getWordListIds(): string[] {
  return WORD_LISTS.map(list => list.id);
}
```

- [ ] **Step 3: 提交**

```bash
git add src/config/wordLists.ts src/types/word.ts
git commit -m "feat(config): add word list configuration and types

- Add WordList interface with id, name, tag, language
- Define 8 word lists: TOEFL, GRE, CET6, KY, IELTS, CET4, GK, Other
- Add readDefinition to Settings for reading Chinese definition

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: 实现词表索引构建

**Files:**
- Create: `src/utils/wordListIndex.ts`
- Modify: `src/utils/dataLoader.ts`

**Interfaces:**
- Consumes: `Word` type, data loader shard data
- Produces: `buildWordListIndex()`, `getWordIndexesByTag(tag: string): number[]`, `getWordCountByTag(tag: string): number`

- [ ] **Step 1: 创建词表索引模块**

创建 `src/utils/wordListIndex.ts`：

```typescript
import { dataLoader } from './dataLoader';

/**
 * Word list index for fast lookup
 * Maps tag -> Set of global word indexes
 */
let wordListIndexCache: Map<string, Set<number>> | null = null;
let indexBuildPromise: Promise<Map<string, Set<number>>> | null = null;

/**
 * Build word list index by scanning all words
 * Caches the result for subsequent calls
 */
export async function buildWordListIndex(): Promise<Map<string, Set<number>>> {
  // Return cached index if available
  if (wordListIndexCache) {
    return wordListIndexCache;
  }

  // Return existing build promise if already building
  if (indexBuildPromise) {
    return indexBuildPromise;
  }

  // Build index
  indexBuildPromise = (async () => {
    const index = new Map<string, Set<number>>();

    // Total words: 16194 (17 shards * ~1000)
    const totalWords = 16194;

    // Load all shards and build index
    for (let globalIndex = 0; globalIndex < totalWords; globalIndex++) {
      try {
        const word = await dataLoader.getWord(globalIndex);
        if (word) {
          const tag = word.tag || '';

          // Handle empty tag (other vocabulary)
          if (tag === '') {
            if (!index.has('')) {
              index.set('', new Set());
            }
            index.get('')!.add(globalIndex);
          } else {
            // Split combined tags (e.g., "cet4 cet6 toefl")
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
        console.error(`Failed to load word at index ${globalIndex}:`, err);
      }
    }

    wordListIndexCache = index;
    indexBuildPromise = null;
    return index;
  })();

  return indexBuildPromise;
}

/**
 * Get word indexes by tag
 * Returns empty array if tag not found
 */
export async function getWordIndexesByTag(tag: string): Promise<number[]> {
  const index = await buildWordListIndex();
  const indexes = index.get(tag);

  if (!indexes) {
    return [];
  }

  return Array.from(indexes).sort((a, b) => a - b);
}

/**
 * Get word count by tag
 */
export async function getWordCountByTag(tag: string): Promise<number> {
  const index = await buildWordListIndex();
  const indexes = index.get(tag);
  return indexes ? indexes.size : 0;
}

/**
 * Clear index cache (for testing)
 */
export function clearWordListIndexCache(): void {
  wordListIndexCache = null;
  indexBuildPromise = null;
}
```

- [ ] **Step 2: 提交**

```bash
git add src/utils/wordListIndex.ts
git commit -m "feat(index): add word list index builder

- Build in-memory index mapping tag -> word indexes
- Support combined tags (e.g., 'cet4 cet6 toefl')
- Cache index for fast subsequent lookups
- Handle empty tag for 'other vocabulary'

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: 扩展存储层支持词表进度

**Files:**
- Modify: `src/utils/storage.ts`

**Interfaces:**
- Consumes: `ProgressData` type
- Produces: `getCurrentList()`, `saveCurrentList()`, `getListProgress()`, `saveListProgress()`

- [ ] **Step 1: 扩展 storage.ts**

在 `src/utils/storage.ts` 中添加新的存储函数：

在文件末尾添加：

```typescript
// === Word List Progress Storage ===

const KEY_CURRENT_LIST = 'vocab_current_list';
const KEY_LIST_PROGRESS = 'vocab_list_progress';

/**
 * Get current word list ID
 * Returns 'all' if not set (backward compatible)
 */
export function getCurrentList(): string {
  const stored = localStorage.getItem(KEY_CURRENT_LIST);
  return stored || 'all';
}

/**
 * Save current word list ID
 */
export function saveCurrentList(listId: string): void {
  localStorage.setItem(KEY_CURRENT_LIST, listId);
}

/**
 * Get progress for all word lists
 */
export function getListProgress(): Record<string, ProgressData> {
  const stored = localStorage.getItem(KEY_LIST_PROGRESS);
  if (!stored) {
    return {};
  }
  try {
    return JSON.parse(stored);
  } catch {
    return {};
  }
}

/**
 * Save progress for a specific word list
 */
export function saveListProgress(progress: Record<string, ProgressData>): void {
  localStorage.setItem(KEY_LIST_PROGRESS, JSON.stringify(progress));
}

/**
 * Get progress for a specific word list
 * Returns undefined if not found
 */
export function getListProgressById(listId: string): ProgressData | undefined {
  const allProgress = getListProgress();
  return allProgress[listId];
}

/**
 * Save progress for a specific word list
 */
export function saveListProgressById(listId: string, progress: ProgressData): void {
  const allProgress = getListProgress();
  allProgress[listId] = progress;
  saveListProgress(allProgress);
}
```

- [ ] **Step 2: 提交**

```bash
git add src/utils/storage.ts
git commit -m "feat(storage): add word list progress storage

- Store current list ID (default: 'all')
- Store progress per list independently
- Backward compatible with existing data

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: 扩展 Store 支持词表切换

**Files:**
- Modify: `src/store/useAppStore.ts`

**Interfaces:**
- Consumes: `wordListIndex` functions, `storage` functions, `WORD_LISTS`
- Produces: `language`, `currentList`, `listProgress`, `wordIndexesInList`, `listTotalWords`, `switchList()`, `loadListWord()`

- [ ] **Step 1: 扩展 AppState 接口**

修改 `src/store/useAppStore.ts`，在 `AppState` 接口中添加新状态和 actions：

```typescript
interface AppState {
  // === 现有状态 ===
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

  // === 新增状态 ===
  language: string;
  currentList: string;
  listProgress: Record<string, ProgressData>;
  wordIndexesInList: number[];
  listTotalWords: number;

  // === 现有 Actions ===
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

  // === 新增 Actions ===
  switchList: (listId: string) => Promise<void>;
  loadListWord: () => Promise<void>;
}
```

- [ ] **Step 2: 更新初始状态和 initialize 函数**

在 `useAppStore` 的 create 函数中，更新初始状态：

```typescript
export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  currentWord: null,
  isLoading: true,
  error: null,
  currentRound: 1,
  currentIndex: 0,
  completedRounds: 0,
  totalWords: 16194,
  isPlaying: false,
  isLearningMode: false,
  settings: storage.getSettings(),
  masteredWords: storage.getMasteredWords(),

  // 新增初始状态
  language: 'en',
  currentList: storage.getCurrentList(),
  listProgress: storage.getListProgress(),
  wordIndexesInList: [],
  listTotalWords: 16194,

  // Initialize from storage
  initialize: async () => {
    const progress = storage.getProgress();
    const currentList = storage.getCurrentList();
    const listProgress = storage.getListProgress();

    set({
      currentRound: progress.currentRound,
      currentIndex: progress.currentIndex,
      completedRounds: progress.completedRounds,
      settings: storage.getSettings(),
      masteredWords: storage.getMasteredWords(),
      currentList,
      listProgress,
      isLoading: true,
    });

    // Build word list index
    await import('../utils/wordListIndex').then(({ buildWordListIndex }) => buildWordListIndex());

    // Load word indexes for current list
    if (currentList === 'all') {
      set({
        wordIndexesInList: Array.from({ length: 16194 }, (_, i) => i),
        listTotalWords: 16194,
      });
    } else {
      const { getWordIndexesByTag } = await import('../utils/wordListIndex');
      const { getWordListById } = await import('../config/wordLists');
      const wordList = getWordListById(currentList);

      if (wordList) {
        const indexes = await getWordIndexesByTag(wordList.tag);
        set({
          wordIndexesInList: indexes,
          listTotalWords: indexes.length,
        });
      }
    }

    await get().loadListWord();
  },

  // ... rest of existing actions
}));
```

- [ ] **Step 3: 更新 nextWord 和 prevWord 函数**

替换现有的 `nextWord` 和 `prevWord` 函数：

```typescript
// Next word (within current list)
nextWord: () => {
  const { currentIndex, wordIndexesInList, listTotalWords, masteredWords, currentList } = get();

  if (wordIndexesInList.length === 0) return;

  let newIndex = currentIndex;
  let attempts = 0;

  do {
    newIndex = (newIndex + 1) % listTotalWords;
    attempts++;
    // Check if word at this index is mastered
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

  // Save progress
  const progress: ProgressData = {
    currentRound: newRound,
    currentIndex: newIndex,
    completedRounds: newCompletedRounds,
    lastUpdate: new Date().toISOString(),
  };

  if (currentList === 'all') {
    storage.saveProgress(progress);
  } else {
    storage.saveListProgressById(currentList, progress);
  }

  get().loadListWord();
},

// Previous word (within current list)
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

  set({
    currentIndex: newIndex,
  });

  // Save progress
  const progress: ProgressData = {
    currentRound: get().currentRound,
    currentIndex: newIndex,
    completedRounds: get().completedRounds,
    lastUpdate: new Date().toISOString(),
  };

  if (currentList === 'all') {
    storage.saveProgress(progress);
  } else {
    storage.saveListProgressById(currentList, progress);
  }

  get().loadListWord();
},
```

- [ ] **Step 4: 添加 switchList 和 loadListWord 函数**

在 `useAppStore` 的 create 函数中添加新的 actions：

```typescript
// Switch to a different word list
switchList: async (listId: string) => {
  const { listProgress, currentList, currentRound, currentIndex, completedRounds } = get();

  // Save current list progress
  const currentProgress: ProgressData = {
    currentRound,
    currentIndex,
    completedRounds,
    lastUpdate: new Date().toISOString(),
  };

  const updatedListProgress = {
    ...listProgress,
    [currentList]: currentProgress,
  };

  // Get word indexes for target list
  let wordIndexesInList: number[];
  let listTotalWords: number;

  if (listId === 'all') {
    wordIndexesInList = Array.from({ length: 16194 }, (_, i) => i);
    listTotalWords = 16194;
  } else {
    const { getWordIndexesByTag } = await import('../utils/wordListIndex');
    const { getWordListById } = await import('../config/wordLists');
    const wordList = getWordListById(listId);

    if (!wordList) {
      console.error(`Word list not found: ${listId}`);
      return;
    }

    wordIndexesInList = await getWordIndexesByTag(wordList.tag);
    listTotalWords = wordIndexesInList.length;
  }

  // Load target list progress (or initialize)
  const targetProgress = updatedListProgress[listId] || {
    currentRound: 1,
    currentIndex: 0,
    completedRounds: 0,
    lastUpdate: new Date().toISOString(),
  };

  // Update state
  set({
    currentList: listId,
    wordIndexesInList,
    listTotalWords,
    currentRound: targetProgress.currentRound,
    currentIndex: targetProgress.currentIndex,
    completedRounds: targetProgress.completedRounds,
    listProgress: updatedListProgress,
    isLoading: true,
  });

  // Save to storage
  storage.saveCurrentList(listId);
  storage.saveListProgress(updatedListProgress);

  // Load current word
  await get().loadListWord();
},

// Load word at current index in current list
loadListWord: async () => {
  const { currentIndex, wordIndexesInList } = get();

  if (wordIndexesInList.length === 0) {
    set({ currentWord: null, isLoading: false });
    return;
  }

  set({ isLoading: true, error: null });

  try {
    const globalIndex = wordIndexesInList[currentIndex];
    const word = await dataLoader.getWord(globalIndex);

    if (word) {
      set({ currentWord: word, isLoading: false });
      dataLoader.preloadAdjacent(globalIndex);
    } else {
      set({ error: 'Word not found', isLoading: false });
    }
  } catch (err) {
    set({ error: 'Failed to load word', isLoading: false });
  }
},

// Update loadCurrentWord to use loadListWord
loadCurrentWord: async () => {
  await get().loadListWord();
},
```

- [ ] **Step 5: 更新 markMastered 函数**

修改 `markMastered` 函数，使用 `loadListWord` 代替 `loadCurrentWord`：

```typescript
// Mark current word as mastered
markMastered: () => {
  const { currentWord, currentIndex, wordIndexesInList, masteredWords } = get();
  if (!currentWord || wordIndexesInList.length === 0) return;

  const globalIndex = wordIndexesInList[currentIndex];
  const cleanDef = currentWord.definition.replace(/^[a-z]+\.\s*/i, '').trim();
  const newMastered = { ...masteredWords, [globalIndex]: { word: currentWord.word, definition: cleanDef } };

  set({ masteredWords: newMastered });
  storage.saveMasteredWords(newMastered);

  // Automatically jump to next word after mastering
  get().nextWord();
},
```

- [ ] **Step 6: 提交**

```bash
git add src/store/useAppStore.ts
git commit -m "feat(store): add word list switching support

- Add language, currentList, listProgress states
- Add wordIndexesInList for navigation within list
- Implement switchList action with progress saving
- Update nextWord/prevWord to work within list context
- Maintain backward compatibility with existing progress

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Phase 3: UI 改造

### Task 7: 改造首页为双入口设计

**Files:**
- Modify: `src/components/Home.tsx`

**Interfaces:**
- Consumes: `startLearning()`, `totalWords`, `completedRounds`, `currentRound`
- Produces: 双入口 UI（快速开始 + 按词表学习）

- [ ] **Step 1: 重构 Home.tsx**

完全替换 `src/components/Home.tsx` 内容：

```typescript
import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { unlockAudio } from '../hooks/useTTS';
import { WordListSelect } from './WordListSelect';

export function Home() {
  const { currentRound, currentIndex, totalWords, completedRounds, startLearning, switchList } = useAppStore();
  const [showListSelect, setShowListSelect] = useState(false);

  const percentage = ((currentIndex + 1) / totalWords) * 100;

  const handleQuickStart = async () => {
    await switchList('all');
    unlockAudio();
    startLearning();
  };

  const handleListSelect = () => {
    setShowListSelect(true);
  };

  return (
    <>
      <div className="w-full h-full flex items-center justify-center p-4 animate-fade">
        <Card className="glass card-hover w-full max-w-[400px] p-8 flex flex-col items-center justify-center rounded-2xl border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">

          {/* App Icon / Logo */}
          <div className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30 mb-6 animate-glow">
            <span className="text-primary-foreground text-4xl font-bold font-serif">E</span>
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-gradient text-center mb-1">
            单词朗读
          </h1>
          <p className="text-sm text-muted-foreground text-center mb-8">
            听读记忆 · 高效刷词
          </p>

          {/* Quick Start Button */}
          <Button
            size="lg"
            className="w-full h-14 rounded-xl text-lg font-bold shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-transform mb-3"
            onClick={handleQuickStart}
          >
            快速开始
            <span className="text-sm font-normal opacity-80 ml-2">
              全部单词 · {totalWords.toLocaleString()} 词
            </span>
          </Button>

          {/* Word List Select Button */}
          <Button
            size="lg"
            variant="outline"
            className="w-full h-14 rounded-xl text-base font-semibold hover:scale-[1.02] active:scale-[0.98] transition-transform"
            onClick={handleListSelect}
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            按词表学习
            <span className="text-sm font-normal opacity-60 ml-2">
              托福 / GRE / 四六级
            </span>
          </Button>

          {/* Progress Stats */}
          <div className="w-full bg-background/50 rounded-xl p-5 mt-6 border border-white/5">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-medium text-muted-foreground">当前轮次</span>
              <span className="text-lg font-bold text-foreground">第 {currentRound} 轮</span>
            </div>

            <div className="flex justify-between items-center mb-4">
              <span className="text-sm font-medium text-muted-foreground">已完成轮次</span>
              <span className="text-lg font-bold text-primary">{completedRounds} 轮</span>
            </div>

            <div className="w-full pt-4 border-t border-white/5">
              <div className="flex justify-between items-end mb-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">进度</span>
                <div className="text-right">
                  <span className="font-bold text-foreground">{currentIndex + 1}</span>
                  <span className="text-muted-foreground mx-1">/</span>
                  <span className="text-sm text-muted-foreground">{totalWords}</span>
                </div>
              </div>
              {/* Progress Bar */}
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-indigo-400 transition-all duration-500 rounded-full progress-glow"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Word List Select Modal */}
      <WordListSelect
        isOpen={showListSelect}
        onClose={() => setShowListSelect(false)}
      />
    </>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add src/components/Home.tsx
git commit -m "feat(home): add dual-entry design with quick start and list select

- Add 'Quick Start' button for all words
- Add 'Select Word List' button for specific lists
- Keep progress display at bottom
- Integrate WordListSelect modal (to be created)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: 创建词表选择页面

**Files:**
- Create: `src/components/WordListSelect.tsx`

**Interfaces:**
- Consumes: `WORD_LISTS`, `getWordCountByTag()`, `switchList()`, `startLearning()`
- Produces: `WordListSelect` 组件

- [ ] **Step 1: 创建 WordListSelect 组件**

创建 `src/components/WordListSelect.tsx`：

```typescript
import { useEffect, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { WORD_LISTS, WordList } from '../config/wordLists';
import { getWordCountByTag } from '../utils/wordListIndex';
import { unlockAudio } from '../hooks/useTTS';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { ProgressData } from '../types/word';

interface WordListSelectProps {
  isOpen: boolean;
  onClose: () => void;
}

interface WordListWithStats extends WordList {
  wordCount: number;
  progress?: ProgressData;
}

export function WordListSelect({ isOpen, onClose }: WordListSelectProps) {
  const { switchList, startLearning, listProgress } = useAppStore();
  const [lists, setLists] = useState<WordListWithStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadListStats();
    }
  }, [isOpen]);

  const loadListStats = async () => {
    setLoading(true);
    const listsWithStats: WordListWithStats[] = [];

    for (const list of WORD_LISTS) {
      const wordCount = await getWordCountByTag(list.tag);
      listsWithStats.push({
        ...list,
        wordCount,
        progress: listProgress[list.id],
      });
    }

    setLists(listsWithStats);
    setLoading(false);
  };

  const handleSelectList = async (listId: string) => {
    await switchList(listId);
    unlockAudio();
    startLearning();
    onClose();
  };

  const formatProgress = (progress?: ProgressData, wordCount: number = 0) => {
    if (!progress || progress.currentIndex === 0) {
      return '未开始';
    }
    const percentage = wordCount > 0 ? ((progress.currentIndex + 1) / wordCount * 100).toFixed(0) : '0';
    return `第 ${progress.currentRound} 轮 · ${percentage}%`;
  };

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>选择词表</DrawerTitle>
        </DrawerHeader>

        <div className="px-4 space-y-3 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              加载中...
            </div>
          ) : (
            lists.map((list) => {
              const percentage = list.wordCount > 0
                ? ((list.progress?.currentIndex || 0) + 1) / list.wordCount * 100
                : 0;

              return (
                <button
                  key={list.id}
                  onClick={() => handleSelectList(list.id)}
                  className="w-full text-left p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors border border-white/5 active:scale-[0.98]"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold text-foreground">{list.name}</h3>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {list.wordCount.toLocaleString()} 词
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                      {formatProgress(list.progress, list.wordCount)}
                    </span>
                  </div>
                  {list.progress && list.progress.currentIndex > 0 && (
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-2">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-indigo-400 transition-all duration-500 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>

        <DrawerFooter>
          <DrawerClose>
            <Button variant="ghost" className="w-full">取消</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add src/components/WordListSelect.tsx
git commit -m "feat(ui): add word list selection page

- Display all word lists with word counts
- Show progress per list (round, percentage)
- Click to select list and start learning
- Use Drawer for mobile-friendly UI

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: 更新进度条显示当前词表

**Files:**
- Modify: `src/components/ProgressBar.tsx`

**Interfaces:**
- Consumes: `currentList`, `listTotalWords`
- Produces: 显示词表名称的进度条

- [ ] **Step 1: 修改 ProgressBar 组件**

修改 `src/components/ProgressBar.tsx`：

```typescript
import { useAppStore } from '../store/useAppStore';
import { getWordListById } from '../config/wordLists';

export function ProgressBar() {
  const { currentList, currentIndex, totalWords, listTotalWords, currentRound, completedRounds } = useAppStore();

  // Get list name
  const wordList = currentList !== 'all' ? getWordListById(currentList) : null;
  const listName = wordList?.name || '全部单词';

  // Use listTotalWords for percentage when in a specific list
  const effectiveTotal = currentList === 'all' ? totalWords : listTotalWords;
  const percentage = effectiveTotal > 0 ? ((currentIndex + 1) / effectiveTotal) * 100 : 0;

  return (
    <div className="w-full px-4 py-3 bg-background/80 backdrop-blur-sm border-b border-white/5">
      <div className="max-w-[480px] mx-auto">
        {/* List name and round */}
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-semibold text-foreground">
            {listName}
          </span>
          <span className="text-xs text-muted-foreground">
            第 {currentRound} 轮
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-indigo-400 transition-all duration-500 rounded-full progress-glow"
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* Count */}
        <div className="flex justify-between items-center mt-1">
          <span className="text-xs text-muted-foreground">
            {currentIndex + 1} / {effectiveTotal}
          </span>
          {completedRounds > 0 && (
            <span className="text-xs text-primary">
              已完成 {completedRounds} 轮
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add src/components/ProgressBar.tsx
git commit -m "feat(progress): show current word list name in progress bar

- Display list name instead of generic title
- Use listTotalWords for progress calculation
- Show completed rounds

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Phase 4: 朗读增强

### Task 10: 实现读中文释义功能

**Files:**
- Modify: `src/hooks/useTTS.ts`
- Modify: `src/components/SettingsModal.tsx`

**Interfaces:**
- Consumes: `Settings.readDefinition`
- Produces: `useAutoPlay` 支持读释义序列

- [ ] **Step 1: 改造 useAutoPlay hook**

修改 `src/hooks/useTTS.ts` 中的 `useAutoPlay` 函数：

找到 `playCurrentWord` 函数，修改为：

```typescript
const playCurrentWord = async () => {
  const state = useAppStore.getState();
  const settings = state.settings;

  // 1. 读单词（真实人声优先）
  const success = await speak(currentWord.word, settings.accent, settings.speechRate || 1.0);

  if (!isActive) return;

  if (!success) {
    // If speech failed (e.g. autoplay blocked or cancelled), stop playing
    console.warn('[AutoPlay] Speech failed, stopping playback');
    useAppStore.setState({ isPlaying: false });
    return;
  }

  // 2. 稍微停顿
  await new Promise(r => setTimeout(r, 300));
  if (!isActive) return;

  const currentSettings = useAppStore.getState().settings;

  // 3. 如果开启了读释义，读中文释义
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

  // 4. 如果开启了自动读例句，并且有例句，则读英文例句
  if (currentSettings.readExample && currentWord.example) {
    const exampleSuccess = await speak(currentWord.example, currentSettings.accent, currentSettings.speechRate || 1.0);
    if (!isActive) return;
    if (!exampleSuccess) {
      console.warn('[AutoPlay] Example speech failed, but continuing to next word');
    }
    await new Promise(r => setTimeout(r, 500));
  }

  // 5. 等待用户设置的间隔后切换下一个
  timeoutId = setTimeout(() => {
    if (isActive) {
      const stillPlaying = useAppStore.getState().isPlaying;
      if (stillPlaying) {
        nextWord();
      }
    }
  }, currentSettings.speed * 1000);
};
```

- [ ] **Step 2: 在设置页面添加读释义开关**

修改 `src/components/SettingsModal.tsx`，在 `readExample` 设置项之前添加 `readDefinition` 设置项：

在 `return (` 语句后的 `DrawerContent` 内，找到"自动朗读例句"设置项（约第 148-169 行），在其前面添加：

```typescript
{/* 朗读中文释义 */}
<div>
  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
    朗读中文释义
  </label>
  <div className="grid grid-cols-2 gap-3">
    <Button
      variant={!settings.readDefinition ? 'default' : 'outline'}
      onClick={() => onUpdateSettings({ readDefinition: false })}
      className="font-medium"
    >
      关闭
    </Button>
    <Button
      variant={settings.readDefinition ? 'default' : 'outline'}
      onClick={() => onUpdateSettings({ readDefinition: true })}
      className="font-medium"
    >
      开启
    </Button>
  </div>
  <p className="text-xs text-muted-foreground mt-2">
    开启后：单词 → 中文释义
  </p>
</div>
```

- [ ] **Step 3: 手动测试**

运行 `npm run dev`，测试：
1. 进入设置，开启"朗读中文释义"
2. 开始自动朗读
3. 确认朗读序列为：单词 → 中文释义
4. 同时开启"朗读中文释义"和"朗读例句"
5. 确认朗读序列为：单词 → 中文释义 → 例句

- [ ] **Step 4: 提交**

```bash
git add src/hooks/useTTS.ts src/components/SettingsModal.tsx
git commit -m "feat(tts): add read Chinese definition option

- Add readDefinition to Settings
- Update useAutoPlay to speak definition after word
- Add toggle in settings modal
- Support sequence: word → definition → example

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 11: 端到端测试和最终调整

**Files:**
- 无新增，运行测试

**测试清单：**

- [ ] **Step 1: 功能测试**

运行 `npm run dev`，逐一测试：

1. **Bug 修复验证**
   - [ ] 长单词（如 "electroencephalogram"）显示正常
   - [ ] 字母 g、y、p 下缘完整显示
   - [ ] 播放时屏幕保持常亮（等待 2+ 分钟）

2. **词表系统**
   - [ ] 首页显示双入口
   - [ ] 点击"快速开始"进入全部单词学习
   - [ ] 点击"按词表学习"打开词表选择页
   - [ ] 词表选择页显示所有词表及词数
   - [ ] 选择词表后进入学习页面
   - [ ] 进度条显示词表名称
   - [ ] 切换词表后进度独立保存

3. **朗读增强**
   - [ ] 设置页面显示"朗读中文释义"开关
   - [ ] 开关功能正常
   - [ ] 朗读序列符合预期

4. **已掌握单词**
   - [ ] 在某词表中标记已掌握
   - [ ] 切换到其他词表，该单词仍被跳过

- [ ] **Step 2: 数据迁移测试**

1. 清除 localStorage
2. 使用旧版本数据格式（仅 vocab_progress）
3. 刷新页面
4. 确认数据正常迁移，默认 currentList 为 'all'

- [ ] **Step 3: 构建测试**

```bash
npm run build
```

确认构建成功无报错。

- [ ] **Step 4: 最终提交**

```bash
git add -A
git commit -m "feat: complete word list system and TTS enhancement

- Fix long word overflow and letter clipping
- Add Wake Lock for screen awake during playback
- Implement word list system with 8 predefined lists
- Add dual-entry home page design
- Add read Chinese definition option
- Maintain backward compatibility

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## 实现总结

**已实现功能：**
1. ✅ 长单词溢出修复
2. ✅ 字母底部裁剪修复
3. ✅ Wake Lock 屏幕常亮
4. ✅ 词表配置和索引
5. ✅ 词表进度独立存储
6. ✅ 词表切换功能
7. ✅ 首页双入口设计
8. ✅ 词表选择页面
9. ✅ 进度条显示词表名称
10. ✅ 读中文释义功能

**向后兼容性：**
- 现有用户数据自动迁移
- 默认 currentList 为 'all'
- 已掌握单词全局生效