# Task 5 Report: 首页 UI 添加语言 Tab 切换

## Status: Complete

## Changes Made

### `src/components/Home.tsx`
- Added imports: `LANGUAGES`, `getLanguageInfo` from `../config/wordLists`, `getTotalWords` from `../utils/languageRegistry`
- Updated store destructuring to include `currentLanguage` and `switchLanguage`
- Changed `totalWords` from store value to computed via `getTotalWords(currentLanguage)`
- Added division-by-zero guard for `percentage` calculation
- Updated `handleQuickStart` to use `{currentLanguage}_all` list ID (e.g., `en_all`, `ja_all`) instead of hardcoded `'all'`
- Added Language Tab Bar UI between subtitle and Quick Start button with:
  - One tab per language in `LANGUAGES` array (en, ja, ko, de)
  - Active tab styled with `bg-primary text-primary-foreground shadow-lg`
  - Inactive tabs with hover effects
  - Each tab shows flag emoji + language name
  - Clicking a different tab calls `switchLanguage(lang.code)`

### `src/components/WordListSelect.tsx`
- Added import: `getTotalWords` from `../utils/languageRegistry`
- Added `currentLanguage` to store destructuring
- Added `currentLanguage` to `useEffect` dependency array so list refreshes on language change
- Modified `loadListStats` to:
  - Get `currentLanguage` from store state
  - Filter `WORD_LISTS` by `list.language === currentLanguage`
  - Use `getTotalWords(currentLanguage)` for `tag === '*'` lists instead of `getWordCountByTag`
  - Pass `currentLanguage` as second argument to `getWordCountByTag(list.tag, currentLanguage)`
  - Sort results by list ID for consistent ordering

## Build Result
- `npm run build` passed successfully (TypeScript + Vite build)
- Minor warning about mixed static/dynamic import of `wordListIndex.ts` (pre-existing, not introduced by this change)

## Commit
- `7e73514` on branch `multilang-support`
