import { useEffect, useCallback, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';

// 创建单例的 Audio 对象，便于在移动端解锁后复用
const audioInstance = new Audio();

export function unlockAudio() {
  audioInstance.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
  audioInstance.load();
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
  const currentSpeakRef = useRef<number>(0);

  // 播放真实人声（网易有道API）
  const speakRealAudio = useCallback((speakId: number, word: string, accent: 'us' | 'uk', rate: number = 1.0): Promise<boolean> => {
    return new Promise((resolve) => {
      if (cancelledRef.current || currentSpeakRef.current !== speakId) return resolve(false);
      
      const type = accent === 'us' ? 2 : 1;
      audioInstance.src = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=${type}`;
      audioInstance.load();
      audioInstance.playbackRate = rate;
      
      let timeoutId: any;
      const onEnded = () => finish(true);
      const onError = () => finish(false);

      const finish = (result: boolean) => {
        clearTimeout(timeoutId);
        if (audioInstance.onended === onEnded) audioInstance.onended = null;
        if (audioInstance.onerror === onError) audioInstance.onerror = null;
        
        if (currentSpeakRef.current !== speakId) {
          resolve(false);
        } else {
          resolve(result);
        }
      };

      audioInstance.onended = onEnded;
      audioInstance.onerror = onError; // 失败时走 fallback
      
      timeoutId = setTimeout(() => {
        finish(false);
      }, 5000); // 5秒超时
      
      const playPromise = audioInstance.play();
      if (playPromise !== undefined) {
        playPromise.catch((e) => {
          console.error('Audio play error:', e);
          finish(false);
        });
      }
    });
  }, []);

  // 播放 TTS (可以用于单词的 fallback 或者中文释义)
  const speakTTS = useCallback(async (speakId: number, text: string, lang: string, rate: number = 1.0): Promise<boolean> => {
    if (cancelledRef.current || currentSpeakRef.current !== speakId) return false;
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

    if (cancelledRef.current || currentSpeakRef.current !== speakId) return false;

    const allVoices = window.speechSynthesis.getVoices();
    const targetVoice = allVoices.find(v => v.lang === lang) || 
                        allVoices.find(v => v.lang.startsWith(lang.split('-')[0])) || 
                        null;
    if (targetVoice) {
      utterance.voice = targetVoice;
    }

    return new Promise<boolean>((resolve) => {
      if (cancelledRef.current || currentSpeakRef.current !== speakId) {
        resolve(false);
        return;
      }
      utterance.onend = () => resolve(currentSpeakRef.current === speakId);
      utterance.onerror = (e) => {
        console.error('TTS Error:', e);
        resolve(false);
      };
      window.speechSynthesis.speak(utterance);
    });
  }, []);

  const speak = useCallback(async (word: string, accent: 'us' | 'uk', rate: number = 1.0): Promise<boolean> => {
    const speakId = ++currentSpeakRef.current;
    
    // 优先使用真实人声
    const success = await speakRealAudio(speakId, word, accent, rate);
    if (!success && !cancelledRef.current && currentSpeakRef.current === speakId) {
      // 失败则降级使用 TTS
      const targetLang = accent === 'us' ? 'en-US' : 'en-GB';
      return await speakTTS(speakId, word, targetLang, rate);
    }
    return success && currentSpeakRef.current === speakId;
  }, [speakRealAudio, speakTTS]);

  // 读中文释义（借鉴百词斩）
  const speakChinese = useCallback(async (text: string, rate: number = 1.0): Promise<boolean> => {
    const speakId = ++currentSpeakRef.current;
    return await speakTTS(speakId, text, 'zh-CN', rate);
  }, [speakTTS]);

  const stop = useCallback(() => {
    cancelledRef.current = true;
    currentSpeakRef.current += 1;
    audioInstance.pause();
    window.speechSynthesis?.cancel();
  }, []);

  const resetCancel = useCallback(() => {
    cancelledRef.current = false;
  }, []);

  return { speak, speakChinese, stop, resetCancel };
}

export function useAutoPlay() {
  const { speak, stop, resetCancel } = useTTS();

  const isPlaying = useAppStore(state => state.isPlaying);
  const isLoading = useAppStore(state => state.isLoading);
  const currentWord = useAppStore(state => state.currentWord);
  const nextWord = useAppStore(state => state.nextWord);

  useEffect(() => {
    let isActive = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    if (!isPlaying || !currentWord || isLoading) {
      stop();
      return;
    }

    resetCancel();

    const playCurrentWord = async () => {
      const state = useAppStore.getState();
      const settings = state.settings;

      // 1. 读单词（真实人声优先）
      const success = await speak(currentWord.word, settings.accent, settings.speechRate || 1.0);

      if (!isActive) return;

      if (!success) {
        // If speech failed (e.g. autoplay blocked or cancelled), stop playing
        console.warn('[AutoPlay] Speech failed, stopping playback');
        useAppStore.setState({ isPlaying: false });
        return;
      }

      // 2. 稍微停顿
      await new Promise(r => setTimeout(r, 500));
      if (!isActive) return;

      const currentSettings = useAppStore.getState().settings;

      // 3. 如果开启了自动读例句，并且有例句，则读英文例句
      if (currentSettings.readExample && currentWord.example) {
        const exampleSuccess = await speak(currentWord.example, currentSettings.accent, currentSettings.speechRate || 1.0);
        if (!isActive) return;
        if (!exampleSuccess) {
          console.warn('[AutoPlay] Example speech failed, but continuing to next word');
        }
      }

      // 4. 等待用户设置的间隔后切换下一个
      timeoutId = setTimeout(() => {
        if (isActive) {
          const stillPlaying = useAppStore.getState().isPlaying;
          if (stillPlaying) {
            nextWord();
          }
        }
      }, currentSettings.speed * 1000);
    };

    playCurrentWord();

    return () => {
      isActive = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      stop();
    };
  }, [
    isPlaying,
    isLoading,
    currentWord,
    speak,
    nextWord,
    stop,
    resetCancel
  ]);

  return {
    stop,
  };
}