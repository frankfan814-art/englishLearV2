# Task 6 Report: 学习页 UI 适配多语言

## 完成状态: DONE

## 变更文件

### Part A: Fix Task 4 regression
- `src/hooks/useTTS.ts` — `speakByLanguage` 在 `ttsConfig.mode === 'youdao'` 时添加了 Web Speech API fallback，与 `speak()` 函数逻辑一致

### Part B: Task 6 实现
- `src/App.tsx` — Header Logo 字母根据语言变化 (en→E, ja→日, ko→한, de→D)；副标题根据语言变化 (en→Vocab Master, ja→日本語マスター, ko→단어 마스터, de→Wortmeister)
- `src/components/WordCard.tsx` — 新增 `language` prop；tag 为空时显示语言名称 (ja→日本語, ko→한국어, de→DEUTSCH) 而非固定 'VOCAB'
- `src/components/SettingsModal.tsx` — 发音口音区域动态化：英语 (2 options) 显示按钮网格，其他语言 (1 option) 显示"标准发音"标签

## 构建验证
`npm run build` 通过，无 TypeScript 错误

## Commit
`d81e932` on branch `multilang-support`
