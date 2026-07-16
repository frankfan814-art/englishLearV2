import { getDataLoader, getTotalWords } from './languageRegistry';

/**
 * Word list index for fast lookup
 * Maps tag -> Set of global word indexes
 * Cached per language
 */
let wordListIndexCache: Map<string, Map<string, Set<number>>> = new Map();
let indexBuildPromises: Map<string, Promise<Map<string, Set<number>>>> = new Map();

/**
 * Build word list index by scanning all words for a given language
 * Caches the result per language for subsequent calls
 */
export async function buildWordListIndex(language: string = 'en'): Promise<Map<string, Set<number>>> {
  if (wordListIndexCache.has(language)) {
    return wordListIndexCache.get(language)!;
  }

  if (indexBuildPromises.has(language)) {
    return indexBuildPromises.get(language)!;
  }

  const buildPromise = (async () => {
    const index = new Map<string, Set<number>>();
    const loader = getDataLoader(language);
    const totalWords = getTotalWords(language);

    for (let globalIndex = 0; globalIndex < totalWords; globalIndex++) {
      try {
        const word = await loader.getWord(globalIndex);
        if (word) {
          const tag = word.tag || '';
          if (tag === '') {
            if (!index.has('')) {
              index.set('', new Set());
            }
            index.get('')!.add(globalIndex);
          } else {
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
        console.error(`[${language}] Failed to load word at index ${globalIndex}:`, err);
      }
    }

    wordListIndexCache.set(language, index);
    indexBuildPromises.delete(language);
    return index;
  })();

  indexBuildPromises.set(language, buildPromise);
  return buildPromise;
}

/**
 * Get word indexes by tag for a given language
 * Returns empty array if tag not found
 */
export async function getWordIndexesByTag(tag: string, language: string = 'en'): Promise<number[]> {
  const index = await buildWordListIndex(language);
  const indexes = index.get(tag);

  if (!indexes) {
    return [];
  }

  return Array.from(indexes).sort((a, b) => a - b);
}

/**
 * Get word count by tag for a given language
 */
export async function getWordCountByTag(tag: string, language: string = 'en'): Promise<number> {
  const index = await buildWordListIndex(language);
  const indexes = index.get(tag);
  return indexes ? indexes.size : 0;
}

/**
 * Clear index cache (for testing)
 * If language is specified, only clear that language's cache
 */
export function clearWordListIndexCache(language?: string): void {
  if (language) {
    wordListIndexCache.delete(language);
    indexBuildPromises.delete(language);
  } else {
    wordListIndexCache.clear();
    indexBuildPromises.clear();
  }
}
