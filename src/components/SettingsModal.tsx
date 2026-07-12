import { Settings } from '../types/word';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';

interface Props {
  isOpen: boolean;
  settings: Settings;
  onClose: () => void;
  onUpdateSettings: (settings: Partial<Settings>) => void;
  onResetProgress: () => void;
  currentIndex: number;
  totalWords: number;
  currentRound: number;
}

export function SettingsModal({
  isOpen,
  settings,
  onClose,
  onUpdateSettings,
  onResetProgress,
  currentIndex,
  totalWords,
  currentRound,
}: Props) {
  const speedOptions = [0.5, 1, 1.5, 2, 3];
  const percentage = ((currentIndex + 1) / totalWords) * 100;

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>设置</DrawerTitle>
          <DrawerDescription>自定义你的学习体验</DrawerDescription>
        </DrawerHeader>

        <div className="px-4 space-y-6">
          {/* 当前进度 */}
          <div className="bg-muted/50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">学习进度</p>
                <p className="text-lg font-bold text-foreground mt-1">
                  第 {currentRound} 轮
                </p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-foreground">
                  {percentage.toFixed(0)}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {currentIndex + 1} / {totalWords}
                </p>
              </div>
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-indigo-400 transition-all duration-500 rounded-full progress-glow"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>

          {/* 朗读间隔 */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              单词切换间隔 (秒)
            </label>
            <div className="grid grid-cols-5 gap-2">
              {speedOptions.map((speed) => (
                <Button
                  key={speed}
                  variant={settings.speed === speed ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onUpdateSettings({ speed })}
                  className="font-medium"
                >
                  {speed}s
                </Button>
              ))}
            </div>
          </div>

          {/* 发音语速 */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              发音语速
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[0.75, 1.0, 1.25, 1.5].map((rate) => (
                <Button
                  key={rate}
                  variant={(settings.speechRate || 1.0) === rate ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onUpdateSettings({ speechRate: rate })}
                  className="font-medium"
                >
                  {rate}x
                </Button>
              ))}
            </div>
          </div>

          {/* 发音口音 */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              发音口音
            </label>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant={settings.accent === 'us' ? 'default' : 'outline'}
                onClick={() => onUpdateSettings({ accent: 'us' })}
                className="justify-start gap-2"
              >
                <span className="text-lg">🇺🇸</span>
                <span className="font-medium">美式发音</span>
              </Button>
              <Button
                variant={settings.accent === 'uk' ? 'default' : 'outline'}
                onClick={() => onUpdateSettings({ accent: 'uk' })}
                className="justify-start gap-2"
              >
                <span className="text-lg">🇬🇧</span>
                <span className="font-medium">英式发音</span>
              </Button>
            </div>
          </div>

          {/* 自动朗读例句 */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              自动朗读例句
            </label>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant={!settings.readExample ? 'default' : 'outline'}
                onClick={() => onUpdateSettings({ readExample: false })}
                className="font-medium"
              >
                关闭
              </Button>
              <Button
                variant={settings.readExample ? 'default' : 'outline'}
                onClick={() => onUpdateSettings({ readExample: true })}
                className="font-medium"
              >
                开启
              </Button>
            </div>
          </div>

          {/* 自动保存提示 */}
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              进度已自动保存
            </div>
          </div>
        </div>

        <DrawerFooter>
          <Button
            variant="outline"
            onClick={() => {
              if (confirm('确定要重置所有进度吗？此操作无法恢复。')) {
                onResetProgress();
                onClose();
              }
            }}
          >
            重置进度
          </Button>
          <DrawerClose>
            <Button variant="ghost">关闭</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}