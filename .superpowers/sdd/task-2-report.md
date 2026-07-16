# Task 2 Report

## Status: DONE

## Changes Made
- `src/types/word.ts`: Added `DataLoaderConfig` interface with basePath, shardSize, totalShards, filePattern, lastShardSize fields
- `src/utils/dataLoader.ts`: Refactored from singleton to instantiable class accepting `DataLoaderConfig`; added `getTotalWords()` method; preserved backward-compatible `dataLoader` export (marked @deprecated)
- `src/utils/languageRegistry.ts`: Created new file with `LANGUAGE_CONFIGS` (Record<string, DataLoaderConfig>), `getDataLoader()`, and `getTotalWords()` functions
- `src/config/wordLists.ts`: Added `TTSConfig`, `Language` interfaces; added `LANGUAGES` array with en/ja/ko/de entries; added `en_all`, `ja_all`, `ko_all`, `de_all` word list entries; added `getListsByLanguage()` and `getLanguageInfo()` exports

## Commits
aacd847

## Test Results
- npm run build: PASS (tsc + vite build succeeded, no type errors)

## Self-Review
- [x] Spec compliance: all requirements met
- [x] No unnecessary code added
- [x] Types correct
- [x] Backward compatible (dataLoader singleton export preserved, Settings.accent unchanged)

## Concerns
- Vite build warnings about mixed static/dynamic imports for wordLists.ts and wordListIndex.ts — pre-existing, not introduced by this task
