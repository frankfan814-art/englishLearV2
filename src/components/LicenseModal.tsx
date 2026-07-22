import { useEffect, useState } from 'react';
import { BadgeCheck, Copy, Check, KeyRound, ShoppingCart } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { getDeviceId, isCloudConfigured, normalizeCode } from '../utils/license';
import { PURCHASE_URL, TRIAL_WORD_LIMIT } from '../config/license';
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
  onClose: () => void;
}

/** 软件激活弹窗：卡密激活、授权状态与设备码展示（售后用） */
export function LicenseModal({ isOpen, onClose }: Props) {
  const { licenseState, activateAndReload } = useAppStore();
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [deviceId, setDeviceId] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMessage(null);
      getDeviceId().then(setDeviceId);
    }
  }, [isOpen]);

  const handleActivate = async () => {
    if (submitting) return;
    setSubmitting(true);
    setMessage(null);
    const result = await activateAndReload(code);
    setSubmitting(false);
    setMessage({ ok: result.ok, text: result.message });
    if (result.ok) setCode('');
  };

  const handleCopyDeviceId = async () => {
    try {
      await navigator.clipboard.writeText(deviceId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 剪贴板不可用时静默失败，用户可手动长按复制
    }
  };

  const isActive = licenseState === 'active';

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>软件激活</DrawerTitle>
          <DrawerDescription>
            {isActive ? '当前设备已激活完整版' : `试用版每个词表限前 ${TRIAL_WORD_LIMIT} 词，激活后解锁全部词库`}
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 space-y-5">
          {/* 当前状态 */}
          <div className="flex items-center gap-3 bg-muted/50 rounded-2xl p-4 border border-white/5">
            {isActive ? (
              <>
                <BadgeCheck className="w-8 h-8 text-emerald-400 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-foreground">已激活完整版</p>
                  <p className="text-xs text-muted-foreground mt-0.5">全部词库与功能已解锁，感谢支持</p>
                </div>
              </>
            ) : (
              <>
                <KeyRound className="w-8 h-8 text-primary shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-foreground">试用版</p>
                  <p className="text-xs text-muted-foreground mt-0.5">输入购买后获得的激活码，即可解锁全部内容</p>
                </div>
              </>
            )}
          </div>

          {/* 激活码输入（未激活时显示） */}
          {!isActive && (
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                激活码
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="例如 VCAB-XXXX-XXXX"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                className="w-full h-12 px-4 rounded-xl bg-background/60 border border-white/10 text-foreground text-base font-mono tracking-widest placeholder:text-muted-foreground/50 placeholder:font-sans placeholder:tracking-normal focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
              />
              {message && (
                <p className={`text-sm mt-2 ${message.ok ? 'text-emerald-400' : 'text-destructive'}`}>
                  {message.text}
                </p>
              )}
              <Button
                size="lg"
                className="w-full h-12 rounded-xl text-base font-bold mt-3 shadow-lg shadow-primary/25"
                disabled={submitting || normalizeCode(code).length < 6}
                onClick={handleActivate}
              >
                {submitting ? '激活中…' : '立即激活'}
              </Button>
              {!isCloudConfigured() && (
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  （云服务未配置，当前版本暂不支持在线激活）
                </p>
              )}
              {PURCHASE_URL && (
                <a
                  href={PURCHASE_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 flex items-center justify-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
                >
                  <ShoppingCart className="w-4 h-4" />
                  还没有激活码？去购买
                </a>
              )}
            </div>
          )}

          {/* 设备码（售后换机时提供给卖家） */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              本机设备码
            </label>
            <button
              onClick={handleCopyDeviceId}
              className="w-full flex items-center justify-between gap-2 bg-background/60 border border-white/10 rounded-xl px-4 py-3 active:scale-[0.99] transition-transform"
            >
              <span className="font-mono text-xs text-muted-foreground truncate">{deviceId || '读取中…'}</span>
              {copied ? (
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <Copy className="w-4 h-4 text-muted-foreground shrink-0" />
              )}
            </button>
            <p className="text-[11px] text-muted-foreground/70 mt-1.5">
              换机或激活异常时，请把设备码发给卖家处理
            </p>
          </div>
        </div>

        <DrawerFooter>
          {/* DrawerClose 自身渲染 button，内部不能再嵌套 Button（validateDOMNesting 警告） */}
          <DrawerClose className="w-full inline-flex items-center justify-center h-10 rounded-md text-sm font-medium text-foreground hover:bg-muted/60 transition-colors">
            关闭
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
