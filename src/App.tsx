import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from './store/useAppStore';
import { useAutoPlay, useTTS, unlockAudio } from './hooks/useTTS';
import { useWakeLock } from './hooks/useWakeLock';
import { WordCard } from './components/WordCard';
import { ProgressBar } from './components/ProgressBar';
import { SettingsModal } from './components/SettingsModal';
import { Home } from './components/Home';
import { Button } from '@/components/ui/button';

import { MasteredList } from './components/MasteredList';

function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [showMastered, setShowMastered] = useState(false);
  const { speak } = useTTS();

  const {
    currentWord,
    isLoading,
    isPlaying,
    currentRound,
    currentIndex,
    listTotalWords,
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

  // Keep screen awake during playback
  useWakeLock(isPlaying);

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
        unlockAudio();
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
        <ProgressBar />
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

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowMastered(true)}
            aria-label="已掌握单词"
            className="text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10 border-emerald-500/30"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </Button>

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
        </div>
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
          {/* Status & Master Button */}
          <div className="h-14 flex items-center justify-center gap-3 mb-1 w-full px-4">
            <button
              onClick={() => {
                unlockAudio();
                togglePlay();
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-full font-bold text-sm transition-all shadow-lg active:scale-95 ${
                isPlaying 
                  ? 'bg-primary/20 text-primary border-2 border-primary/40 hover:bg-primary/30' 
                  : 'bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-primary/30'
              }`}
            >
              {isPlaying ? (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse-subtle"></span>
                  暂停朗读
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                  自动朗读
                </>
              )}
            </button>

            <button
              onClick={() => useAppStore.getState().markMastered()}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-full font-bold text-sm bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 hover:bg-emerald-500/20 active:scale-95 transition-all shadow-sm"
              title="掌握此单词后，将不再循环出现"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              已掌握
            </button>
          </div>
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
        totalWords={listTotalWords}
        currentRound={currentRound}
      />

      {/* Mastered List Modal */}
      <MasteredList
        isOpen={showMastered}
        onClose={() => setShowMastered(false)}
      />
    </div>
  );
}

export default App;