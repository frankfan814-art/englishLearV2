# Task 5 Brief: 扩展存储层支持词表进度

## Files
- Modify: `src/utils/storage.ts`

## Interfaces
- Consumes: `ProgressData` type
- Produces: `getCurrentList()`, `saveCurrentList()`, `getListProgress()`, `saveListProgress()`

## Requirements

### Step 1: 扩展 storage.ts

在 `src/utils/storage.ts` 文件末尾添加：

```typescript
// === Word List Progress Storage ===

const KEY_CURRENT_LIST = 'vocab_current_list';
const KEY_LIST_PROGRESS = 'vocab_list_progress';

/**
 * Get current word list ID
 * Returns 'all' if not set (backward compatible)
 */
export function getCurrentList(): string {
  const stored = localStorage.getItem(KEY_CURRENT_LIST);
  return stored || 'all';
}

/**
 * Save current word list ID
 */
export function saveCurrentList(listId: string): void {
  localStorage.setItem(KEY_CURRENT_LIST, listId);
}

/**
 * Get progress for all word lists
 */
export function getListProgress(): Record<string, ProgressData> {
  const stored = localStorage.getItem(KEY_LIST_PROGRESS);
  if (!stored) {
    return {};
  }
  try {
    return JSON.parse(stored);
  } catch {
    return {};
  }
}

/**
 * Save progress for a specific word list
 */
export function saveListProgress(progress: Record<string, ProgressData>): void {
  localStorage.setItem(KEY_LIST_PROGRESS, JSON.stringify(progress));
}

/**
 * Get progress for a specific word list
 * Returns undefined if not found
 */
export function getListProgressById(listId: string): ProgressData | undefined {
  const allProgress = getListProgress();
  return allProgress[listId];
}

/**
 * Save progress for a specific word list
 */
export function saveListProgressById(listId: string, progress: ProgressData): void {
  const allProgress = getListProgress();
  allProgress[listId] = progress;
  saveListProgress(allProgress);
}
```

### Step 2: 提交

```bash
git add src/utils/storage.ts
git commit -m "feat(storage): add word list progress storage

- Store current list ID (default: 'all')
- Store progress per list independently
- Backward compatible with existing data

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

## Report Contract

After completing the task, write a report to `E:/work/englishLearn/.superpowers/sdd/task-5-report.md` with:
1. Changes made
2. Test results (TypeScript check, build)
3. Any concerns or issues encountered
4. Commit hash

Then report status: DONE, DONE_WITH_CONCERNS, NEEDS_CONTEXT, or BLOCKED