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
