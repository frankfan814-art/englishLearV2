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