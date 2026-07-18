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

/** 各语言的品牌标识（logo 字符与副标题），用于首页与学习页 header */
export const LANGUAGE_BRAND: Record<string, { logo: string; subtitle: string }> = {
  en: { logo: 'E', subtitle: 'Vocab Master' },
  ja: { logo: '日', subtitle: '日本語マスター' },
  ko: { logo: '한', subtitle: '단어 마스터' },
  de: { logo: 'D', subtitle: 'Wortmeister' },
};

/**
 * Predefined word lists based on existing tag data
 * Words can belong to multiple lists (tags can be combined)
 */
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
  { id: 'jlpt_n5', name: 'JLPT N5', tag: 'jlpt_n5', language: 'ja' },
  { id: 'jlpt_n4', name: 'JLPT N4', tag: 'jlpt_n4', language: 'ja' },
  { id: 'jlpt_n3', name: 'JLPT N3', tag: 'jlpt_n3', language: 'ja' },
  { id: 'jlpt_n2', name: 'JLPT N2', tag: 'jlpt_n2', language: 'ja' },
  { id: 'jlpt_n1', name: 'JLPT N1', tag: 'jlpt_n1', language: 'ja' },
  // Korean
  { id: 'ko_all', name: '全部单词', tag: '*', language: 'ko' },
  // German
  { id: 'de_all', name: '全部单词', tag: '*', language: 'de' },
];

/**
 * Get word lists by language
 */
export function getListsByLanguage(language: string): WordList[] {
  return WORD_LISTS.filter(list => list.language === language);
}

/**
 * Get language info by code
 */
export function getLanguageInfo(code: string): Language | undefined {
  return LANGUAGES.find(lang => lang.code === code);
}

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
