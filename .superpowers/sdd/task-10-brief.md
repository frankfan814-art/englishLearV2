# Task 10 Brief: 实现读中文释义功能

## Files
- Modify: `src/hooks/useTTS.ts`
- Modify: `src/components/SettingsModal.tsx`

## Interfaces
- Consumes: `Settings.readDefinition`
- Produces: `useAutoPlay` 支持读释义序列

## Requirements

### Step 1: 改造 useAutoPlay hook

修改 `src/hooks/useTTS.ts` 中的 `playCurrentWord` 函数。找到 `useAutoPlay` 中的 `playCurrentWord` 函数，修改为：

```typescript
const playCurrentWord = async () => {
  const state = useAppStore.getState();
  const settings = state.settings;

  // 1. 读单词（真实人声优先）
  const success = await speak(currentWord.word, settings.accent, settings.speechRate || 1.0);

  if (!isActive) return;

  if (!success) {
    console.warn('[AutoPlay] Speech failed, stopping playback');
    useAppStore.setState({ isPlaying: false });
    return;
  }

  // 2. 稍微停顿
  await new Promise(r => setTimeout(r, 300));
  if (!isActive) return;

  const currentSettings = useAppStore.getState().settings;

  // 3. 如果开启了读释义，读中文释义
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

  // 4. 如果开启了自动读例句，并且有例句，则读英文例句
  if (currentSettings.readExample && currentWord.example) {
    const exampleSuccess = await speak(currentWord.example, currentSettings.accent, currentSettings.speechRate || 1.0);
    if (!isActive) return;
    if (!exampleSuccess) {
      console.warn('[AutoPlay] Example speech failed, but continuing to next word');
    }
    await new Promise(r => setTimeout(r, 500));
  }

  // 5. 等待用户设置的间隔后切换下一个
  timeoutId = setTimeout(() => {
    if (isActive) {
      const stillPlaying = useAppStore.getState().isPlaying;
      if (stillPlaying) {
        nextWord();
      }
    }
  }, currentSettings.speed * 1000);
};
```

### Step 2: 在设置页面添加读释义开关

修改 `src/components/SettingsModal.tsx`，在"自动朗读例句"设置项之前添加"朗读中文释义"设置项。

在 `DrawerContent` 内，找到"自动朗读例句"设置项，在其前面添加：

```typescript
{/* 朗读中文释义 */}
<div>
  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
    朗读中文释义
  </label>
  <div className="grid grid-cols-2 gap-3">
    <Button
      variant={!settings.readDefinition ? 'default' : 'outline'}
      onClick={() => onUpdateSettings({ readDefinition: false })}
      className="font-medium"
    >
      关闭
    </Button>
    <Button
      variant={settings.readDefinition ? 'default' : 'outline'}
      onClick={() => onUpdateSettings({ readDefinition: true })}
      className="font-medium"
    >
      开启
    </Button>
  </div>
  <p className="text-xs text-muted-foreground mt-2">
    开启后：单词 → 中文释义
  </p>
</div>
```

### Step 3: 手动测试

运行 `npm run dev`，测试：
1. 进入设置，开启"朗读中文释义"
2. 开始自动朗读
3. 确认朗读序列为：单词 → 中文释义
4. 同时开启"朗读中文释义"和"朗读例句"
5. 确认朗读序列为：单词 → 中文释义 → 例句

### Step 4: 提交

```bash
git add src/hooks/useTTS.ts src/components/SettingsModal.tsx
git commit -m "feat(tts): add read Chinese definition option

- Add readDefinition to Settings
- Update useAutoPlay to speak definition after word
- Add toggle in settings modal
- Support sequence: word → definition → example

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

## Report Contract

After completing the task, write a report to `E:/work/englishLearn/.superpowers/sdd/task-10-report.md` with:
1. Changes made
2. Test results (TypeScript check, build)
3. Any concerns or issues encountered
4. Commit hash

Then report status: DONE, DONE_WITH_CONCERNS, NEEDS_CONTEXT, or BLOCKED