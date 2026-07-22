import { create } from 'zustand';
import { Word, Settings, ProgressData } from '../types/word';
import {
  storage, getCurrentList, getListProgress, saveCurrentList,
  saveListProgress, saveListProgressById, getCurrentLanguage, saveCurrentLanguage
} from '../utils/storage';
import { getDataLoader, getTotalWords } from '../utils/languageRegistry';
import { getListsByLanguage, getLanguageInfo, getWordListById } from '../config/wordLists';
import { TRIAL_WORD_LIMIT, LicenseState } from '../config/license';
import { activateLicense, getStoredLicense, isLicenseBypassed, validateLicenseOnStart } from '../utils/license';

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

  // Multi-language
  currentLanguage: string;
  wordIndexTotal: number;

  // 软件激活（云激活卡密制）
  licenseState: LicenseState;
  /** 启动时联网复核授权状态（被撤销则降级回试用） */
  initLicense: () => Promise<void>;
  /** 用卡密激活，成功后重载全量词库 */
  activateAndReload: (code: string) => Promise<{ ok: boolean; message: string }>;

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

export const useAppStore = create<AppState>((set, get) => {
  /** 试用模式截断：未激活时每个词表只开放前 TRIAL_WORD_LIMIT 词 */
  const applyTrialLimit = (indexes: number[]): number[] =>
    get().licenseState === 'trial' ? indexes.slice(0, TRIAL_WORD_LIMIT) : indexes;

  return {
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
  // 乐观取本地授权（启动后 initLicense 会联网复核，被撤销会降级回试用）
  licenseState: (isLicenseBypassed() || getStoredLicense()) ? 'active' : 'trial',

  initLicense: async () => {
    const state = await validateLicenseOnStart();
    if (state !== get().licenseState) {
      set({ licenseState: state });
      // 授权状态变化 → 重新加载词表，应用或解除试用截断
      await get().initialize();
    }
  },

  activateAndReload: async (code) => {
    const result = await activateLicense(code);
    if (result.ok) {
      set({ licenseState: 'active' });
      await get().initialize();
    }
    return result;
  },

  initialize: async () => {
    const currentLanguage = getCurrentLanguage();
    const currentList = getCurrentList();
    const listProgress = getListProgress();
    const totalWords = getTotalWords(currentLanguage);

    // 进度恢复：旧版 'all' 词表读全局 vocab_progress；各语言"全部单词"等词表读各自的 listProgress，
    // 避免不同语言共用一份全局进度互相覆盖。某语言"全部单词"首次无独立进度时，
    // 若旧版全局进度在该语言词数范围内则迁移一次（老用户进度不丢失）
    const legacyProgress = storage.getProgress();
    const progress = currentList === 'all'
      ? legacyProgress
      : (listProgress[currentList]
          ?? (currentList === `${currentLanguage}_all` && legacyProgress.currentIndex < totalWords ? legacyProgress : undefined)
          ?? { currentRound: 1, currentIndex: 0, completedRounds: 0, lastUpdate: new Date().toISOString() });

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

    // Load word indexes for current list（试用模式下截断为前 TRIAL_WORD_LIMIT 词）
    if (currentList === 'all' || currentList === `${currentLanguage}_all`) {
      const indexes = applyTrialLimit(Array.from({ length: totalWords }, (_, i) => i));
      set({
        wordIndexesInList: indexes,
        listTotalWords: indexes.length,
      });
    } else {
      const { getWordIndexesByTag } = await import('../utils/wordListIndex');
      const wordList = getWordListById(currentList);

      if (wordList) {
        const rawIndexes = await getWordIndexesByTag(wordList.tag, currentLanguage);
        const indexes = applyTrialLimit(rawIndexes);
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

    // 词库数据可能变化（如词数减少），索引越界时回退到有效范围内
    let safeIndex = currentIndex;
    if (safeIndex >= wordIndexesInList.length) {
      safeIndex = wordIndexesInList.length - 1;
      set({ currentIndex: safeIndex });
    }

    set({ isLoading: true, error: null });

    try {
      const globalIndex = wordIndexesInList[safeIndex];
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

    if (currentList === 'all') {
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

    if (currentList === 'all') {
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
    if (currentList === 'all') {
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

    // 试用模式截断（已激活时原样返回）
    newWordIndexesInList = applyTrialLimit(newWordIndexesInList);
    newListTotalWords = newWordIndexesInList.length;

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

    const langIndexes = applyTrialLimit(Array.from({ length: totalWords }, (_, i) => i));

    set({
      currentLanguage: lang,
      currentList: defaultListId,
      wordIndexesInList: langIndexes,
      listTotalWords: langIndexes.length,
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
  };
});
