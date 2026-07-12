import { useEffect, useCallback, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';

// 创建单例的 Audio 对象，便于在移动端解锁后复用
const audioInstance = new Audio();

export function unlockAudio() {
  audioInstance.play().catch(() => {});
  if ('speechSynthesis' in window) {
    const u = new SpeechSynthesisUtterance('');
    u.volume = 0;
    window.speechSynthesis.speak(u);
  }
}

// Simple TTS hook that works on web and can be extended for Capacitor
export function useTTS() {
  const cancelledRef = useRef(false);

  // 播放真实人声（网易有道API）
  const speakRealAudio = useCallback((word: string, accent: 'us' | 'uk', rate: number = 1.0): Promise<boolean> => {
    return new Promise((resolve) => {
      if (cancelledRef.current) return resolve(false);
      
      const type = accent === 'us' ? 2 : 1;
      audioInstance.src = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=${type}`;
      audioInstance.playbackRate = rate;
      
      audioInstance.onended = () => resolve(true);
      audioInstance.onerror = () => resolve(false); // 失败时走 fallback
      
      const playPromise = audioInstance.play();
      if (playPromise !== undefined) {
        playPromise.catch((e) => {
          console.error('Audio play error:', e);
          resolve(false);
        });
      }
    });
  }, []);

  // 播放 TTS (可以用于单词的 fallback 或者中文释义)
  const speakTTS = useCallback(async (text: string, lang: string, rate: number = 1.0): Promise<boolean> => {
    if (cancelledRef.current) return false;
    window.speechSynthesis?.cancel();

    if (!('speechSynthesis' in window)) return false;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = rate;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) {
      await new Promise<void>((r) => {
        window.speechSynthesis.onvoiceschanged = () => r();
        setTimeout(() => r(), 100);
      });
    }

    if (cancelledRef.current) return false;

    const allVoices = window.speechSynthesis.getVoices();
    const targetVoice = allVoices.find(v => v.lang === lang) || 
                        allVoices.find(v => v.lang.startsWith(lang.split('-')[0])) || 
                        null;
    if (targetVoice) {
      utterance.voice = targetVoice;
    }

    return new Promise<boolean>((resolve) => {
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

  const speak = useCallback(async (word: string, accent: 'us' | 'uk', rate: number = 1.0): Promise<boolean> => {
    // 优先使用真实人声
    const success = await speakRealAudio(word, accent, rate);
    if (!success && !cancelledRef.current) {
      // 失败则降级使用 TTS
      const targetLang = accent === 'us' ? 'en-US' : 'en-GB';
      return await speakTTS(word, targetLang, rate);
    }
    return success;
  }, [speakRealAudio, speakTTS]);

  // 读中文释义（借鉴百词斩）
  const speakChinese = useCallback(async (text: string, rate: number = 1.0): Promise<boolean> => {
    return await speakTTS(text, 'zh-CN', rate);
  }, [speakTTS]);

  const stop = useCallback(() => {
    cancelledRef.current = true;
    audioInstance.pause();
    window.speechSynthesis?.cancel();
  }, []);

  const resetCancel = useCallback(() => {
    cancelledRef.current = false;
  }, []);

  return { speak, speakChinese, stop, resetCancel };
}

export function useAutoPlay() {
  const { speak, speakChinese, stop, resetCancel } = useTTS();

  const {
    isPlaying,
    isLoading,
    settings,
    nextWord,
    currentWord,
  } = useAppStore();

  useEffect(() => {
    let isActive = true;

    if (!isPlaying || !currentWord || isLoading) {
      stop();
      return;
    }

    resetCancel();

    const playCurrentWord = async () => {
      // 1. 读单词（真实人声优先）
      const success = await speak(currentWord.word, settings.accent, settings.speechRate || 1.0);

      if (isActive) {
        if (!success) {
          // If speech failed (e.g. autoplay blocked or cancelled), stop playing
          useAppStore.setState({ isPlaying: false });
          return;
        }

        // 2. 稍微停顿
        await new Promise(r => setTimeout(r, 500));
        if (!isActive) return;

        // 3. 如果开启了自动读例句，并且有例句，则读英文例句
        if (settings.readExample && currentWord.example) {
          await speak(currentWord.example, settings.accent, settings.speechRate || 1.0);
          if (!isActive) return;
        }

        // 4. 等待用户设置的间隔后切换下一个
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
  }, [
    isPlaying,
    isLoading,
    settings.accent,
    settings.speed,
    settings.readExample,
    settings.speechRate,
    currentWord,
    speak,
    speakChinese,
    nextWord,
    stop,
    resetCancel
  ]);

  return {
    stop,
  };
}