# Task 4 Report: TTS 多语言发音支持

## Status: DONE

## Changes Made

**File modified**: `src/hooks/useTTS.ts`

### 1. Added `speakByLanguage` method

New method with signature `(speakId, text, language, accent, rate) => Promise<boolean>`:
- Uses `getLanguageInfo(language)` to look up TTS config
- If `ttsConfig.mode === 'youdao'` (English), routes to `speakRealAudio` (Youdao API)
- Otherwise, routes to `speakTTS` with `ttsConfig.webspeechLang` (e.g., `ja-JP`, `ko-KR`, `de-DE`)
- Unknown language falls back to Web Speech with `en-US`

### 2. Modified `useAutoPlay` to use `speakByLanguage`

- Word pronunciation: `speakByLanguage(speakId, word, currentLanguage, accent, rate)` instead of `speak(word, accent, rate)`
- Example sentence: `speakByLanguage(speakId, example, currentLanguage, accent, rate)` instead of `speak(example, accent, rate)`
- Reads `currentLanguage` from `useAppStore.getState()` inside `playCurrentWord`
- Updated effect dependencies: replaced `speak` with `speakByLanguage`

### 3. Preserved `speak()` function

The original `speak()` function remains unchanged for backward compatibility (used by WordCard for manual speak button).

### 4. Fixed TS6133 error

Removed unused `speak` destructuring in `useAutoPlay` since it now uses `speakByLanguage` exclusively.

## Build Verification

`npm run build` passes with no TypeScript errors.

## Commit

`2cf8577` on branch `multilang-support`
