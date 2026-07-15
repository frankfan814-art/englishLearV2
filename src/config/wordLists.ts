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
