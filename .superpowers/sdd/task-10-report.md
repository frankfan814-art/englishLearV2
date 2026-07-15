# Task 10 Report: 实现读中文释义功能

## Changes Made

### 1. `src/hooks/useTTS.ts`
- Added `speakChinese` to the destructured imports from `useTTS()` in `useAutoPlay`
- Modified `playCurrentWord` to insert a Chinese definition reading step between the word and example steps:
  - Step 1: Read the English word (unchanged)
  - Step 2: Short pause (changed from 500ms to 300ms per brief)
  - Step 3 (NEW): If `readDefinition` is enabled and the word has a definition, strip the POS prefix (e.g. "n.", "v.") and speak the Chinese definition via `speakChinese()`, followed by a 300ms pause
  - Step 4: If `readExample` is enabled, read the example sentence (unchanged logic, added 500ms pause after)
  - Step 5: Wait for user-configured interval then advance to next word (unchanged)

### 2. `src/components/SettingsModal.tsx`
- Added a "朗读中文释义" toggle section before the "自动朗读例句" section
- Toggle uses the same grid-cols-2 button pattern as the existing readExample toggle
- Includes a hint text: "开启后：单词 → 中文释义"

## Test Results

- **TypeScript check** (`tsc --noEmit`): Passed with no errors
- **Full build** (`npm run build`): Passed successfully, output 323.80 kB JS + 34.23 kB CSS

## Files Changed

- `src/hooks/useTTS.ts` - Added speakChinese import, inserted definition reading step in playCurrentWord
- `src/components/SettingsModal.tsx` - Added readDefinition toggle UI

## Self-Review Findings

1. The definition text is cleaned by stripping the POS prefix (e.g., "n. 苹果" becomes "苹果") using regex `/^[a-z]+\.\s*/i` - this matches the brief specification.
2. The `speakChinese` function was already available in `useTTS` and uses Web Speech API with `zh-CN` locale.
3. The pause between word and definition is 300ms, and between definition and example is 300ms, matching the brief. The pause after the example is 500ms.
4. If definition speech fails, playback continues (non-fatal), matching the brief's approach.
5. The `readDefinition` field was already present in the `Settings` type (added in Task 3), so no type changes were needed.
6. The settings toggle follows the exact same UI pattern as the existing `readExample` toggle for consistency.

## Issues or Concerns

None. The implementation follows the brief exactly, TypeScript and build both pass cleanly.
