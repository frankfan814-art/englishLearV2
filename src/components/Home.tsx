import { useState } from 'react';
import { List } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { unlockAudio } from '../hooks/useTTS';
import { WordListSelect } from './WordListSelect';
import { GradientProgress } from './GradientProgress';
import { LANGUAGES, LANGUAGE_BRAND } from '../config/wordLists';
import { getTotalWords } from '../utils/languageRegistry';
import { cn } from '@/lib/utils';

export function Home() {
  const { currentLanguage, switchLanguage, currentRound, currentIndex, completedRounds, startLearning, switchList } = useAppStore();
  const [showListSelect, setShowListSelect] = useState(false);

  const totalWords = getTotalWords(currentLanguage);
  const percentage = totalWords > 0 ? ((currentIndex + 1) / totalWords) * 100 : 0;
  const brand = LANGUAGE_BRAND[currentLanguage] || LANGUAGE_BRAND.en;

  const handleQuickStart = async () => {
    await switchList(`${currentLanguage}_all`);
    unlockAudio();
    startLearning();
  };

  const handleListSelect = () => {
    setShowListSelect(true);
  };

  return (
    <>
      <div className="w-full h-full flex items-center justify-center p-4 animate-fade overflow-y-auto">
        <Card className="glass card-hover w-full max-w-[400px] p-8 flex flex-col items-center justify-center rounded-3xl border-white/10">

          {/* App Icon / Logo */}
          <div className="w-20 h-20 rounded-[1.4rem] bg-gradient-to-br from-primary to-indigo-500 flex items-center justify-center shadow-xl shadow-primary/30 mb-6 animate-glow">
            <span className="text-primary-foreground text-4xl font-bold">{brand.logo}</span>
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-gradient text-center mb-1">
            单词朗读
          </h1>
          <p className="text-sm text-muted-foreground text-center mb-7">
            听读记忆 · 高效刷词
          </p>

          {/* Language Tabs */}
          <div className="flex gap-1 mb-7 bg-background/60 rounded-xl p-1 border border-white/5 w-full">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => {
                  if (lang.code !== currentLanguage) {
                    switchLanguage(lang.code);
                  }
                }}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-sm font-medium transition-all',
                  currentLanguage === lang.code
                    ? 'bg-primary text-primary-foreground shadow-md shadow-primary/30'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                <span className="text-base leading-none">{lang.flag}</span>
                <span>{lang.name}</span>
              </button>
            ))}
          </div>

          {/* Quick Start Button */}
          <Button
            size="lg"
            className="w-full h-12 rounded-xl text-base font-bold shadow-lg shadow-primary/25 hover:scale-[1.02] active:scale-[0.98] transition-transform mb-3"
            onClick={handleQuickStart}
          >
            快速开始
            <span className="text-xs font-normal opacity-75 ml-2">
              全部单词 · {totalWords.toLocaleString()} 词
            </span>
          </Button>

          {/* Word List Select Button */}
          <Button
            size="lg"
            variant="outline"
            className="w-full h-12 rounded-xl text-sm font-semibold hover:scale-[1.02] active:scale-[0.98] transition-transform"
            onClick={handleListSelect}
          >
            <List className="w-4 h-4 mr-2" />
            按词表学习
            <span className="text-xs font-normal opacity-60 ml-2">
              托福 / GRE / 四六级
            </span>
          </Button>

          {/* Progress Stats */}
          <div className="w-full bg-background/60 rounded-2xl p-5 mt-7 border border-white/5">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">当前轮次</p>
                <p className="text-lg font-bold text-foreground">第 {currentRound} 轮</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium text-muted-foreground mb-1">已完成轮次</p>
                <p className="text-lg font-bold text-primary">{completedRounds} 轮</p>
              </div>
            </div>

            <div className="w-full pt-4 border-t border-white/5">
              <div className="flex justify-between items-end mb-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">进度</span>
                <div className="text-right">
                  <span className="font-bold text-foreground">{currentIndex + 1}</span>
                  <span className="text-muted-foreground mx-1">/</span>
                  <span className="text-sm text-muted-foreground">{totalWords.toLocaleString()}</span>
                </div>
              </div>
              <GradientProgress percentage={percentage} />
            </div>
          </div>
        </Card>
      </div>

      {/* Word List Select Modal */}
      <WordListSelect
        isOpen={showListSelect}
        onClose={() => setShowListSelect(false)}
      />
    </>
  );
}
