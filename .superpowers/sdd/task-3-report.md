# Task 3 Report: Store 增加多语言状态和 switchLanguage

## Status: DONE

## Changes Made

### 1. src/utils/storage.ts
- Added `getCurrentLanguage()` function - reads from localStorage, defaults to 'en'
- Added `saveCurrentLanguage(language: string)` function - persists language selection
- Uses storage key `vocab_current_language`

### 2. src/utils/wordListIndex.ts
- Refactored to support per-language index building
- Changed `wordListIndexCache` from single Map to `Map<string, Map<string, Set<number>>>` (language -> tag -> indexes)
- Changed `indexBuildPromises` to `Map<string, Promise<...>>` for per-language build tracking
- Updated `buildWordListIndex(language: string = 'en')` to accept language parameter
- Updated `getWordIndexesByTag(tag, language)` to accept language parameter
- Updated `getWordCountByTag(tag, language)` to accept language parameter
- Updated `clearWordListIndexCache(language?)` to optionally clear specific language cache

### 3. src/store/useAppStore.ts
- Added `currentLanguage: string` state (persisted via getCurrentLanguage())
- Added `wordIndexTotal: number` state
- Added `switchLanguage(lang: string)` action that:
  - Saves current list progress
  - Gets default list for new language (finds `{lang}_all` or first list)
  - Updates accent to language default (e.g., 'ja-JP' for Japanese)
  - Builds word list index for new language
  - Resets to default list with fresh progress
  - Persists language selection to storage
- Modified `initialize` to restore language and use language-specific DataLoader
- Modified `switchList` to handle language-aware word list lookup
- Modified `loadListWord` to use `getDataLoader(currentLanguage)`
- Updated progress saving to handle `{language}_all` format for default lists

### 4. src/types/word.ts
- Changed `Settings.accent` from `'us' | 'uk'` to `string` to support multi-language accents (e.g., 'ja-JP', 'ko-KR', 'de-DE')

### 5. src/hooks/useTTS.ts
- Updated `speak` function to handle both Youdao-supported accents ('us'/'uk') and Web Speech API accents
- For 'us'/'uk', uses Youdao API with TTS fallback
- For other accents, uses Web Speech API directly

### 6. src/components/WordCard.tsx
- Changed `accent` prop type from `'us' | 'uk'` to `string`
- Updated display to show accent in uppercase format (e.g., 'JA-JP', 'KO-KR')

## Commits
f865d77 feat: Store 增加多语言状态和 switchLanguage

## Test Results
- npm run build: PASS

## Self-Review
- [x] Spec compliance: all requirements met
- [x] No unnecessary code added
- [x] Types correct
- [x] Backward compatible (defaults to 'en' language, existing storage keys preserved)

## Concerns
None. The implementation follows the task brief exactly and is backward compatible with existing English-only usage.
