import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, CircleCheck, SlidersHorizontal, Play, Check } from 'lucide-react';
import { useAppStore } from './store/useAppStore';
import { useAutoPlay, useTTS, unlockAudio, cleanExampleForSpeech } from './hooks/useTTS';
import { useWakeLock } from './hooks/useWakeLock';
import { WordCard } from './components/WordCard';
import { ProgressBar } from './components/ProgressBar';
import { SettingsModal } from './components/SettingsModal';
import { Home } from './components/Home';
import { Button } from '@/components/ui/button';
import { MasteredList } from './components/MasteredList';
import { LANGUAGE_BRAND } from './config/wordLists';
import { cn } from '@/lib/utils';

function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [showMastered, setShowMastered] = useState(false);
  const { speakByLanguage } = useTTS();

  const {
    currentWord,
    isLoading,
    isPlaying,
    currentRound,
    currentIndex,
    listTotalWords,
    settings,
    isLearningMode,
    currentLanguage,
    initialize,
    nextWord,
    prevWord,
    togglePlay,
    quitLearning,
    updateSettings,
    resetProgress,
    markMastered,
  } = useAppStore();

  // 语言相关的 Logo 和副标题
  const brand = LANGUAGE_BRAND[currentLanguage] || LANGUAGE_BRAND.en;

  useEffect(() => {
    initialize();
  }, [initialize]);

  useAutoPlay();

  // Keep screen awake during playback
  useWakeLock(isPlaying);

  const handleSpeak = () => {
    if (currentWord) {
      // 语言感知：英语走有道，日/韩/德走 Web Speech（修复非英语手动发音走错通道的问题）
      speakByLanguage(currentWord.word, currentLanguage, settings.accent, settings.speechRate || 1.0);
    }
  };

  const handleSpeakExample = () => {
    if (currentWord && currentWord.example) {
      // 例句先清洗（去除用法说明/注音括号等），与自动播放保持一致
      const cleanExample = cleanExampleForSpeech(currentWord.example);
      if (cleanExample) {
        speakByLanguage(cleanExample, currentLanguage, settings.accent, settings.speechRate || 1.0);
      }
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
      <header className="px-4 py-3 flex items-center justify-between z-40">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={quitLearning}
            className="rounded-full hover:bg-white/10"
            aria-label="返回首页"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-indigo-500 flex items-center justify-center shadow-lg shadow-primary/25">
            <span className="text-primary-foreground text-base font-bold">{brand.logo}</span>
          </div>
          <div>
            <h1 className="text-base font-semibold text-foreground leading-tight">
              单词朗读
            </h1>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              {brand.subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowMastered(true)}
            aria-label="已掌握单词"
            className="rounded-full text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
          >
            <CircleCheck className="w-5 h-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowSettings(true)}
            aria-label="设置"
            className="rounded-full hover:bg-white/10"
          >
            <SlidersHorizontal className="w-5 h-5" />
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
          language={currentLanguage}
          onNext={nextWord}
          onPrev={prevWord}
        />
      </main>

      {/* Bottom Control */}
      <footer className="safe-bottom pb-6 pt-4 px-6 bg-background/70 backdrop-blur-xl z-40 border-t border-white/5">
        <div className="max-w-[480px] mx-auto flex items-center gap-3">
          <button
            onClick={() => {
              unlockAudio();
              togglePlay();
            }}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-3 rounded-full font-bold text-sm border transition-all active:scale-95',
              isPlaying
                ? 'bg-primary/15 text-primary border-primary/30 hover:bg-primary/25'
                : 'bg-primary text-primary-foreground border-transparent shadow-lg shadow-primary/25 hover:bg-primary/90'
            )}
          >
            {isPlaying ? (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse-subtle"></span>
                暂停朗读
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                自动朗读
              </>
            )}
          </button>

          <button
            onClick={markMastered}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-full font-bold text-sm border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 active:scale-95 transition-all"
            title="掌握此单词后，将不再循环出现"
          >
            <Check className="w-4 h-4" strokeWidth={3} />
            已掌握
          </button>
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
