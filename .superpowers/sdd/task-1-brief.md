### Task 1: 修复"朗读释义"不生效的bug

**Files:**
- Modify: `src/hooks/useTTS.ts:230-237`
- Modify: `src/utils/storage.ts:46-52`

**Bug分析：**
1. `useAutoPlay` 的 `useEffect` 依赖数组只包含 `isPlaying`, `isLoading`, `currentWord`, `speak`, `nextWord`, `stop`, `resetCancel`，不包含 `settings.readDefinition` 和 `settings.readExample`
2. 用户在 SettingsModal 中切换 `readDefinition` 开关时，由于依赖数组不包含该值，effect 不会重新执行，导致新设置不生效
3. `storage.ts` 中 `getSettings()` 的默认返回值缺少 `readDefinition` 字段，已有 localStorage 数据的用户获取到的 settings 可能没有该字段

**Interfaces:**
- Consumes: `useAppStore.getState().settings` (原有接口)
- Produces: 修复后的 `useAutoPlay` 依赖数组

- [ ] **Step 1: 在 storage.ts 默认值中添加 readDefinition**

```typescript
// src/utils/storage.ts
return {
  speed: 0.5,
  speechRate: 1.0,
  readDefinition: false,    // ← 新增
  readExample: false,
  accent: 'us',
  autoPlay: true,
};
```

- [ ] **Step 2: 在 useAutoPlay 的 useEffect 依赖数组中添加 settings 相关字段**

```typescript
// src/hooks/useTTS.ts
useEffect(() => {
  // ... 现有逻辑
}, [
  isPlaying,
  isLoading,
  currentWord,
  speak,
  nextWord,
  stop,
  resetCancel,
  // 新增依赖：当用户在设置中更改这些开关时，effect 重新执行
  useAppStore.getState().settings.readDefinition,
  useAppStore.getState().settings.readExample,
  useAppStore.getState().settings.speed,
]);
```

- [ ] **Step 3: 验证修复**

```bash
npm run dev
```
手动测试：
1. 进入学习模式，开启自动朗读
2. 打开设置，开启"朗读中文释义"
3. 观察是否在单词发音后朗读中文释义
4. 关闭"朗读中文释义"，观察是否停止朗读释义

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useTTS.ts src/utils/storage.ts
git commit -m "fix: 朗读释义开关不生效（useEffect 缺少依赖项）
- 在 useAutoPlay 的 useEffect 依赖数组中添加 readDefinition/readExample/speed
- 在 storage.ts 默认值中添加 readDefinition 字段
Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

