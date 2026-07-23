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

    const listenerPromise = CapApp.addListener('backButton', () => {
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
      listenerPromise.then((h) => h.remove());
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
