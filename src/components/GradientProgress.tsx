import { cn } from '@/lib/utils';

interface GradientProgressProps {
  /** 进度百分比（0-100） */
  percentage: number;
  className?: string;
  /** 是否显示发光效果，默认开启 */
  glow?: boolean;
}

/** 统一的渐变进度条（主色 → 靛蓝），用于首页/进度条/设置/词表 */
export function GradientProgress({ percentage, className, glow = true }: GradientProgressProps) {
  const clamped = Math.min(100, Math.max(0, percentage));

  return (
    <div className={cn('w-full h-2 bg-muted rounded-full overflow-hidden', className)}>
      <div
        className={cn(
          'h-full rounded-full bg-gradient-to-r from-primary to-indigo-400 transition-all duration-500',
          glow && 'progress-glow'
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
