import { Button } from '@/components/ui/button';

interface Props {
  isPlaying: boolean;
  onPrev: () => void;
  onNext: () => void;
  onTogglePlay: () => void;
}

export function ControlBar({ isPlaying, onPrev, onNext, onTogglePlay }: Props) {
  return (
    <div className="flex items-center justify-center gap-8 py-2 w-full max-w-sm mx-auto">
      {/* 上一个 */}
      <Button
        variant="outline"
        size="icon-lg"
        onClick={onPrev}
        className="hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-colors"
        aria-label="上一个单词"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </Button>

      {/* 播放/暂停 */}
      <Button
        size="icon-xl"
        onClick={() => {
          import('../hooks/useTTS').then(({ unlockAudio }) => unlockAudio());
          onTogglePlay();
        }}
        className="shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 transition-shadow"
        aria-label={isPlaying ? '暂停' : '播放'}
      >
        {isPlaying ? (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
          </svg>
        ) : (
          <svg className="w-7 h-7 translate-x-0.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z"/>
          </svg>
        )}
      </Button>

      {/* 下一个 */}
      <Button
        variant="outline"
        size="icon-lg"
        onClick={onNext}
        className="hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-colors"
        aria-label="下一个单词"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Button>
    </div>
  );
}