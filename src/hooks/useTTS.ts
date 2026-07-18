import { useEffect, useCallback, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { getLanguageInfo } from '../config/wordLists';

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
        // interrupted/canceled 是主动 stop() 或切换时的正常中断，不算错误
        if (e.error !== 'interrupted' && e.error !== 'canceled') {
          console.error('TTS Error:', e);
        }
        resolve(false);
      };
      window.speechSynthesis.speak(utterance);
    });
  }, []);

  const speak = useCallback(async (word: string, accent: string, rate: number = 1.0): Promise<boolean> => {
    const speakId = ++currentSpeakRef.current;

    // Check if it's a Youdao-supported accent (us/uk)
    const isYoudaoAccent = accent === 'us' || accent === 'uk';

    // Prefer real audio for us/uk
    if (isYoudaoAccent) {
      const success = await speakRealAudio(speakId, word, accent as 'us' | 'uk', rate);
      if (!success && !cancelledRef.current && currentSpeakRef.current === speakId) {
        // Fallback to TTS
        const targetLang = accent === 'us' ? 'en-US' : 'en-GB';
        return await speakTTS(speakId, word, targetLang, rate);
      }
      return success && currentSpeakRef.current === speakId;
    } else {
      // For non-English languages, use Web Speech API directly
      return await speakTTS(speakId, word, accent, rate);
    }
  }, [speakRealAudio, speakTTS]);

  // 读中文释义（借鉴百词斩）
  const speakChinese = useCallback(async (text: string, rate: number = 1.0): Promise<boolean> => {
    const speakId = ++currentSpeakRef.current;
    return await speakTTS(speakId, text, 'zh-CN', rate);
  }, [speakTTS]);

  // 语言感知的发音方法：英语走有道API，其他语言走Web Speech
  const speakByLanguage = useCallback(async (
    text: string,
    language: string,
    accent: string,
    rate: number = 1.0
  ): Promise<boolean> => {
    const speakId = ++currentSpeakRef.current;
    const langConfig = getLanguageInfo(language);
    if (!langConfig) {
      // 未知语言，用 Web Speech 兜底
      return await speakTTS(speakId, text, 'en-US', rate);
    }

    const { ttsConfig } = langConfig;

    if (ttsConfig.mode === 'youdao') {
      const success = await speakRealAudio(speakId, text, accent as 'us' | 'uk', rate);
      if (!success && !cancelledRef.current && currentSpeakRef.current === speakId) {
        // Fallback to Web Speech API when Youdao fails
        const targetLang = accent === 'uk' ? 'en-GB' : 'en-US';
        return await speakTTS(speakId, text, targetLang, rate);
      }
      return success && currentSpeakRef.current === speakId;
    }

    const lang = ttsConfig.webspeechLang || `${language}-${language.toUpperCase()}`;
    return await speakTTS(speakId, text, lang, rate);
  }, [speakRealAudio, speakTTS]);

  const stop = useCallback(() => {
    cancelledRef.current = true;
    currentSpeakRef.current += 1;
    audioInstance.pause();
    window.speechSynthesis?.cancel();
  }, []);

  const resetCancel = useCallback(() => {
    cancelledRef.current = false;
  }, []);

  return { speak, speakChinese, speakByLanguage, stop, resetCancel, currentSpeakRef };
}

// 领域标记（如 [计] / [医] / 【法律】）：朗读时静默去除
const DOMAIN_TAG_RE = /^(\[[^\]]{1,6}\]|【[^】]{1,8}】)\s*/;

// 词性缩写 → 中文读法（朗读释义时先报词性，如 "名词，关系，关联"）
const POS_ZH: Record<string, string> = {
  n: '名词', v: '动词', vt: '及物动词', vi: '不及物动词', vbl: '动词',
  a: '形容词', adj: '形容词', ad: '副词', adv: '副词',
  pron: '代词', num: '数词', art: '冠词', prep: '介词', conj: '连词',
  int: '感叹词', interj: '感叹词', aux: '助动词',
  pl: '复数', abbr: '缩写词', pref: '前缀', suf: '后缀',
};

/**
 * 清洗释义文本，用于 TTS 朗读：
 * 1. 词库中多个义项以字面量 "\n"（反斜杠+n）或真实换行分隔，只取第一个主要义项
 * 2. 词性前缀转换为中文朗读（n. → 名词、vt. → 及物动词等），[计]/[医] 等领域标记静默去除
 * 3. 去掉反斜杠、省略号等会被误读出来的符号，过滤含英文/数字的噪音释义
 * 4. 极简模式（闭眼刷词）：只读第一个义项的第一个意思，如 "last → 形容词，最后的"
 */
/** 按逗号/分号拆分释义，但不拆开括号内部（如 "的（助词，表示所属）" 不拆断） */
function splitGlosses(s: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '（' || ch === '(') depth++;
    else if (ch === '）' || ch === ')') depth = Math.max(0, depth - 1);
    if ((ch === ',' || ch === '，' || ch === ';' || ch === '；') && depth === 0) {
      parts.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  parts.push(cur);
  return parts.map(x => x.trim()).filter(x => x.length > 0);
}

