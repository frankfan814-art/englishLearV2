import { useState, TouchEvent } from 'react';
import { Volume2, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Word } from '../types/word';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Props {
  word: Word | null;
  isLoading: boolean;
  onSpeak: () => void;
  onSpeakExample?: () => void;
  accent: string;
  language: string;
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

/** 常见领域标记的中文全称（如 [电] → 电子），未收录的显示原始标记 */
const DOMAIN_TAG_NAMES: Record<string, string> = {
  计: '计算机', 医: '医学', 法: '法律', 电: '电子', 化: '化学',
  经: '经济', 机: '机械', 建: '建筑', 俚: '俚语', 口: '口语',
  贬: '贬义', 谑: '谑称', 美俚: '美国俚语', 网络: '网络', 商标: '商标',
  人名: '人名', 地名: '地名',
};

/** 从释义行中提取开头的领域标记（如 "[电] 绩效, 性能" → { tags: ['电子'], text: '绩效, 性能' }） */
function extractDomainTags(line: string) {
  const tags: string[] = [];
  let text = line;
  for (let i = 0; i < 2; i++) {
    const m = text.match(/^\[([^\]]{1,6})\]\s*/);
    if (!m) break;
    tags.push(DOMAIN_TAG_NAMES[m[1]] || m[1]);
    text = text.slice(m[0].length);
  }
  return { tags, text };
}

export function WordCard({ word, isLoading, onSpeak, onSpeakExample, accent, language, onNext, onPrev }: Props) {
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
        <Card className="glass w-full h-full flex flex-col items-center justify-center rounded-3xl border-white/10">
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
        <Card className="glass w-full h-full flex flex-col items-center justify-center rounded-3xl border-white/10">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Plus className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-base text-muted-foreground font-medium">暂无单词</p>
        </Card>
      </div>
    );
  }

  const { pos: extractedPos, definition: cleanDefinition } = parseDefinition(word.definition);
  const displayPos = word.pos || extractedPos;

  // 词库中多个义项以字面量 "\n"（反斜杠+n）分隔，显示时按义项分行
  const definitionLines = cleanDefinition
    .split(/\\n|[\n\r]+/)
    .map(s => s.trim())
    .filter(Boolean);

  // Tag 显示逻辑：有 tag 显示 tag，否则显示语言名称
  const tagDisplayMap: Record<string, string> = { ja: '日本語', ko: '한국어', de: 'DEUTSCH' };
  const tagDisplay = word.tag
    ? word.tag.split(' ')[0].toUpperCase()
    : (tagDisplayMap[language] || 'VOCAB');

  return (
    <div
      className="w-full h-full flex items-center justify-center p-4"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Swipe Indicators — 左侧显示向左箭头(上一个), 右侧显示向右箭头(下一个) */}
      <div className={cn('swipe-indicator absolute left-4 top-1/2 -translate-y-1/2', swipeDirection === 'right' && 'active')}>
        <div className="w-10 h-10 rounded-full bg-muted/80 flex items-center justify-center backdrop-blur-sm border border-white/10">
          <ChevronLeft className="w-5 h-5 text-foreground" />
        </div>
      </div>
      <div className={cn('swipe-indicator absolute right-4 top-1/2 -translate-y-1/2', swipeDirection === 'left' && 'active')}>
        <div className="w-10 h-10 rounded-full bg-muted/80 flex items-center justify-center backdrop-blur-sm border border-white/10">
          <ChevronRight className="w-5 h-5 text-foreground" />
        </div>
      </div>

      <Card className="glass card-hover w-full h-full p-6 sm:p-8 flex flex-col animate-slide-up rounded-3xl border-white/10 overflow-y-auto">
        {/* Top: Tag & Audio */}
        <div className="flex justify-between items-center w-full">
          <span className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground bg-muted/60 border border-white/5 px-3 py-1.5 rounded-full">
            {tagDisplay}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={onSpeak}
            className="rounded-full hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-colors"
            aria-label="发音"
          >
            <Volume2 className="w-5 h-5" />
          </Button>
        </div>

        {/* Core Content */}
        <CardContent className="flex-1 flex flex-col items-center justify-center w-full py-6 px-0">
          {/* Word */}
          <h1 className="word-title text-gradient text-center mb-5 tracking-tight">
            {word.word}
          </h1>

          {/* Phonetic & Accent */}
          <div className="flex items-center gap-2.5 mb-8">
            {word.phonetic && (
              <>
                <span className="text-base text-muted-foreground font-medium">
                  {word.phonetic}
                </span>
                <div className="w-px h-3 bg-border"></div>
              </>
            )}
            <span className="text-[11px] uppercase font-semibold tracking-wider bg-primary/15 text-primary px-2.5 py-1 rounded-md">
              {accent.toUpperCase()}
            </span>
          </div>

          {/* Definition */}
          <div className="text-center w-full max-w-sm">
            {displayPos && (
              <span className="inline-block text-[11px] font-semibold tracking-wide bg-muted/60 border border-white/5 px-3 py-1 rounded-full mb-3">
                {displayPos}
              </span>
            )}
            <div className="text-base text-foreground/80 leading-relaxed font-medium space-y-1.5">
              {definitionLines.map((line, i) => {
                const { tags, text } = extractDomainTags(line);
                return (
                  <p key={i}>
                    {tags.map(t => (
                      <span
                        key={t}
                        className="inline-block align-middle text-[10px] font-semibold text-muted-foreground bg-muted/50 border border-white/5 px-1.5 py-0.5 rounded-md mr-1.5"
                      >
                        {t}
                      </span>
                    ))}
                    {text}
                  </p>
                );
              })}
            </div>
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
                <Volume2 className="w-4 h-4" />
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
