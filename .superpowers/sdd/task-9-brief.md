# Task 9 Brief: 更新进度条显示当前词表

## Files
- Modify: `src/components/ProgressBar.tsx`

## Interfaces
- Consumes: `currentList`, `listTotalWords`
- Produces: 显示词表名称的进度条

## Requirements

### Step 1: 修改 ProgressBar 组件

完全替换 `src/components/ProgressBar.tsx` 内容：

```typescript
import { useAppStore } from '../store/useAppStore';
import { getWordListById } from '../config/wordLists';

export function ProgressBar() {
  const { currentList, currentIndex, totalWords, listTotalWords, currentRound, completedRounds } = useAppStore();

  // Get list name
  const wordList = currentList !== 'all' ? getWordListById(currentList) : null;
  const listName = wordList?.name || '全部单词';

  // Use listTotalWords for percentage when in a specific list
  const effectiveTotal = currentList === 'all' ? totalWords : listTotalWords;
  const percentage = effectiveTotal > 0 ? ((currentIndex + 1) / effectiveTotal) * 100 : 0;

  return (
    <div className="w-full px-4 py-3 bg-background/80 backdrop-blur-sm border-b border-white/5">
      <div className="max-w-[480px] mx-auto">
        {/* List name and round */}
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-semibold text-foreground">
            {listName}
          </span>
          <span className="text-xs text-muted-foreground">
            第 {currentRound} 轮
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-indigo-400 transition-all duration-500 rounded-full progress-glow"
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* Count */}
        <div className="flex justify-between items-center mt-1">
          <span className="text-xs text-muted-foreground">
            {currentIndex + 1} / {effectiveTotal}
          </span>
          {completedRounds > 0 && (
            <span className="text-xs text-primary">
              已完成 {completedRounds} 轮
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
```

### Step 2: 提交

```bash
git add src/components/ProgressBar.tsx
git commit -m "feat(progress): show current word list name in progress bar

- Display list name instead of generic title
- Use listTotalWords for progress calculation
- Show completed rounds

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

## Report Contract

After completing the task, write a report to `E:/work/englishLearn/.superpowers/sdd/task-9-report.md` with:
1. Changes made
2. Test results (TypeScript check, build)
3. Any concerns or issues encountered
4. Commit hash

Then report status: DONE, DONE_WITH_CONCERNS, NEEDS_CONTEXT, or BLOCKED