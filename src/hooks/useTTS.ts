import { useEffect, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { useAppStore } from '../store/useAppStore';
import { getLanguageInfo } from '../config/wordLists';

// 创建单例的 Audio 对象，便于在移动端解锁后复用
const audioInstance = new Audio();

// 百度翻译公开 TTS 端点支持的语言（实测：中/英/日/韩可用，德语 403 不支持）
type BaiduLan = 'zh' | 'en' | 'jp' | 'kor';
const BAIDU_LAN: Record<string, BaiduLan | undefined> = {
  en: 'en',
  ja: 'jp',
  ko: 'kor',
  de: undefined,
};

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

  // 通过 <audio> 播放网络音频 URL（有道/百度等公开语音源），5 秒超时或出错返回 false 走下一级兜底
  const playAudioUrl = useCallback((speakId: number, url: string, rate: number = 1.0): Promise<boolean> => {
    return new Promise((resolve) => {
      if (cancelledRef.current || currentSpeakRef.current !== speakId) return resolve(false);

      audioInstance.src = url;
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

  // 网易有道词典人声（仅适合英语单词/短词）
  const speakRealAudio = useCallback((speakId: number, word: string, accent: 'us' | 'uk', rate: number = 1.0): Promise<boolean> => {
    const type = accent === 'us' ? 2 : 1;
    const url = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=${type}`;
    return playAudioUrl(speakId, url, rate);
  }, [playAudioUrl]);

  // 百度翻译公开 TTS 端点（实测支持 中/英/日/韩，含句子；德语不支持）
  const speakBaiduAudio = useCallback((speakId: number, text: string, lan: BaiduLan, rate: number = 1.0): Promise<boolean> => {
    const url = `https://fanyi.baidu.com/gettts?lan=${lan}&text=${encodeURIComponent(text)}&spd=4&source=web`;
    return playAudioUrl(speakId, url, rate);
  }, [playAudioUrl]);

  // 播放 TTS (可以用于单词的 fallback 或者中文释义)
  const speakTTS = useCallback(async (speakId: number, text: string, lang: string, rate: number = 1.0): Promise<boolean> => {
    if (cancelledRef.current || currentSpeakRef.current !== speakId) return false;

    // 原生 App：Android WebView 不支持 Web Speech API，走原生 TTS 引擎（speak 的 Promise 在朗读完毕后才 resolve）
    if (Capacitor.isNativePlatform()) {
      try {
        await TextToSpeech.speak({ text, lang, rate, pitch: 1.0, volume: 1.0, category: 'ambient' });
        return !cancelledRef.current && currentSpeakRef.current === speakId;
      } catch (e) {
        console.error('Native TTS Error:', e);
        return false;
      }
    }

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
    const alive = () => !cancelledRef.current && currentSpeakRef.current === speakId;

    // Check if it's a Youdao-supported accent (us/uk)
    const isYoudaoAccent = accent === 'us' || accent === 'uk';

    // Prefer real audio for us/uk
    if (isYoudaoAccent) {
      const success = await speakRealAudio(speakId, word, accent as 'us' | 'uk', rate);
      if (success && alive()) return true;
      // 百度音频兜底
      if (alive()) {
        const ok = await speakBaiduAudio(speakId, word, 'en', rate);
        if (ok && alive()) return true;
      }
      // 系统 TTS 最后兜底
      if (!alive()) return false;
      const targetLang = accent === 'us' ? 'en-US' : 'en-GB';
      return await speakTTS(speakId, word, targetLang, rate);
    } else {
      // For non-English languages, use Web Speech API directly
      return await speakTTS(speakId, word, accent, rate);
    }
  }, [speakRealAudio, speakBaiduAudio, speakTTS]);

  // 读中文释义：优先百度网络音频（保证国产手机无系统中文语音时也有声），系统 TTS 兜底
  const speakChinese = useCallback(async (text: string, rate: number = 1.0): Promise<boolean> => {
    const speakId = ++currentSpeakRef.current;
    const ok = await speakBaiduAudio(speakId, text, 'zh', rate);
    if (ok && !cancelledRef.current && currentSpeakRef.current === speakId) return true;
    if (cancelledRef.current || currentSpeakRef.current !== speakId) return false;
    return await speakTTS(speakId, text, 'zh-CN', rate);
  }, [speakBaiduAudio, speakTTS]);

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
    const alive = () => !cancelledRef.current && currentSpeakRef.current === speakId;

    // 有道 dictvoice 仅适合单词/短词；句子（含空白）不走过道
    const isSentence = /\s/.test(text.trim());

    // 第 1 级：英语单词走有道真人发音（质量最好）
    if (ttsConfig.mode === 'youdao' && !isSentence) {
      const success = await speakRealAudio(speakId, text, accent as 'us' | 'uk', rate);
      if (success && alive()) return true;
    }

    // 第 2 级：百度公开 TTS 音频（中/英/日/韩，含句子；保证没有系统语音引擎的国产手机也有声）
    const baiduLan = BAIDU_LAN[language];
    if (baiduLan && alive()) {
      const ok = await speakBaiduAudio(speakId, text, baiduLan, rate);
      if (ok && alive()) return true;
    }

    // 第 3 级：系统 TTS（原生插件 / Web Speech）兜底；德语无公开音频源，直接走这一级
    if (!alive()) return false;
    if (ttsConfig.mode === 'youdao') {
      const targetLang = accent === 'uk' ? 'en-GB' : 'en-US';
      return await speakTTS(speakId, text, targetLang, rate);
    }
    const lang = ttsConfig.webspeechLang || `${language}-${language.toUpperCase()}`;
    return await speakTTS(speakId, text, lang, rate);
  }, [speakRealAudio, speakBaiduAudio, speakTTS]);

  const stop = useCallback(() => {
    cancelledRef.current = true;
    currentSpeakRef.current += 1;
    audioInstance.pause();
    if (Capacitor.isNativePlatform()) {
      TextToSpeech.stop().catch(() => {});
    }
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
 * 1. 词库中多个义项以字面量 "\n"（反斜杠+n）或真实换行分隔；极简模式只读一个意思，
 *    按顺序取第一个能读出来的义项（首个义项常含英文解释等噪音，不宜直接放弃整个单词）
 * 2. 词性前缀转换为中文朗读（n. → 名词、vt. → 及物动词等），[计]/[医] 等领域标记静默去除
 * 3. 去掉反斜杠、省略号等会被误读出来的符号；括号内的英文注释（如 "（ABC）"）静默去除，
 *    仍含英文/数字的噪音释义（如 "DOS内部命令:..."）则跳过
 * 4. 示例："last → 形容词，最后的"
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
    .filter(Boolean);

  // 按顺序找第一个能读出来的义项，找到即返回（只读一个意思）
  for (const sense of senses) {
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
    // 只取第一个意思：括号内的英文注释静默去除，过滤仍含英文/数字的噪音项（如 "DOS内部命令:..."）
    const gloss = splitGlosses(s)
      .map(g => g.replace(/（[^）]*[A-Za-z0-9][^）]*）|\([^)]*[A-Za-z0-9][^)]*\)/g, '').trim())
      .filter(g => g.length > 0 && !/[A-Za-z0-9]/.test(g))[0];
    if (!gloss) continue; // 该义项不可读，尝试下一个义项
    // 先读词性再读释义，如 "名词，关系"
    return (posLabel ? posLabel + '，' : '') + gloss;
  }

  return '';
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
  const { speakByLanguage, speakChinese, stop, resetCancel } = useTTS();

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
        // If speech failed, we should still wait and go to the next word instead of completely stopping
        console.warn('[AutoPlay] Speech failed for word, continuing to next');
        // Do not return here; let it fall through so it can read definition/example, or just wait and slide
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