import { useState, TouchEvent } from 'react';
import { Word } from '../types/word';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface Props {
  word: Word | null;
  isLoading: boolean;
  onSpeak: () => void;
  onSpeakExample?: () => void;
  accent: 'us' | 'uk';
  onNext: () => void;
  onPrev: () => void;
}

/** 从释义字符串中提取词性和定义 */
function parseDefinition(def: string) {
  const match = def.match(/^([a-z]+\.)\s*(.+)$/i);
  if (match) {
    return { pos: match[1], definition: match[2] };
  }
  return { pos: '', definition: def };
}

export function WordCard({ word, isLoading, onSpeak, onSpeakExample, accent, onNext, onPrev }: Props) {
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);

  const minSwipeDistance = 50;

  const onTouchStart = (e: TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
    setSwipeDirection(null);
  };

  const onTouchMove = (e: TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
    if (touchStart !== null) {
      const distance = touchStart - e.targetTouches[0].clientX;
      if (distance > 20) setSwipeDirection('left');
      else if (distance < -20) setSwipeDirection('right');
    }
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    setSwipeDirection(null);

    if (isLeftSwipe) onNext();
    else if (isRightSwipe) onPrev();
  };

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center p-4 animate-fade">
        <Card className="glass w-full h-[72vh] max-h-[700px] flex flex-col items-center justify-center rounded-2xl border-white/5 shadow-2xl">
          <div className="w-20 h-1 bg-muted rounded-full mb-6 animate-shimmer"></div>
          <div className="w-48 h-10 bg-muted/50 rounded-lg mb-4 animate-shimmer"></div>
          <div className="w-32 h-5 bg-muted/50 rounded-lg animate-shimmer"></div>
        </Card>
      </div>
    );
  }

  if (!word) {
    return (
      <div className="w-full h-full flex items-center justify-center p-4 animate-fade">
        <Card className="glass w-full h-[72vh] max-h-[700px] flex flex-col items-center justify-center rounded-2xl border-white/5 shadow-2xl">
          <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <p className="text-base text-muted-foreground font-medium">暂无单词</p>
        </Card>
      </div>
    );
  }

  const { pos: extractedPos, definition: cleanDefinition } = parseDefinition(word.definition);
  const displayPos = word.pos || extractedPos;

  return (
    <div
      className="w-full h-full flex items-center justify-center p-4"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Swipe Indicators — 左侧显示向左箭头(上一个), 右侧显示向右箭头(下一个) */}
      <div className={`swipe-indicator absolute left-4 top-1/2 -translate-y-1/2 ${swipeDirection === 'right' ? 'active' : ''}`}>
        <div className="w-10 h-10 rounded-full bg-muted/80 flex items-center justify-center backdrop-blur-sm">
          <svg className="w-5 h-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </div>
      </div>
      <div className={`swipe-indicator absolute right-4 top-1/2 -translate-y-1/2 ${swipeDirection === 'left' ? 'active' : ''}`}>
        <div className="w-10 h-10 rounded-full bg-muted/80 flex items-center justify-center backdrop-blur-sm">
          <svg className="w-5 h-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>

      <Card className="glass card-hover w-full h-[72vh] max-h-[700px] p-8 flex flex-col animate-slide-up rounded-2xl border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
        {/* Top: Tag & Audio */}
        <div className="flex justify-between items-center w-full">
          <span className="text-xs uppercase tracking-wider font-semibold text-muted-foreground bg-muted/80 px-3 py-1.5 rounded-lg">
            {word.tag ? word.tag.split(' ')[0].toUpperCase() : 'VOCAB'}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={onSpeak}
            className="hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-colors"
            aria-label="发音"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
            </svg>
          </Button>
        </div>

        {/* Core Content */}
        <CardContent className="flex-1 flex flex-col items-center justify-center w-full py-6 px-0">
          {/* Word */}
          <h1 className="text-5xl sm:text-6xl font-bold text-gradient text-center mb-6 tracking-tight">
            {word.word}
          </h1>

          {/* Phonetic & Accent */}
          <div className="flex items-center gap-2 mb-8">
            <span className="text-base text-muted-foreground font-medium">
              {word.phonetic}
            </span>
            <div className="w-px h-3 bg-border"></div>
            <span className="text-xs uppercase font-semibold tracking-wider bg-primary/15 text-primary px-2 py-0.5 rounded">
              {accent === 'us' ? 'US' : 'UK'}
            </span>
          </div>

          {/* Definition */}
          <div className="text-center w-full max-w-sm">
            {displayPos && (
              <span className="inline-block text-xs font-semibold bg-muted/80 px-3 py-1 rounded-lg mb-3">
                {displayPos}
              </span>
            )}
            <p className="text-base text-muted-foreground leading-relaxed font-medium">
              {cleanDefinition}
            </p>
          </div>
        </CardContent>

        {/* Example Section */}
        {word.example && (
          <div className="mt-auto pt-6 border-t border-white/5 text-center w-full relative">
            {onSpeakExample && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onSpeakExample}
                className="absolute right-0 top-5 hover:bg-primary/10 hover:text-primary rounded-full w-8 h-8 opacity-60 hover:opacity-100 transition-all"
                aria-label="朗读例句"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                </svg>
              </Button>
            )}
            <p className="text-sm text-muted-foreground italic leading-relaxed mb-2 px-8">
              "{word.example}"
            </p>
            {word.exampleTranslation && (
              <p className="text-xs text-muted-foreground/70 px-8">
                {word.exampleTranslation}
              </p>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
