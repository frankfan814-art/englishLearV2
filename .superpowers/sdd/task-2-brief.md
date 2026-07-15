# Task 2 Brief: 实现 Wake Lock 屏幕常亮

## Files
- Create: `src/hooks/useWakeLock.ts`
- Modify: `src/App.tsx`

## Interfaces
- Consumes: `isPlaying: boolean` (from store)
- Produces: `useWakeLock(enabled: boolean): void`

## Requirements

### Step 1: 创建 useWakeLock hook

创建 `src/hooks/useWakeLock.ts`：

```typescript
import { useEffect, useRef } from 'react';

/**
 * Keep screen awake while enabled (e.g., during audio playback)
 * Uses Screen Wake Lock API with graceful fallback for unsupported browsers
 */
export function useWakeLock(enabled: boolean) {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const enabledRef = useRef(enabled);

  // Keep enabledRef in sync
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      // Release Wake Lock when disabled
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
      return;
    }

    // Check browser support
    if (!('wakeLock' in navigator)) {
      console.warn('[WakeLock] API not supported in this browser');
      return;
    }

    // Request Wake Lock
    const requestWakeLock = async () => {
      try {
        const wakeLock = await navigator.wakeLock.request('screen');
        wakeLockRef.current = wakeLock;

        // Listen for automatic release (tab switch, minimize, etc.)
        wakeLock.addEventListener('release', () => {
          wakeLockRef.current = null;
          // Re-acquire if still enabled and page is visible
          if (enabledRef.current && !document.hidden) {
            requestWakeLock();
          }
        });
      } catch (err) {
        console.warn('[WakeLock] Request failed:', err);
      }
    };

    requestWakeLock();

    // Cleanup
    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, [enabled]);

  // Re-acquire wake lock when page becomes visible again
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && enabledRef.current && !wakeLockRef.current) {
        if ('wakeLock' in navigator) {
          navigator.wakeLock.request('screen')
            .then(wakeLock => {
              wakeLockRef.current = wakeLock;
              wakeLock.addEventListener('release', () => {
                wakeLockRef.current = null;
              });
            })
            .catch(() => {});
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);
}
```

### Step 2: 在 App.tsx 中集成 Wake Lock

修改 `src/App.tsx`，在文件顶部添加 import：

```typescript
import { useWakeLock } from './hooks/useWakeLock';
```

在 `App` 函数体内，`useAutoPlay()` 之后添加：

```typescript
// Keep screen awake during playback
useWakeLock(isPlaying);
```

完整位置参考：

```typescript
function App() {
  // ... existing state and hooks

  useAutoPlay();

  // Keep screen awake during playback
  useWakeLock(isPlaying);

  // ... rest of the component
}
```

### Step 3: 手动测试

运行 `npm run dev`，测试：
1. 点击"开始学习"进入学习页面
2. 点击"自动朗读"开始播放
3. 等待 1-2 分钟，观察屏幕是否保持常亮（不会自动锁屏）
4. 点击"暂停朗读"，Wake Lock 应释放
5. 切换到其他标签页再切回来，确认 Wake Lock 重新获取

### Step 4: 提交

```bash
git add src/hooks/useWakeLock.ts src/App.tsx
git commit -m "feat(wake-lock): keep screen awake during playback

- Add useWakeLock hook using Screen Wake Lock API
- Re-acquire wake lock on visibility change
- Graceful fallback for unsupported browsers

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

## Report Contract

After completing the task, write a report to `E:/work/englishLearn/.superpowers/sdd/task-2-report.md` with:
1. Changes made
2. Test results (TypeScript check, build, manual testing observations)
3. Any concerns or issues encountered
4. Commit hash

Then report status: DONE, DONE_WITH_CONCERNS, NEEDS_CONTEXT, or BLOCKED