# Task 7 & 8 Report: Dual-Entry Home + Word List Select

## What Was Implemented

### Task 8: WordListSelect Component
- Created `src/components/WordListSelect.tsx` - a Drawer-based bottom sheet for selecting word lists
- Loads word counts for each list on open via `getWordCountByTag()`
- Shows progress (round, percentage) for each list from `listProgress` store state
- Clicking a list calls `switchList(listId)`, `unlockAudio()`, `startLearning()`, then closes the drawer
- Displays 8 word lists: TOEFL, GRE, CET-6, 考研, IELTS, CET-4, 高考, 其他
- Shows a loading state while word counts are being fetched
- Progress bar shown for lists with started progress

### Task 7: Home Page Dual-Entry Design
- Modified `src/components/Home.tsx` with two entry buttons
- "快速开始" (Quick Start) button: calls `switchList('all')` then `unlockAudio()` then `startLearning()`
- "按词表学习" (Select Word List) button: opens the WordListSelect drawer
- Progress stats section moved below the buttons
- Uses `totalWords` (global total) instead of `listTotalWords` for the progress display on home page
- WordListSelect drawer rendered at bottom of component

## Test Results

- **TypeScript check**: Passed (no errors)
- **Production build**: Passed (built in 4.37s)
- **Build warnings**: 2 non-blocking warnings about mixed static/dynamic imports for `wordLists.ts` and `wordListIndex.ts` (these modules are dynamically imported in useAppStore.ts but statically imported in WordListSelect.tsx - this is a pre-existing pattern and does not affect functionality)
- **ESLint**: Not configured (no eslint.config.js file exists - pre-existing issue, not introduced by this change)

## Files Changed

1. `src/components/WordListSelect.tsx` - **Created** (127 lines)
2. `src/components/Home.tsx` - **Modified** (replaced single "开始学习" button with dual-entry design)

## Self-Review Findings

1. **Progress display uses `totalWords` instead of `listTotalWords`**: The brief specifies `totalWords` for the home page progress display. This shows the global word count (16,194) rather than the current list's word count. This is intentional per the brief - the home page shows overall progress, while the WordListSelect shows per-list progress.

2. **`loadListStats` not in useEffect dependency array**: The `loadListStats` function is called inside useEffect but not included in the dependency array. This is acceptable because `loadListStats` reads `listProgress` from the store at call time (via `get()`), so it always gets fresh data when the drawer opens.

3. **Sequential word count loading**: `loadListStats` loads word counts sequentially (for loop with await). This could be parallelized with `Promise.all()`, but the brief code uses sequential loading, so it was implemented as specified. The word list index is cached after first build, so subsequent calls are fast.

4. **Mixed import pattern warning**: The Vite build warns about `wordLists.ts` and `wordListIndex.ts` being both statically and dynamically imported. This is a pre-existing pattern from the store's `switchList` method. The static import in WordListSelect is correct for the component's needs. No action needed.

5. **Drawer component API**: The Drawer uses `open`/`onOpenChange` props, which matches the existing pattern used in `MasteredList.tsx` and `SettingsModal.tsx`.

## Commit

- `c7dabcb` - feat(home): add dual-entry design with quick start and list select
