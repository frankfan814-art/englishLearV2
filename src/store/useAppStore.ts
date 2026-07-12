import { create } from 'zustand';
import { Word, Settings } from '../types/word';
import { storage } from '../utils/storage';
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

  // Initialize from storage
  initialize: async () => {
    const progress = storage.getProgress();
    set({
      currentRound: progress.currentRound,
      currentIndex: progress.currentIndex,
      completedRounds: progress.completedRounds,
      settings: storage.getSettings(),
      masteredWords: storage.getMasteredWords(),
      isLoading: true,
    });

    await get().loadCurrentWord();
  },

  // Load current word
  loadCurrentWord: async () => {
    const { currentIndex } = get();
    set({ isLoading: true, error: null });

    try {
      const word = await dataLoader.getWord(currentIndex);
      if (word) {
        set({ currentWord: word, isLoading: false });
        // Preload adjacent shards
        dataLoader.preloadAdjacent(currentIndex);
      } else {
        set({ error: 'Word not found', isLoading: false });
      }
    } catch (err) {
      set({ error: 'Failed to load word', isLoading: false });
    }
  },

  // Next word
  nextWord: () => {
    const { currentIndex, currentRound, totalWords, masteredWords } = get();
    let newIndex = currentIndex;
    let newRound = currentRound;
    let newCompletedRounds = get().completedRounds;
    
    // Prevent infinite loop if all words are mastered
    let attempts = 0;
    do {
      newIndex += 1;
      if (newIndex >= totalWords) {
        newIndex = 0;
        newCompletedRounds += 1;
        newRound += 1;
      }
      attempts++;
    } while (masteredWords[newIndex] !== undefined && attempts < totalWords);

    set({
      currentIndex: newIndex,
      currentRound: newRound,
      completedRounds: newCompletedRounds,
    });

    // Save progress
    storage.saveProgress({
      currentRound: newRound,
      currentIndex: newIndex,
      completedRounds: newCompletedRounds,
      lastUpdate: new Date().toISOString(),
    });

    get().loadCurrentWord();
  },

  // Previous word
  prevWord: () => {
    const { currentIndex, currentRound, totalWords, completedRounds, masteredWords } = get();
    let newIndex = currentIndex;
    let newRound = currentRound;
    let newCompletedRounds = completedRounds;

    let attempts = 0;
    do {
      newIndex -= 1;
      if (newIndex < 0) {
        newIndex = totalWords - 1;
        newRound = Math.max(1, currentRound - 1);
        newCompletedRounds = Math.max(0, completedRounds - 1);
      }
      attempts++;
    } while (masteredWords[newIndex] !== undefined && attempts < totalWords);

    set({
      currentIndex: newIndex,
      currentRound: newRound,
      completedRounds: newCompletedRounds,
    });

    storage.saveProgress({
      currentRound: newRound,
      currentIndex: newIndex,
      completedRounds: newCompletedRounds,
      lastUpdate: new Date().toISOString(),
    });

    get().loadCurrentWord();
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
    storage.resetProgress();
    set({
      currentRound: 1,
      currentIndex: 0,
      completedRounds: 0,
    });
    get().loadCurrentWord();
  },

  // Mark current word as mastered
  markMastered: () => {
    const { currentWord, currentIndex, masteredWords } = get();
    if (!currentWord) return;

    const cleanDef = currentWord.definition.replace(/^[a-z]+\.\s*/i, '').trim();
    const newMastered = { ...masteredWords, [currentIndex]: { word: currentWord.word, definition: cleanDef } };
    
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
}));