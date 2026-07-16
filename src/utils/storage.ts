import { Settings, ProgressData } from '../types/word';

const STORAGE_KEYS = {
  PROGRESS: 'vocab_progress',
  SETTINGS: 'vocab_settings',
};

export const storage = {
  getProgress(): ProgressData {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PROGRESS);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.error('Failed to load progress:', e);
    }
    return {
      currentRound: 1,
      currentIndex: 0,
      completedRounds: 0,
      lastUpdate: new Date().toISOString(),
    };
  },

  saveProgress(progress: ProgressData): void {
    try {
      localStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify({
        ...progress,
        lastUpdate: new Date().toISOString(),
      }));
    } catch (e) {
      console.error('Failed to save progress:', e);
    }
  },

  getSettings(): Settings {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.error('Failed to load settings:', e);
    }
    return {
      speed: 0.5,
      speechRate: 1.0,
      readDefinition: false,
      readExample: false,
      accent: 'us',
      autoPlay: true,
    };
  },

  saveSettings(settings: Settings): void {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
  },

  resetProgress(): void {
    localStorage.removeItem(STORAGE_KEYS.PROGRESS);
  },

  getMasteredWords(): Record<number, { word: string; definition: string }> {
    try {
      const data = localStorage.getItem('vocab_mastered');
      if (data) return JSON.parse(data);
    } catch (e) {
      console.error('Failed to load mastered words:', e);
    }
    return {};
  },

  saveMasteredWords(words: Record<number, { word: string; definition: string }>): void {
    try {
      localStorage.setItem('vocab_mastered', JSON.stringify(words));
    } catch (e) {
      console.error('Failed to save mastered words:', e);
    }
  },
};

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

// === Language Storage ===

const KEY_CURRENT_LANGUAGE = 'vocab_current_language';

/**
 * Get current language code
 * Returns 'en' if not set (backward compatible)
 */
export function getCurrentLanguage(): string {
  return localStorage.getItem(KEY_CURRENT_LANGUAGE) || 'en';
}

/**
 * Save current language code
 */
export function saveCurrentLanguage(language: string): void {
  localStorage.setItem(KEY_CURRENT_LANGUAGE, language);
}