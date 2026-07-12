import { useEffect, useCallback, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';

// Simple TTS hook that works on web and can be extended for Capacitor
export function useTTS() {
  // 用 ref 追踪是否已取消，防止 stop() 后 speak() 仍然发音
  const cancelledRef = useRef(false);

  const speak = useCallback(async (word: string, accent: 'us' | 'uk'): Promise<boolean> => {
    // 如果已经被取消，直接返回
    if (cancelledRef.current) return false;

    // Stop any ongoing speech first
    window.speechSynthesis?.cancel();

    // Try to use Capacitor TTS plugin if available
    try {
      const { TextToSpeech } = await import('@capacitor-community/text-to-speech');
      if (cancelledRef.current) return false;
      await TextToSpeech.speak({
        text: word,
        lang: accent === 'us' ? 'en-US' : 'en-GB',
        rate: 1.0,
        pitch: 1.0,
      });
      return true;
    } catch {
      // Capacitor not available, use Web Speech API
    }

    // Fallback to Web Speech API
    if (!('speechSynthesis' in window)) {
      return false;
    }

    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = accent === 'us' ? 'en-US' : 'en-GB';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    // 等待语音列表加载（某些浏览器需要）
    const voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) {
      await new Promise<void>((r) => {
        window.speechSynthesis.onvoiceschanged = () => r();
        // 设置超时以防不触发
        setTimeout(() => r(), 100);
      });
    }

    // 异步等待后再次检查是否已取消
    if (cancelledRef.current) return false;

    // 尝试选择合适的语音
    const targetLang = accent === 'us' ? 'en-US' : 'en-GB';
    const allVoices = window.speechSynthesis.getVoices();
    const targetVoice = allVoices.find(v => v.lang === targetLang) ||
                        allVoices.find(v => v.lang.startsWith('en')) ||
                        null;
    if (targetVoice) {
      utterance.voice = targetVoice;
    }

    return new Promise<boolean>((resolve) => {
      // 在 speak 前最后检查一次
      if (cancelledRef.current) {
        resolve(false);
        return;
      }

      utterance.onend = () => resolve(true);
      utterance.onerror = (e) => {
        console.error('TTS Error:', e);
        resolve(false);
      };
      window.speechSynthesis.speak(utterance);
    });
  }, []);

  const stop = useCallback(() => {
    // 标记为已取消，阻止进行中的 speak 继续发音
    cancelledRef.current = true;
    // 同步立即取消 Web Speech API（优先保证快速停止）
    window.speechSynthesis?.cancel();
    // 异步尝试停止 Capacitor TTS
    import('@capacitor-community/text-to-speech')
      .then(({ TextToSpeech }) => TextToSpeech.stop())
      .catch(() => {});
  }, []);

  const resetCancel = useCallback(() => {
    cancelledRef.current = false;
  }, []);

  return { speak, stop, resetCancel };
}

export function useAutoPlay() {
  const { speak, stop, resetCancel } = useTTS();

  const {
    isPlaying,
    isLoading,
    settings,
    nextWord,
    currentWord,
  } = useAppStore();

  useEffect(() => {
    let isActive = true;

    // 未播放、无单词、或正在加载时不发音
    if (!isPlaying || !currentWord || isLoading) {
      stop();
      return;
    }

    // 重置取消标记，允许本次播放
    resetCancel();

    const playCurrentWord = async () => {
      // Speak the current word and wait for it to finish
      const success = await speak(currentWord.word, settings.accent);

      if (isActive) {
        if (!success) {
          // If speech failed (e.g. autoplay blocked or cancelled), stop playing
          useAppStore.setState({ isPlaying: false });
          return;
        }

        // Add configurable pause before moving to the next word
        setTimeout(() => {
          if (isActive) {
            nextWord();
          }
        }, settings.speed * 1000);
      }
    };

    playCurrentWord();

    return () => {
      isActive = false;
      stop();
    };
    // 注意：不依赖 currentIndex。
    // currentIndex 变化时 currentWord 还是旧值，会导致先读旧词再读新词。
    // 只依赖 currentWord，它在 loadCurrentWord 完成后才更新，此时一定是正确的新词。
  }, [isPlaying, isLoading, settings.accent, settings.speed, currentWord, speak, nextWord, stop, resetCancel]);

  return {
    stop,
  };
}