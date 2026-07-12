interface Props {
  current: number;
  total: number;
  round: number;
  completedRounds: number;
}

export function ProgressBar({ current, total, round, completedRounds }: Props) {
  const percentage = ((current + 1) / total) * 100;

  return (
    <div className="w-full animate-fade">
      {/* Progress Bar */}
      <div className="w-full h-1 bg-muted/50 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary to-indigo-400 transition-all duration-500 progress-glow"
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Progress Text */}
      <div className="flex justify-between items-center px-6 mt-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">
            第{round}轮
          </span>
          {completedRounds > 0 && (
            <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded">
              已完成 {completedRounds} 轮
            </span>
          )}
        </div>
        <div className="text-right">
          <span className="font-semibold text-foreground">{(current + 1)}</span>
          <span className="text-muted-foreground mx-1">/</span>
          <span className="text-sm text-muted-foreground">{total}</span>
        </div>
      </div>
    </div>
  );
}