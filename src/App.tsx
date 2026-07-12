import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from './store/useAppStore';
import { useAutoPlay, useTTS } from './hooks/useTTS';
import { WordCard } from './components/WordCard';
import { ControlBar } from './components/ControlBar';
import { ProgressBar } from './components/ProgressBar';
import { SettingsModal } from './components/SettingsModal';
import { Home } from './components/Home';
import { Button } from '@/components/ui/button';

function App() {
  const [showSettings, setShowSettings] = useState(false);
  const { speak } = useTTS();

  const {
    currentWord,
    isLoading,
    isPlaying,
    currentRound,
    currentIndex,
    completedRounds,
    totalWords,
    settings,
    isLearningMode,
    initialize,
    nextWord,
    prevWord,
    togglePlay,
    quitLearning,
    updateSettings,
    resetProgress,
  } = useAppStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  useAutoPlay();

  const handleSpeak = () => {
    if (currentWord) {
      speak(currentWord.word, settings.accent, settings.speechRate || 1.0);
    }
  };

  const handleSpeakExample = () => {
    if (currentWord && currentWord.example) {
      speak(currentWord.example, settings.accent, settings.speechRate || 1.0);
    }
  };

  // 键盘快捷键
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isLearningMode) return;
    // 忽略在 input/textarea 中的按键
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        prevWord();
        break;
      case 'ArrowRight':
        e.preventDefault();
        nextWord();
        break;
      case ' ':
        e.preventDefault();
        import('./hooks/useTTS').then(({ unlockAudio }) => unlockAudio());
        togglePlay();
        break;
    }
  }, [isLearningMode, prevWord, nextWord, togglePlay]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // 切入后台时自动暂停
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        useAppStore.setState({ isPlaying: false });
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  if (!isLearningMode) {
    return (
      <div className="app-container min-h-screen text-foreground flex flex-col overflow-hidden app-bg">
        <Home />
      </div>
    );
  }

  return (
    <div className="app-container min-h-screen text-foreground flex flex-col overflow-hidden app-bg">

      {/* Top Progress */}
      <div className="w-full safe-top">
        <ProgressBar
          current={currentIndex}
          total={totalWords}
          round={currentRound}
          completedRounds={completedRounds}
        />
      </div>

      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between z-40">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={quitLearning}
            className="mr-1 hover:bg-white/10 rounded-full"
            aria-label="返回首页"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Button>
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
            <span className="text-primary-foreground text-base font-bold">E</span>
          </div>
          <div>
            <h1 className="text-base font-semibold text-foreground">
              单词朗读
            </h1>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              Vocab Master
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={() => setShowSettings(true)}
          aria-label="设置"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h10M4 18h7" />
          </svg>
        </Button>
      </header>

      {/* Main Content */}
      <main className="flex-1 relative z-10 flex flex-col items-center justify-center w-full max-w-[480px] mx-auto px-4">
        <WordCard
          word={currentWord}
          isLoading={isLoading}
          onSpeak={handleSpeak}
          onSpeakExample={handleSpeakExample}
          accent={settings.accent}
          onNext={nextWord}
          onPrev={prevWord}
        />
      </main>

      {/* Bottom Control */}
      <footer className="safe-bottom pb-8 pt-4 px-6 bg-background/80 backdrop-blur-lg z-40 border-t border-white/5">
        <div className="max-w-[480px] mx-auto flex flex-col items-center">
          {/* Status */}
          <div 
            className="h-10 flex items-center justify-center mb-2 cursor-pointer"
            onClick={() => {
              import('./hooks/useTTS').then(({ unlockAudio }) => unlockAudio());
              togglePlay();
            }}
            title={isPlaying ? "点击暂停" : "点击播放"}
          >
            {isPlaying ? (
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 transition-colors">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse-subtle"></span>
                <span className="text-xs font-semibold tracking-wide">
                  自动播放中
                </span>
              </div>
            ) : (
              <span className="text-xs font-medium text-muted-foreground tracking-wide hover:text-foreground transition-colors">
                滑动或使用方向键切换 · 点击或空格键播放
              </span>
            )}
          </div>

          <ControlBar
            isPlaying={isPlaying}
            onPrev={prevWord}
            onNext={nextWord}
            onTogglePlay={togglePlay}
          />
        </div>
      </footer>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettings}
        settings={settings}
        onClose={() => setShowSettings(false)}
        onUpdateSettings={updateSettings}
        onResetProgress={resetProgress}
        currentIndex={currentIndex}
        totalWords={totalWords}
        currentRound={currentRound}
      />
    </div>
  );
}

export default App;