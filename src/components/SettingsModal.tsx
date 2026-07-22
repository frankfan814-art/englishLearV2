import { useState, ReactNode } from 'react';
import { Check, KeyRound } from 'lucide-react';
import { Settings } from '../types/word';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { getLanguageInfo } from '../config/wordLists';
import { useAppStore } from '../store/useAppStore';
import { GradientProgress } from './GradientProgress';
import { LicenseModal } from './LicenseModal';

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

/** 设置项区块标题 */
function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
      {children}
    </label>
  );
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
  const [showConfirm, setShowConfirm] = useState(false);
  const [showLicense, setShowLicense] = useState(false);
  const speedOptions = [0.5, 1, 1.5, 2, 3];
  const percentage = ((currentIndex + 1) / totalWords) * 100;

  // 根据当前语言获取发音口音选项
  const currentLanguage = useAppStore(state => state.currentLanguage);
  const licenseState = useAppStore(state => state.licenseState);
  const langInfo = getLanguageInfo(currentLanguage);
  const accentOptions = langInfo?.ttsConfig.accentOptions || [];

  return (
    <>
      <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>设置</DrawerTitle>
          <DrawerDescription>自定义你的学习体验</DrawerDescription>
        </DrawerHeader>

        <div className="px-4 space-y-6">
          {/* 当前进度 */}
          <div className="bg-muted/50 rounded-2xl p-4 border border-white/5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">学习进度</p>
                <p className="text-lg font-bold text-foreground mt-1">
                  第 {currentRound} 轮
                </p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-foreground tabular-nums">
                  {percentage.toFixed(0)}%
                </p>
                <p className="text-xs text-muted-foreground mt-1 tabular-nums">
                  {currentIndex + 1} / {totalWords}
                </p>
              </div>
            </div>
            <GradientProgress percentage={percentage} />
          </div>

          {/* 朗读间隔 */}
          <div>
            <SectionLabel>单词切换间隔 (秒)</SectionLabel>
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
            <SectionLabel>发音语速</SectionLabel>
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
            <SectionLabel>发音口音</SectionLabel>
            {accentOptions.length > 1 ? (
              <div className="grid grid-cols-2 gap-3">
                {accentOptions.map(opt => (
                  <Button
                    key={opt.value}
                    variant={settings.accent === opt.value ? 'default' : 'outline'}
                    onClick={() => onUpdateSettings({ accent: opt.value })}
                    className="justify-start gap-2"
                  >
                    <span className="font-medium">{opt.label}</span>
                  </Button>
                ))}
              </div>
            ) : (
              <div className="bg-muted/50 rounded-xl p-4 text-center border border-white/5">
                <span className="text-sm text-muted-foreground">标准发音</span>
              </div>
            )}
          </div>

          {/* 自动朗读释义 */}
          <div>
            <SectionLabel>自动朗读释义</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant={!settings.readDefinition ? 'default' : 'outline'}
                onClick={() => onUpdateSettings({ readDefinition: false })}
                className="font-medium"
              >
                关闭
              </Button>
              <Button
                variant={settings.readDefinition ? 'default' : 'outline'}
                onClick={() => onUpdateSettings({ readDefinition: true })}
                className="font-medium"
              >
                开启
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              开启后：单词 → 中文释义
            </p>
          </div>

          {/* 自动朗读例句 */}
          <div>
            <SectionLabel>自动朗读例句</SectionLabel>
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

          {/* 软件激活 */}
          <div>
            <SectionLabel>软件激活</SectionLabel>
            <button
              onClick={() => setShowLicense(true)}
              className="w-full flex items-center justify-between gap-2 bg-muted/50 rounded-xl p-4 border border-white/5 hover:bg-muted/70 active:scale-[0.99] transition-all"
            >
              <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                <KeyRound className="w-4 h-4 text-primary" />
                {licenseState === 'active' ? '已激活完整版' : '试用版 · 点击激活'}
              </span>
              <span className={`text-xs font-semibold ${licenseState === 'active' ? 'text-emerald-400' : 'text-primary'}`}>
                {licenseState === 'active' ? '已解锁' : '去激活'}
              </span>
            </button>
          </div>

          {/* 自动保存提示 */}
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
              <Check className="w-3.5 h-3.5" strokeWidth={3} />
              进度已自动保存
            </div>
          </div>
        </div>

        <DrawerFooter>
          <Button
            variant="outline"
            className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setShowConfirm(true)}
          >
            重置进度
          </Button>
          <DrawerClose>
            <div className="w-full">
              <Button variant="ghost" className="w-full">关闭</Button>
            </div>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
      </Drawer>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>重置进度</DialogTitle>
            <DialogDescription>
              确定要重置所有学习进度吗？此操作将清除您所有的学习记录（包括已掌握单词），且无法恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-end gap-2 mt-4">
            <Button variant="ghost" onClick={() => setShowConfirm(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onResetProgress();
                setShowConfirm(false);
                onClose();
              }}
            >
              确认重置
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 激活弹窗（嵌套在设置之上） */}
      <LicenseModal
        isOpen={showLicense}
        onClose={() => setShowLicense(false)}
      />
    </>
  );
}
