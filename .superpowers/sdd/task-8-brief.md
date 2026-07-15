# Task 8 Brief: 创建词表选择页面

## Files
- Create: `src/components/WordListSelect.tsx`

## Interfaces
- Consumes: `WORD_LISTS`, `getWordCountByTag()`, `switchList()`, `startLearning()`
- Produces: `WordListSelect` 组件

## Requirements

### Step 1: 创建 WordListSelect 组件

创建 `src/components/WordListSelect.tsx`：

```typescript
import { useEffect, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { WORD_LISTS, WordList } from '../config/wordLists';
import { getWordCountByTag } from '../utils/wordListIndex';
import { unlockAudio } from '../hooks/useTTS';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { ProgressData } from '../types/word';

interface WordListSelectProps {
  isOpen: boolean;
  onClose: () => void;
}

interface WordListWithStats extends WordList {
  wordCount: number;
  progress?: ProgressData;
}

export function WordListSelect({ isOpen, onClose }: WordListSelectProps) {
  const { switchList, startLearning, listProgress } = useAppStore();
  const [lists, setLists] = useState<WordListWithStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadListStats();
    }
  }, [isOpen]);

  const loadListStats = async () => {
    setLoading(true);
    const listsWithStats: WordListWithStats[] = [];

    for (const list of WORD_LISTS) {
      const wordCount = await getWordCountByTag(list.tag);
      listsWithStats.push({
        ...list,
        wordCount,
        progress: listProgress[list.id],
      });
    }

    setLists(listsWithStats);
    setLoading(false);
  };

  const handleSelectList = async (listId: string) => {
    await switchList(listId);
    unlockAudio();
    startLearning();
    onClose();
  };

  const formatProgress = (progress?: ProgressData, wordCount: number = 0) => {
    if (!progress || progress.currentIndex === 0) {
      return '未开始';
    }
    const percentage = wordCount > 0 ? ((progress.currentIndex + 1) / wordCount * 100).toFixed(0) : '0';
    return `第 ${progress.currentRound} 轮 · ${percentage}%`;
  };

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>选择词表</DrawerTitle>
        </DrawerHeader>

        <div className="px-4 space-y-3 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              加载中...
            </div>
          ) : (
            lists.map((list) => {
              const percentage = list.wordCount > 0
                ? ((list.progress?.currentIndex || 0) + 1) / list.wordCount * 100
                : 0;

              return (
                <button
                  key={list.id}
                  onClick={() => handleSelectList(list.id)}
                  className="w-full text-left p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors border border-white/5 active:scale-[0.98]"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold text-foreground">{list.name}</h3>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {list.wordCount.toLocaleString()} 词
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                      {formatProgress(list.progress, list.wordCount)}
                    </span>
                  </div>
                  {list.progress && list.progress.currentIndex > 0 && (
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-2">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-indigo-400 transition-all duration-500 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>

        <DrawerFooter>
          <DrawerClose>
            <Button variant="ghost" className="w-full">取消</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
```

### Step 2: 提交

```bash
git add src/components/WordListSelect.tsx
git commit -m "feat(ui): add word list selection page

- Display all word lists with word counts
- Show progress per list (round, percentage)
- Click to select list and start learning
- Use Drawer for mobile-friendly UI

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

## Report Contract

After completing the task, write a report to `E:/work/englishLearn/.superpowers/sdd/task-8-report.md` with:
1. Changes made
2. Test results (TypeScript check, build)
3. Any concerns or issues encountered
4. Commit hash

Then report status: DONE, DONE_WITH_CONCERNS, NEEDS_CONTEXT, or BLOCKED