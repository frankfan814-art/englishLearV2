# Task 4 Report: 实现词表索引构建

## Changes Made

Created `src/utils/wordListIndex.ts` with the following exports:

- `buildWordListIndex()`: Scans all 16,194 words via `dataLoader.getWord()`, builds a `Map<string, Set<number>>` mapping each tag to its word indexes. Caches result and deduplicates concurrent build calls.
- `getWordIndexesByTag(tag)`: Returns sorted array of word indexes for a given tag, or empty array if not found.
- `getWordCountByTag(tag)`: Returns count of words for a given tag.
- `clearWordListIndexCache()`: Clears cache for testing.

Key behaviors:
- Combined tags (e.g., "cet4 cet6 toefl") are split on whitespace; each sub-tag gets its own entry pointing to the word.
- Empty/missing tag maps to the empty string key `''` (for "other vocabulary").
- Build is guarded against concurrent calls via `indexBuildPromise`.
- Errors loading individual words are caught and logged, not fatal.

## Test Results

- **TypeScript check** (`tsc --noEmit`): Passed with no errors.
- **Vite build** (`npm run build`): Passed. Output: `index-BIwhNQEO.js` (315.42 kB / 100.33 kB gzip).

## Files Changed

- **Created**: `src/utils/wordListIndex.ts` (99 lines)

## Self-Review Findings

1. **Performance concern**: The build iterates all 16,194 words sequentially via `dataLoader.getWord()`, which loads shards one at a time. Since `dataLoader` caches shards, the actual network fetches are only 17 (one per shard), but the sequential `await` in the loop means each word lookup waits for the previous one. This is acceptable for a one-time initialization but could be optimized later by loading all shards in parallel first, then iterating the cached data.

2. **Hardcoded total**: `const totalWords = 16194` is hardcoded. If the word database changes size, this constant must be updated. The `dataLoader` does not expose a total count constant. This matches the brief exactly but is a maintenance risk.

3. **Module-level mutable state**: `wordListIndexCache` and `indexBuildPromise` are module-level variables. This is fine for a singleton pattern but makes testing slightly harder (hence `clearWordListIndexCache()`).

4. **No runtime test yet**: The module compiles and builds correctly but has not been exercised at runtime since no consumer calls it yet. This is expected per the task description.

## Commit

- `5ecd126` feat(index): add word list index builder

## Issues or Concerns

None blocking. The performance note above is a future optimization opportunity, not a current problem.
