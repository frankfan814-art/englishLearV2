import { useAppStore } from '../store/useAppStore';
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

export function MasteredList({ isOpen, onClose }: Props) {
  const { masteredWords, unmarkMastered } = useAppStore();
  const masteredEntries = Object.entries(masteredWords);

  const handleRestoreAll = () => {
    if (confirm('确定要一键还原所有已掌握的单词吗？')) {
      masteredEntries.forEach(([index]) => {
        unmarkMastered(Number(index));
      });
      onClose();
    }
  };

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader>
          <DrawerTitle>已掌握单词 ({masteredEntries.length})</DrawerTitle>
          <DrawerDescription>这些单词在接下来的复习中将不再出现</DrawerDescription>
        </DrawerHeader>

        <div className="px-4 py-2 overflow-y-auto max-h-[50vh] space-y-2.5">
          {masteredEntries.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              暂无已掌握的单词
            </div>
          ) : (
            masteredEntries.map(([indexStr, data]) => (
              <div key={indexStr} className="flex items-center justify-between bg-muted/30 p-3 rounded-xl border border-white/5">
                <div className="flex-1 overflow-hidden pr-3">
                  <h4 className="font-bold text-foreground text-lg truncate">
                    {data.word}
                  </h4>
                  <p className="text-xs text-muted-foreground truncate">
                    {/* 词库中义项以字面量 "\n" 分隔，单行列表里用分号代替 */}
                    {data.definition.replace(/\\n|[\n\r]+/g, '；')}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => unmarkMastered(Number(indexStr))}
                  className="shrink-0 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 border-emerald-500/30"
                >
                  还原
                </Button>
              </div>
            ))
          )}
        </div>

        <DrawerFooter>
          {masteredEntries.length > 0 && (
            <Button
              variant="outline"
              onClick={handleRestoreAll}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20"
            >
              一键还原全部
            </Button>
          )}
          <DrawerClose>
            <div className="w-full">
              <Button variant="ghost" className="w-full">关闭</Button>
            </div>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
