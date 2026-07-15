# Task 2 Report: Wake Lock 屏幕常亮

## Changes Made

1. **Created** `src/hooks/useWakeLock.ts` - New React hook implementing Screen Wake Lock API
   - Requests wake lock when `enabled` is true, releases when false
   - Uses `enabledRef` to track current enabled state without re-triggering effects
   - Re-acquires wake lock automatically when released while still enabled and page visible
   - Re-acquires wake lock on visibility change (tab switch back)
   - Graceful fallback: logs warning if browser doesn't support Wake Lock API

2. **Modified** `src/App.tsx` - Integrated useWakeLock hook
   - Added import: `import { useWakeLock } from './hooks/useWakeLock';`
   - Added call: `useWakeLock(isPlaying);` after `useAutoPlay()` in App component

## Test Results

- **TypeScript check** (`tsc --noEmit`): Passed with no errors
- **Production build** (`npm run build`): Passed successfully
  - Output: index.html (0.69 kB), CSS (34.02 kB), JS (315.42 kB / 100.33 kB gzip)

## Self-Review Findings

1. **Interaction with existing visibility handler**: App.tsx already has a `visibilitychange` listener (line 83-91) that sets `isPlaying = false` when the page is hidden. This means:
   - When user switches tabs: `isPlaying` becomes false -> `useWakeLock(false)` -> wake lock released
   - When user returns: `isPlaying` is still false -> wake lock NOT re-acquired
   - This is correct behavior: playback was paused on tab switch, so screen should not stay awake
   - The visibility re-acquire logic in useWakeLock handles the edge case where the wake lock is released by the browser (e.g., minimize) but `isPlaying` is still true

2. **WakeLockSentinel type**: TypeScript recognizes `WakeLockSentinel` as a global type (available in lib DOM), so no additional type declarations needed.

3. **No memory leaks**: All event listeners are properly cleaned up in effect cleanup functions. Wake lock is released on unmount.

4. **Error handling**: All `release()` calls use `.catch(() => {})` to prevent unhandled promise rejections. Wake lock request failures are logged as warnings.

## Commit

- `3077d40` - feat(wake-lock): keep screen awake during playback

## Concerns

None. The implementation follows the brief exactly and integrates cleanly with the existing codebase.
