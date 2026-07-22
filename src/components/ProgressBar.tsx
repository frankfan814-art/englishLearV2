import { useAppStore } from '../store/useAppStore';
import { getWordListById } from '../config/wordLists';
import { GradientProgress } from './GradientProgress';

export function ProgressBar() {
  const { currentList, currentIndex, totalWords, listTotalWords, currentRound, completedRounds } = useAppStore();

  // Get list name
  const wordList = currentList !== 'all' ? getWordListById(currentList) : null;
  const listName = wordList?.name || '全部单词';

  // 统一使用 listTotalWords（已反映试用模式截断），避免 'all' 词表用全量词数导致进度条永不前进
  const effectiveTotal = listTotalWords || totalWords;
  const percentage = effectiveTotal > 0 ? ((currentIndex + 1) / effectiveTotal) * 100 : 0;

  return (
    <div className="w-full px-4 py-3 bg-background/70 backdrop-blur-xl border-b border-white/5">
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
        <GradientProgress percentage={percentage} />

        {/* Count */}
        <div className="flex justify-between items-center mt-1.5">
          <span className="text-xs text-muted-foreground tabular-nums">
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
