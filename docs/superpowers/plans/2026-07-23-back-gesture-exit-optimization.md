# 手机端边缘左滑/返回键交互优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 优化移动端 Android App 边缘划动/返回键的响应逻辑，支持弹窗优先关闭、刷词模式退回首页、首页连续两次划动防误触退出 App 并提供 Toast 提示。

**Architecture:** 使用 Capacitor 官方 `@capacitor/app` 插件的 `backButton` 事件监听器，配合自定义 React Hook `useBackHandler` 维护层级判断与连续点击双击退出的 2 秒倒计时状态，并由玻璃拟态组件 `Toast` 进行界面视觉反馈。

**Tech Stack:** React 18, TypeScript, Capacitor 7 (@capacitor/app), Tailwind CSS, Lucide React

## Global Constraints

- 依赖适配：`@capacitor/app` 必须安装匹配 Capacitor 7.0 版本的 `^7.0.0`。
- 严禁硬编码主题颜色，统一遵循 `index.css` 暗色主题变量与 Tailwind 类。
- 必须保证 `npm run build` TypeScript 严格类型检查无任何错误。

---

### Task 1: 安装 `@capacitor/app` 依赖

**Files:**
- Modify: `package.json`

**Interfaces:**
- Consumes: `@capacitor/core` 7.x
- Produces: `@capacitor/app` plugin for back button handling and `App.exitApp()`

- [ ] **Step 1: 运行 npm install 安装依赖**

Run: `npm install @capacitor/app@^7.0.0`
Expected: 成功安装 `@capacitor/app` package 并写入 `package.json`

- [ ] **Step 2: 验证 package.json**

检查 `package.json` 中的 `dependencies` 是否包含 `"@capacitor/app": "^7.0.0"`。

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add @capacitor/app package"
```

---

### Task 2: 创建 Toast 提示 UI 组件

**Files:**
- Create: `src/components/Toast.tsx`

**Interfaces:**
- Consumes: `message: string | null`, `visible: boolean`
- Produces: `<Toast />` component rendered at screen bottom with glassmorphic style

- [ ] **Step 1: 创建 Toast 组件**

Write `src/components/Toast.tsx`:

```tsx
import React from 'react';

interface ToastProps {
  message: string | null;
  visible: boolean;
}

export const Toast: React.FC<ToastProps> = ({ message, visible }) => {
  if (!visible || !message) return null;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[100] pointer-events-none select-none">
      <div className="bg-zinc-900/90 text-zinc-100 border border-white/10 backdrop-blur-md shadow-2xl px-4 py-2 rounded-full text-xs font-medium animate-fade flex items-center gap-2">
        <span>{message}</span>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 3: Commit**

```bash
git add src/components/Toast.tsx
git commit -m "feat: add Toast component for back gesture notifications"
```

---

### Task 3: 实现 `useBackHandler` Hook

**Files:**
- Create: `src/hooks/useBackHandler.ts`

**Interfaces:**
- Consumes:
  ```ts
  interface UseBackHandlerProps {
    showSettings: boolean;
    onCloseSettings: () => void;
    showMastered: boolean;
    onCloseMastered: () => void;
    isLearningMode: boolean;
    quitLearning: () => void;
  }
  ```
- Produces: `{ toastMessage: string | null; isToastVisible: boolean }`

- [ ] **Step 1: 创建 `useBackHandler` Hook**

Write `src/hooks/useBackHandler.ts`:

```ts
import { useEffect, useRef, useState, useCallback } from 'react';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

interface UseBackHandlerProps {
  showSettings: boolean;
  onCloseSettings: () => void;
  showMastered: boolean;
  onCloseMastered: () => void;
  isLearningMode: boolean;
  quitLearning: () => void;
}

export function useBackHandler({
  showSettings,
  onCloseSettings,
  showMastered,
  onCloseMastered,
  isLearningMode,
  quitLearning,
}: UseBackHandlerProps) {
  const [toastState, setToastState] = useState<{ message: string | null; visible: boolean }>({
    message: null,
    visible: false,
  });

  const lastBackTimeRef = useRef<number>(0);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 显示 Toast 的辅助函数（默认展示 2000ms）
  const showToast = useCallback((message: string) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToastState({ message, visible: true });
    toastTimerRef.current = setTimeout(() => {
      setToastState({ message: null, visible: false });
    }, 2000);
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    const listener = CapApp.addListener('backButton', () => {
      // 1. 关闭弹窗层
      if (showSettings) {
        onCloseSettings();
        return;
      }
      if (showMastered) {
        onCloseMastered();
        return;
      }

      // 2. 退回首页层
      if (isLearningMode) {
        quitLearning();
        return;
      }

      // 3. 首页二次划动确认退出
      const now = Date.now();
      if (lastBackTimeRef.current && now - lastBackTimeRef.current < 2000) {
        CapApp.exitApp();
      } else {
        lastBackTimeRef.current = now;
        showToast('再划一次退出应用');
      }
    });

    return () => {
      listener.then((h) => h.remove());
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, [showSettings, onCloseSettings, showMastered, onCloseMastered, isLearningMode, quitLearning, showToast]);

  return {
    toastMessage: toastState.message,
    isToastVisible: toastState.visible,
  };
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useBackHandler.ts
git commit -m "feat: add useBackHandler hook with double swipe back exit logic"
```

---

### Task 4: 在 `App.tsx` 中集成返回按键逻辑与 Toast

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `useBackHandler`, `<Toast />`
- Produces: Integrated back gesture handling and user feedback across learning/home screens

- [ ] **Step 1: 在 App.tsx 中调用 Hook 并挂载 Toast**

In `src/App.tsx`:
1. 导入 `useBackHandler` 和 `Toast`:
```tsx
import { useBackHandler } from './hooks/useBackHandler';
import { Toast } from './components/Toast';
```

2. 在 `App` 组件内部调用 `useBackHandler`:
```tsx
  const { toastMessage, isToastVisible } = useBackHandler({
    showSettings,
    onCloseSettings: () => setShowSettings(false),
    showMastered,
    onCloseMastered: () => setShowMastered(false),
    isLearningMode,
    quitLearning,
  });
```

3. 在返回顶层 JSX 末尾渲染 `<Toast message={toastMessage} visible={isToastVisible} />`（包括首页和刷词页）：
确保不管是 `!isLearningMode` 还是 `isLearningMode` 的分支，都包含了 `<Toast />`。

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `npm run build`
Expected: `tsc -b && vite build` 成功完成，无任何错误

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: integrate back gesture handler and Toast in App"
```

---

### Task 5: 验证与 Capacitor 同步

**Files:**
- Output: `dist/`, `android/`

- [ ] **Step 1: 运行构建命令**

Run: `npm run build`
Expected: `dist/` 目录正常生成

- [ ] **Step 2: 同步 Android 工程**

Run: `npm run cap:sync`
Expected: Capacitor 将网页产物及 `@capacitor/app` 原生插件同步至 `android/` 目录

- [ ] **Step 3: Final Commit**

```bash
git commit --allow-empty -m "chore: complete back gesture exit optimization"
```
