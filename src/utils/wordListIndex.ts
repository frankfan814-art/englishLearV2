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
