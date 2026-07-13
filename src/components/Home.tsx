import { useAppStore } from '../store/useAppStore';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { unlockAudio } from '../hooks/useTTS';

export function Home() {
  const { currentRound, currentIndex, totalWords, completedRounds, startLearning } = useAppStore();

  const percentage = ((currentIndex + 1) / totalWords) * 100;

  return (
    <div className="w-full h-full flex items-center justify-center p-4 animate-fade">
      <Card className="glass card-hover w-full max-w-[400px] p-8 flex flex-col items-center justify-center rounded-2xl border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
        
        {/* App Icon / Logo */}
        <div className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30 mb-6 animate-glow">
          <span className="text-primary-foreground text-4xl font-bold font-serif">E</span>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-gradient text-center mb-1">
          单词朗读
        </h1>
        <p className="text-sm text-muted-foreground text-center mb-8">
          听读记忆 · 高效刷词
        </p>

        {/* Progress Stats */}
        <div className="w-full bg-background/50 rounded-xl p-5 mb-6 border border-white/5">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-medium text-muted-foreground">当前轮次</span>
            <span className="text-lg font-bold text-foreground">第 {currentRound} 轮</span>
          </div>
          
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm font-medium text-muted-foreground">已完成轮次</span>
            <span className="text-lg font-bold text-primary">{completedRounds} 轮</span>
          </div>

          <div className="w-full pt-4 border-t border-white/5">
            <div className="flex justify-between items-end mb-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">进度</span>
              <div className="text-right">
                <span className="font-bold text-foreground">{currentIndex + 1}</span>
                <span className="text-muted-foreground mx-1">/</span>
                <span className="text-sm text-muted-foreground">{totalWords}</span>
              </div>
            </div>
            {/* Progress Bar */}
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-primary to-indigo-400 transition-all duration-500 rounded-full progress-glow"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        </div>

        {/* Start Button */}
        <Button 
          size="lg" 
          className="w-full h-14 rounded-xl text-lg font-bold shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-transform"
          onClick={() => {
            unlockAudio();
            startLearning();
          }}
        >
          开始学习
          <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </Button>
      </Card>
    </div>
  );
}
