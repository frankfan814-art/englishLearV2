# Task 6 Brief: 扩展 Store 支持词表切换

## Files
- Modify: `src/store/useAppStore.ts`

## Interfaces
- Consumes: `wordListIndex` functions, `storage` functions, `WORD_LISTS`
- Produces: `language`, `currentList`, `listProgress`, `wordIndexesInList`, `listTotalWords`, `switchList()`, `loadListWord()`

## Requirements

### Step 1: 扩展 AppState 接口

在 `AppState` 接口中添加新状态和 actions：

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

### Step 2: 更新初始状态和 initialize 函数

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

### Step 3: 更新 nextWord 和 prevWord 函数

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

### Step 4: 添加 switchList 和 loadListWord 函数

添加新的 actions：

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

### Step 5: 更新 markMastered 函数

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

### Step 6: 提交

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

## Report Contract

After completing the task, write a report to `E:/work/englishLearn/.superpowers/sdd/task-6-report.md` with:
1. Changes made
2. Test results (TypeScript check, build)
3. Any concerns or issues encountered
4. Commit hash

Then report status: DONE, DONE_WITH_CONCERNS, NEEDS_CONTEXT, or BLOCKED