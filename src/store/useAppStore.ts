import { create } from 'zustand';
import { Word, Settings, ProgressData } from '../types/word';
import { storage, getCurrentList, getListProgress, saveCurrentList, saveListProgress, saveListProgressById } from '../utils/storage';
import { dataLoader } from '../utils/dataLoader';

interface AppState {
  // Word data
  currentWord: Word | null;
  isLoading: boolean;
  error: string | null;

  // Progress
  currentRound: number;
  currentIndex: number;
  completedRounds: number;
  totalWords: number;

  // Playback
  isPlaying: boolean;
  isLearningMode: boolean;

  // Settings
  settings: Settings;

  // Mastered
  masteredWords: Record<number, { word: string; definition: string }>;

  // Word list navigation
  language: string;
  currentList: string;
  listProgress: Record<string, ProgressData>;
  wordIndexesInList: number[];
  listTotalWords: number;

  // Actions
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
}

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

  // Word list navigation initial state
  language: 'en',
  currentList: getCurrentList(),
  listProgress: getListProgress(),
  wordIndexesInList: [],
  listTotalWords: 16194,

  // Initialize from storage
  initialize: async () => {
    const progress = storage.getProgress();
    const currentList = getCurrentList();
    const listProgress = getListProgress();

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

  // Load current word (delegates to loadListWord)
  loadCurrentWord: async () => {
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

  // Next word (within current list)
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
      saveListProgressById(currentList, progress);
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
      saveListProgressById(currentList, progress);
    }

    get().loadListWord();
  },

  // Toggle play/pause
  togglePlay: () => {
    const { settings, isPlaying } = get();
    const newIsPlaying = !isPlaying;
    set({ isPlaying: newIsPlaying });
    storage.saveSettings({ ...settings, autoPlay: newIsPlaying });
  },

  // Enter learning mode and start playing
  startLearning: () => {
    set({ isLearningMode: true, isPlaying: true });
    storage.saveSettings({ ...get().settings, autoPlay: true });
  },

  // Exit learning mode and stop playing
  quitLearning: () => {
    set({ isLearningMode: false, isPlaying: false });
  },

  // Update settings
  updateSettings: (newSettings) => {
    const updated = { ...get().settings, ...newSettings };
    set({ settings: updated });
    storage.saveSettings(updated);
  },

  // Reset progress
  resetProgress: () => {
    const { currentList, listProgress } = get();

    // Clear specific list progress
    const updatedListProgress = { ...listProgress };
    if (currentList === 'all') {
      storage.resetProgress();
    } else {
      delete updatedListProgress[currentList];
    }
    // Also clear any saved list progress
    saveListProgress(updatedListProgress);

    set({
      currentRound: 1,
      currentIndex: 0,
      completedRounds: 0,
      listProgress: updatedListProgress,
    });
    get().loadListWord();
  },

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

  // Unmark word as mastered (restore)
  unmarkMastered: (index: number) => {
    const { masteredWords } = get();
    const newMastered = { ...masteredWords };
    delete newMastered[index];

    set({ masteredWords: newMastered });
    storage.saveMasteredWords(newMastered);
  },

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
    let newWordIndexesInList: number[];
    let newListTotalWords: number;

    if (listId === 'all') {
      newWordIndexesInList = Array.from({ length: 16194 }, (_, i) => i);
      newListTotalWords = 16194;
    } else {
      const { getWordIndexesByTag } = await import('../utils/wordListIndex');
      const { getWordListById } = await import('../config/wordLists');
      const wordList = getWordListById(listId);

      if (!wordList) {
        console.error(`Word list not found: ${listId}`);
        return;
      }

      newWordIndexesInList = await getWordIndexesByTag(wordList.tag);
      newListTotalWords = newWordIndexesInList.length;
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
      wordIndexesInList: newWordIndexesInList,
      listTotalWords: newListTotalWords,
      currentRound: targetProgress.currentRound,
      currentIndex: targetProgress.currentIndex,
      completedRounds: targetProgress.completedRounds,
      listProgress: updatedListProgress,
      isLoading: true,
    });

    // Save to storage
    saveCurrentList(listId);
    saveListProgress(updatedListProgress);

    // Load current word
    await get().loadListWord();
  },
}));