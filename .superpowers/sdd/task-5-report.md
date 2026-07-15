# Task 5 Report: 扩展存储层支持词表进度

## Changes Made

Added 6 new exported functions to `src/utils/storage.ts` for per-word-list progress storage:

| Function | Purpose |
|----------|---------|
| `getCurrentList()` | Get current word list ID, returns `'all'` if not set (backward compatible) |
| `saveCurrentList(listId)` | Save current word list ID |
| `getListProgress()` | Get progress for all word lists as `Record<string, ProgressData>` |
| `saveListProgress(progress)` | Save full progress map for all word lists |
| `getListProgressById(listId)` | Get progress for a specific word list, returns `undefined` if not found |
| `saveListProgressById(listId, progress)` | Save progress for a specific word list (read-modify-write on the full map) |

New localStorage keys:
- `vocab_current_list` - stores the current list ID
- `vocab_list_progress` - stores the per-list progress map as JSON

The `ProgressData` type was already imported from `../types/word`, no import changes needed.

## Test Results

- **TypeScript check** (`tsc --noEmit`): Passed with no errors
- **Production build** (`npm run build`): Passed successfully (4.34s, 1983 modules)

## Files Changed

- `src/utils/storage.ts` - Added 62 lines (6 new exported functions + 2 const keys + JSDoc comments)

## Self-Review Findings

1. **Backward compatibility**: `getCurrentList()` returns `'all'` when no list ID is stored, matching the existing behavior where all words are shown by default.
2. **Error handling**: `getListProgress()` uses try/catch for JSON parsing, returning `{}` on failure - consistent with the existing `storage` object pattern. However, `saveCurrentList()` and `saveListProgress()` do not wrap in try/catch, which differs from the existing `storage` object methods that do. This matches the task brief exactly but is a minor inconsistency.
3. **No existing code broken**: The new functions are standalone exports that don't modify the existing `storage` object. No existing consumers are affected.
4. **Type safety**: All functions use proper TypeScript types (`ProgressData`, `Record<string, ProgressData>`).

## Commit

- `ded7d11` - feat(storage): add word list progress storage

## Concerns

None significant. The minor inconsistency in error handling (new standalone functions lack try/catch while the `storage` object methods have it) matches the task brief specification exactly.
