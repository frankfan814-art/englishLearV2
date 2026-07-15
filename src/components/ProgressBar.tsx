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