function cleanDefinitionForSpeech(definition: string): string {
  const senses = definition
    .split(/\\n|[\n\r]+/)
    .map(s => s.trim())
    .filter(Boolean)
    .slice(0, 1); // 只读第一个主要意思

  const cleaned = senses
    .map(sense => {
      // 词性前缀转中文朗读，领域标记静默去除；二者可能叠加（如 "[计] n. xxx"），循环处理
      let s = sense;
      let posLabel = '';
      for (let i = 0; i < 3; i++) {
        const noDomain = s.replace(DOMAIN_TAG_RE, '');
        if (noDomain !== s) { s = noDomain; continue; }
        const m = s.match(/^([a-z]{1,6})\.\s*/i);
        if (m) {
          const zh = POS_ZH[m[1].toLowerCase()];
          if (zh && !posLabel) posLabel = zh;
          s = s.slice(m[0].length);
          continue;
        }
        break;
      }
      // 省略号会被读成"点点点"，直接去掉
      s = s.replace(/\.{2,}|…+/g, '');
      // 去掉残余的反斜杠、斜杠等符号
      s = s.replace(/[\\/]/g, '');
      // 只取第一个意思：过滤含英文或数字的噪音项（如 "DOS内部命令:..."）后取首个
      const gloss = splitGlosses(s)
        .filter(g => !/[A-Za-z0-9]/.test(g))[0];
      if (!gloss) return '';
      // 先读词性再读释义，如 "名词，关系"
      return (posLabel ? posLabel + '，' : '') + gloss;
    })
    .filter(s => s.length > 0);

  return cleaned.join('。');
}

/**
 * 清洗例句文本，用于 TTS 朗读：
 * 1. 去掉词典用法说明（如 "(= a clear example of ... )"），避免读出 "equals"
 * 2. 去掉全角括号注音/标签（如 学校（がっこう）、（英語）），避免单词被读两遍
 * 3. 去掉省略号与残余反斜杠；清洗后无内容（如 "（无合适例句）" 占位符）则返回空串跳过朗读
 */
export function cleanExampleForSpeech(example: string): string {
  let s = example
    // 词典用法说明 "(= ... )" 不朗读
    .replace(/\(\s*=\s*[^)]*\)/g, ' ')
    // 全角括号注音 / 标签 / 占位符不朗读
    .replace(/（[^）]*）/g, ' ')
    // 省略号（语料截断标记，如 "...the last decade"）替换为停顿
    .replace(/\.{2,}|…+/g, ' ')
    // 残余反斜杠
    .replace(/\\/g, ' ')
    // 合并空白，修正标点前多余空格
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,!?;:。，！？；：])/g, '$1')
    // 中日韩字符之间不留空格（去除括号注音后残留的空隙）
    .replace(/([぀-ヿ一-鿿])\s+([぀-ヿ一-鿿])/g, '$1$2')
    .trim();
  // 清洗后不剩任何文字（如占位符）则跳过
  if (!/[\p{L}\p{N}]/u.test(s)) return '';
  return s;
}

export function useAutoPlay() {
  const { speakByLanguage, speakChinese, stop, resetCancel, currentSpeakRef } = useTTS();

  const isPlaying = useAppStore(state => state.isPlaying);
  const isLoading = useAppStore(state => state.isLoading);
  const currentWord = useAppStore(state => state.currentWord);
  const nextWord = useAppStore(state => state.nextWord);
  const readDefinition = useAppStore(state => state.settings.readDefinition);
  const readExample = useAppStore(state => state.settings.readExample);
  const speed = useAppStore(state => state.settings.speed);

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
      const currentLanguage = state.currentLanguage;

      // 1. 读单词（语言感知）
      const success = await speakByLanguage(
        currentWord.word, currentLanguage,
        settings.accent, settings.speechRate || 1.0
      );

      if (!isActive) return;

      if (!success) {
        // Check if speech was cancelled (user navigated)
        if (currentSpeakRef.current > 0) {
          console.warn('[AutoPlay] Speech failed, stopping playback');
          useAppStore.setState({ isPlaying: false });
          return;
        }
        return;
      }

      // 2. 停顿 0.5 秒（极简刷词节奏：留一点回忆时间再报意思）
      await new Promise(r => setTimeout(r, 500));
      if (!isActive) return;

      const currentSettings = useAppStore.getState().settings;

      // 3. 读中文释义（极简模式：只读第一个义项的第一个意思）
      if (currentSettings.readDefinition && currentWord.definition) {
        const cleanDef = cleanDefinitionForSpeech(currentWord.definition);
        if (cleanDef) {
          const defSuccess = await speakChinese(cleanDef, settings.speechRate || 1.0);
          if (!isActive) return;
          if (!defSuccess) {
            console.warn('[AutoPlay] Definition speech failed, but continuing');
          }
          await new Promise(r => setTimeout(r, 300));
        }
      }

      if (!isActive) return;

      // 4. 读例句（语言感知，清洗后朗读；占位符例句自动跳过）
      if (currentSettings.readExample && currentWord.example) {
        const cleanExample = cleanExampleForSpeech(currentWord.example);
        if (cleanExample) {
          const exampleSuccess = await speakByLanguage(
            cleanExample, currentLanguage,
            settings.accent, settings.speechRate || 1.0
          );
          if (!isActive) return;
          if (!exampleSuccess) {
            console.warn('[AutoPlay] Example speech failed, but continuing');
          }
          await new Promise(r => setTimeout(r, 500));
        }
      }

      // 5. 等待间隔后切换下一个
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
    speakByLanguage,
    nextWord,
    stop,
    resetCancel,
    readDefinition,
    readExample,
    speed,
  ]);

  return {
    stop,
  };
}