import { useState } from 'react';
import { List, Play, KeyRound } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { unlockAudio } from '../hooks/useTTS';
import { WordListSelect } from './WordListSelect';
import { GradientProgress } from './GradientProgress';
import { LicenseModal } from './LicenseModal';
import { LANGUAGES, LANGUAGE_BRAND, getWordListById, getListsByLanguage } from '../config/wordLists';
import { TRIAL_WORD_LIMIT } from '../config/license';
import { getTotalWords } from '../utils/languageRegistry';
import { cn } from '@/lib/utils';

export function Home() {
  const {
    currentLanguage, switchLanguage, currentRound, currentIndex, completedRounds,
    startLearning, masteredWords, currentList, listTotalWords, licenseState,
  } = useAppStore();
  const [showListSelect, setShowListSelect] = useState(false);
  const [showLicense, setShowLicense] = useState(false);

  // 首页展示当前词表的进度（与进入学习页后的内容一致），而非整个语言的总进度
  const listTotal = listTotalWords || getTotalWords(currentLanguage);
  const percentage = listTotal > 0 ? ((currentIndex + 1) / listTotal) * 100 : 0;
  const brand = LANGUAGE_BRAND[currentLanguage] || LANGUAGE_BRAND.en;
  const currentListName = getWordListById(currentList)?.name || '全部单词';
  const masteredCount = Object.keys(masteredWords).length;
  const hasProgress = currentIndex > 0 || currentRound > 1;
  const listCount = getListsByLanguage(currentLanguage).length;

  // 全部语言的词库总量，用于底部卖点条
  const grandTotal = LANGUAGES.reduce((sum, lang) => sum + getTotalWords(lang.code), 0);

  // 主 CTA：直接继续当前词表（有进度时显示"继续学习"），不再强制跳回"全部单词"
  const handleStart = () => {
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

          {/* Start / Continue Button */}
          <Button
            size="lg"
            className="w-full h-12 rounded-xl text-base font-bold shadow-lg shadow-primary/25 hover:scale-[1.02] active:scale-[0.98] transition-transform mb-3"
            onClick={handleStart}
          >
            <Play className="w-4 h-4 fill-current mr-1.5" />
            {hasProgress ? '继续学习' : '开始学习'}
            <span className="text-xs font-normal opacity-75 ml-2">
              {currentListName} · {listTotal.toLocaleString()} 词
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
              共 {listCount} 个词表
            </span>
          </Button>

          {/* 试用版激活入口 */}
          {licenseState === 'trial' && (
            <button
              onClick={() => setShowLicense(true)}
              className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium text-primary bg-primary/10 border border-primary/20 hover:bg-primary/15 active:scale-[0.98] transition-all"
            >
              <KeyRound className="w-3.5 h-3.5" />
              试用版 · 每词表限前 {TRIAL_WORD_LIMIT} 词 · 点击激活完整版
            </button>
          )}

          {/* Progress Stats */}
          <div className="w-full bg-background/60 rounded-2xl p-5 mt-7 border border-white/5">
            <div className="grid grid-cols-3 gap-2 mb-4 text-center">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">当前轮次</p>
                <p className="text-lg font-bold text-foreground tabular-nums">第 {currentRound} 轮</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">已完成</p>
                <p className="text-lg font-bold text-primary tabular-nums">{completedRounds} 轮</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">已掌握</p>
                <p className="text-lg font-bold text-emerald-400 tabular-nums">{masteredCount}</p>
              </div>
            </div>

            <div className="w-full pt-4 border-t border-white/5">
              <div className="flex justify-between items-end mb-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {currentListName}
                </span>
                <div className="text-right">
                  <span className="font-bold text-foreground tabular-nums">{currentIndex + 1}</span>
                  <span className="text-muted-foreground mx-1">/</span>
                  <span className="text-sm text-muted-foreground tabular-nums">{listTotal.toLocaleString()}</span>
                </div>
              </div>
              <GradientProgress percentage={percentage} />
            </div>
          </div>

          {/* 卖点条 */}
          <p className="text-[11px] text-muted-foreground/70 text-center mt-6 tracking-wide">
            {LANGUAGES.length} 国语言 · {grandTotal.toLocaleString()} 词库 · 离线畅学 · 无广告
          </p>
        </Card>
      </div>

      {/* Word List Select Modal */}
      <WordListSelect
        isOpen={showListSelect}
        onClose={() => setShowListSelect(false)}
      />

      {/* License Modal */}
      <LicenseModal
        isOpen={showLicense}
        onClose={() => setShowLicense(false)}
      />
    </>
  );
}
