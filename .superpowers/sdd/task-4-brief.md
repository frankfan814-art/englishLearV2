### Task 4: 改造 TTS 支持多语言

**Files:**
- Modify: `src/hooks/useTTS.ts`

**说明：**
`useTTS` 和 `useAutoPlay` 根据当前语言选择发音方式：英语走有道API，其他语言走 Web Speech API。

**Interfaces:**
- Consumes: `currentLanguage` (from store), `getLanguageInfo(lang)`
- Produces: 语言感知的 `speakByLanguage`, `speakExample`, 改造后的 `useAutoPlay`

- [ ] **Step 1: 添加 speakByLanguage 方法**

```typescript
// src/hooks/useTTS.ts 新增
import { getLanguageInfo } from '../config/wordLists';

// 在 useTTS hook 内新增方法
const speakByLanguage = useCallback(async (
  speakId: number,
  text: string,
  language: string,
  accent: string,
  rate: number = 1.0
): Promise<boolean> => {
  const langConfig = getLanguageInfo(language);
  if (!langConfig) {
    // 未知语言，用 Web Speech 兜底
    return await speakTTS(speakId, text, 'en-US', rate);
  }

  const { ttsConfig } = langConfig;

  if (ttsConfig.mode === 'youdao') {
    return await speakRealAudio(speakId, text, accent as 'us' | 'uk', rate);
  }

  const lang = ttsConfig.webspeechLang || `${language}-${language.toUpperCase()}`;
  return await speakTTS(speakId, text, lang, rate);
}, [speakRealAudio, speakTTS]);

// 返回增加 speakByLanguage
return { speak, speakChinese, speakByLanguage, stop, resetCancel };
```

- [ ] **Step 2: 改造 useAutoPlay 使用语言感知发音**

```typescript
// useAutoPlay 中
const { speak, speakChinese, speakByLanguage, stop, resetCancel } = useTTS();

// 在 playCurrentWord 中：
const currentLanguage = useAppStore.getState().currentLanguage;
const currentSettings = useAppStore.getState().settings;

// 1. 读单词
const success = await speakByLanguage(
  speakId, currentWord.word, currentLanguage,
  currentSettings.accent, currentSettings.speechRate || 1.0
);

// 4. 读例句（如果开了）
if (currentSettings.readExample && currentWord.example) {
  const exampleSuccess = await speakByLanguage(
    speakId, currentWord.example, currentLanguage,
    currentSettings.accent, currentSettings.speechRate || 1.0
  );
}
```

- [ ] **Step 3: 完整修改 useTTS.ts 中的 useAutoPlay**

```typescript
// useAutoPlay 完整修改
export function useAutoPlay() {
  const { speak, speakChinese, speakByLanguage, stop, resetCancel } = useTTS();

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
      const currentLanguage = state.currentLanguage;

      // 1. 读单词（语言感知）
      const success = await speakByLanguage(
        Date.now(), currentWord.word, currentLanguage,
        settings.accent, settings.speechRate || 1.0
      );

      if (!isActive) return;

      if (!success) {
        console.warn('[AutoPlay] Speech failed, stopping playback');
        useAppStore.setState({ isPlaying: false });
        return;
      }

      // 2. 停顿
      await new Promise(r => setTimeout(r, 300));
      if (!isActive) return;

      const currentSettings = useAppStore.getState().settings;

      // 3. 读中文释义
      if (currentSettings.readDefinition && currentWord.definition) {
        const cleanDef = currentWord.definition.replace(/^[a-z]+\.\s*/i, '').trim();
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

      // 4. 读例句（语言感知）
      if (currentSettings.readExample && currentWord.example) {
        const exampleSuccess = await speakByLanguage(
          Date.now(), currentWord.example, currentLanguage,
          currentSettings.accent, currentSettings.speechRate || 1.0
        );
        if (!isActive) return;
        if (!exampleSuccess) {
          console.warn('[AutoPlay] Example speech failed, but continuing');
        }
        await new Promise(r => setTimeout(r, 500));
      }

      // 5. 等待间隔
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
    useAppStore.getState().settings.readDefinition,
    useAppStore.getState().settings.readExample,
    useAppStore.getState().settings.speed,
  ]);
}
```

- [ ] **Step 4: 验证**

```bash
npm run build
```
确保没有 TypeScript 编译错误。

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useTTS.ts
git commit -m "feat: TTS 支持多语言发音
- 新增 speakByLanguage 方法，英语走有道API，其他走Web Speech
- useAutoPlay 使用语言感知的 speakByLanguage
- 修复 readDefinition 依赖缺失问题
Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

