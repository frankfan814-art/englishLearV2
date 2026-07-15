---
title: 单词表系统与朗读增强设计
date: 2026-07-15
language: zh-CN
---

# 单词表系统与朗读增强设计

## 概述

本文档描述 Vocab Master（单词朗读）应用的以下改进：

1. **Bug 修复**
   - 长单词在手机端显示不全
   - 单词底部字母被裁剪
   - 手机黑屏导致朗读停止

2. **新功能**
   - 单词表系统：按考试类型分类，每个词表独立进度
   - 首页改造：双入口设计（快速开始 + 按词表学习）
   - 朗读增强：新增"读中文释义"开关

3. **架构预留**
   - 多语种扩展支持

---

## 数据层设计

### 词表配置

新增配置文件 `src/config/wordLists.ts`：

```typescript
export interface WordList {
  id: string;           // 词表ID：'toefl', 'gre', 'cet4' 等
  name: string;         // 显示名称：'托福词汇', 'GRE词汇' 等
  tag: string;          // 对应的数据 tag 值
  language: string;     // 语言代码：'en', 'ja', 'ko' 等
  description?: string; // 可选描述
}

// 预定义词表（基于现有 tag 数据）
export const WORD_LISTS: WordList[] = [
  { id: 'toefl', name: '托福词汇', tag: 'toefl', language: 'en' },
  { id: 'gre', name: 'GRE词汇', tag: 'gre', language: 'en' },
  { id: 'cet6', name: '六级词汇', tag: 'cet6', language: 'en' },
  { id: 'ky', name: '考研词汇', tag: 'ky', language: 'en' },
  { id: 'ielts', name: '雅思词汇', tag: 'ielts', language: 'en' },
  { id: 'cet4', name: '四级词汇', tag: 'cet4', language: 'en' },
  { id: 'gk', name: '高考词汇', tag: 'gk', language: 'en' },
  { id: 'other', name: '其他词汇', tag: '', language: 'en' },
];
```

**数据来源分析**：

| 词表 | tag | 单词数 |
|------|-----|--------|
| 托福词汇 | toefl | 5,591 |
| GRE词汇 | gre | 4,917 |
| 六级词汇 | cet6 | 4,573 |
| 考研词汇 | ky | 3,956 |
| 雅思词汇 | ielts | 3,799 |
| 四级词汇 | cet4 | 2,982 |
| 高考词汇 | gk | 1,919 |
| 其他词汇 | (空) | 6,664 |

**说明**：单词可属于多个词表（一个单词可能有多个 tag）。

### 词表索引

新增 `src/utils/wordListIndex.ts`：

```typescript
// 运行时构建词表索引
// 结构：Map<tag, Set<globalIndex>>

export function buildWordListIndex(): Map<string, Set<number>>;
export function getWordIndexesByTag(tag: string): number[];
```

**实现要点**：
- 应用初始化时遍历所有单词构建索引
- 索引缓存在内存中
- `tag` 为空字符串时，收集所有无标签单词

### 存储结构扩展

`src/utils/storage.ts` 扩展：

```typescript
// 现有存储结构：
// - vocab_progress: { currentRound, currentIndex, completedRounds, lastUpdate }
// - vocab_settings: { speed, speechRate, readExample, accent, autoPlay }
// - vocab_mastered: Record<index, { word, definition }>

// 新增存储结构：
// - vocab_language: string              // 当前语言，默认 'en'
// - vocab_current_list: string          // 当前词表ID，'all' 表示全部单词
// - vocab_list_progress: Record<listId, ProgressData>  // 每个词表的独立进度

interface StorageData {
  // 现有
  progress: ProgressData;
  settings: Settings;
  masteredWords: Record<number, MasteredWordInfo>;

  // 新增
  language: string;
  currentList: string;
  listProgress: Record<string, ProgressData>;
}
```

**数据迁移策略**：
- 首次加载时，若无 `currentList`，默认为 `'all'`
- 无 `listProgress` 时，将现有 `progress` 作为 `'all'` 词表的进度
- 保持向后兼容，不破坏现有用户数据

### 数据加载器扩展

`src/utils/dataLoader.ts` 新增方法：

```typescript
class DataLoader {
  // 现有方法...

  // 新增：获取指定 tag 的所有单词索引
  getWordIndexesByTag(tag: string): number[];

  // 新增：获取指定 tag 的单词总数
  getWordCountByTag(tag: string): number;
}
```

---

## 状态管理设计

### Store 结构扩展

`src/store/useAppStore.ts` 新增状态：

```typescript
interface AppState {
  // === 现有状态 ===
  currentWord: Word | null;
  isLoading: boolean;
  error: string | null;
  currentRound: number;
  currentIndex: number;      // 当前词表内的索引
  completedRounds: number;
  totalWords: number;        // 16194（全部单词总数）
  isPlaying: boolean;
  isLearningMode: boolean;
  settings: Settings;
  masteredWords: Record<number, { word: string; definition: string }>;

  // === 新增状态 ===
  language: string;              // 当前语言 'en' | 'ja' | 'ko'
  currentList: string;           // 当前词表 'all' | 'toefl' | 'gre' 等
  listProgress: Record<string, ProgressData>;  // 每个词表独立进度
  wordIndexesInList: number[];   // 当前词表的单词全局索引数组
  listTotalWords: number;        // 当前词表单词总数

  // === 新增 Actions ===
  switchLanguage: (lang: string) => void;
  switchList: (listId: string) => void;
  loadListWord: () => Promise<void>;
}
```

### 导航逻辑变化

**现有逻辑**（全局索引）：
```
currentIndex: 0 → 1 → 2 → ... → 16193 → 0（回到第0个）
```

**新逻辑**（词表内索引）：
```
wordIndexesInList = [3, 15, 28, 102, ...]  // 托福词表包含的单词全局索引
currentIndex: 0 → 1 → 2 → ... → listTotalWords-1 → 0

实际单词全局索引 = wordIndexesInList[currentIndex]
```

**示例**：
- 用户选择"托福词表"
- `wordIndexesInList` = [3, 15, 28, 102, ...]（托福单词的全局索引）
- `listTotalWords` = 5591
- `currentIndex` = 0 时，显示 `dataLoader.getWord(wordIndexesInList[0])` 即第3号单词

### 词表切换逻辑

```typescript
switchList: (listId: string) => {
  const { listProgress, masteredWords } = get();

  // 1. 保存当前词表进度
  const currentProgress = {
    currentRound: get().currentRound,
    currentIndex: get().currentIndex,
    completedRounds: get().completedRounds,
    lastUpdate: new Date().toISOString(),
  };
  const updatedListProgress = {
    ...listProgress,
    [get().currentList]: currentProgress,
  };

  // 2. 计算目标词表的单词索引
  const wordList = WORD_LISTS.find(l => l.id === listId);
  const wordIndexesInList = wordList
    ? dataLoader.getWordIndexesByTag(wordList.tag)
    : Array.from({ length: 16194 }, (_, i) => i); // 'all' 时为全部索引

  // 3. 加载目标词表进度（若无则初始化）
  const targetProgress = updatedListProgress[listId] || {
    currentRound: 1,
    currentIndex: 0,
    completedRounds: 0,
    lastUpdate: new Date().toISOString(),
  };

  // 4. 更新状态
  set({
    currentList: listId,
    wordIndexesInList,
    listTotalWords: wordIndexesInList.length,
    currentRound: targetProgress.currentRound,
    currentIndex: targetProgress.currentIndex,
    completedRounds: targetProgress.completedRounds,
    listProgress: updatedListProgress,
  });

  // 5. 保存到存储
  storage.saveCurrentList(listId);
  storage.saveListProgress(updatedListProgress);

  // 6. 加载当前单词
  get().loadListWord();
}
```

### 已掌握单词处理

保持全局 `masteredWords`，导航时跳过已掌握单词：

```typescript
nextWord: () => {
  const { currentIndex, wordIndexesInList, listTotalWords, masteredWords } = get();

  let newIndex = currentIndex;
  let attempts = 0;

  do {
    newIndex = (newIndex + 1) % listTotalWords;
    attempts++;
    // 检查该索引对应的单词是否已掌握
  } while (
    masteredWords[wordIndexesInList[newIndex]] !== undefined
    && attempts < listTotalWords
  );

  // 更新进度...
}
```

---

## UI 组件设计

### 首页改造

修改 `src/components/Home.tsx`，新增双入口设计：

**布局**：
```
┌─────────────────────────────────┐
│                                 │
│         单词朗读                │
│       Vocab Master             │
│                                 │
│  ┌───────────────────────────┐  │
│  │      快速开始             │  │
│  │    学习全部单词           │  │
│  │    16,194 词              │  │
│  └───────────────────────────┘  │
│                                 │
│  ┌───────────────────────────┐  │
│  │     按词表学习            │  │
│  │   托福 / GRE / 四六级     │  │
│  │   选择特定词表学习        │  │
│  └───────────────────────────┘  │
│                                 │
│  当前: 英语 · 已完成 2 轮      │
│                                 │
└─────────────────────────────────┘
```

**交互**：
- 点击"快速开始"：设置 `currentList = 'all'`，进入学习页面
- 点击"按词表学习"：导航到词表选择页

### 词表选择页

新增 `src/components/WordListSelect.tsx`：

**布局**：
```
┌─────────────────────────────────┐
│  ←        选择词表              │
├─────────────────────────────────┤
│                                 │
│  ┌───────────────────────────┐  │
│  │ 托福词汇                  │  │
│  │ 5,591 词 · 第 2 轮       │  │
│  │ ████████░░░░░░░░ 45%     │  │
│  └───────────────────────────┘  │
│                                 │
│  ┌───────────────────────────┐  │
│  │ GRE词汇                   │  │
│  │ 4,917 词 · 第 1 轮       │  │
│  │ ████░░░░░░░░░░░░ 18%     │  │
│  └───────────────────────────┘  │
│                                 │
│  ┌───────────────────────────┐  │
│  │ 六级词汇                  │  │
│  │ 4,573 词 · 未开始        │  │
│  └───────────────────────────┘  │
│                                 │
│  ... (四级、考研、雅思、高考)   │
│                                 │
│  ┌───────────────────────────┐  │
│  │ 其他词汇                  │  │
│  │ 6,664 词                 │  │
│  └───────────────────────────┘  │
│                                 │
└─────────────────────────────────┘
```

**每个词表卡片显示**：
- 词表名称
- 单词数量
- 当前进度（轮次、百分比）
- 进度条

**交互**：
- 点击词表卡片：切换到该词表并进入学习页面

### 设置页面新增

修改 `src/components/SettingsModal.tsx`，新增开关：

```typescript
// Settings 类型扩展
export interface Settings {
  speed: number;
  speechRate?: number;
  accent: 'us' | 'uk';
  autoPlay: boolean;
  readExample?: boolean;      // 现有：读例句
  readDefinition?: boolean;   // 新增：读中文释义
}
```

**UI 位置**：
- 在"自动朗读例句"设置项上方新增"朗读中文释义"
- 使用相同的开关按钮样式

### 学习页面顶部信息

修改进度条区域，显示当前词表：

```
┌─────────────────────────────────┐
│  托福词汇 · 第 2 轮             │
│  ████████████░░░░░░░░ 45%       │
│  2,507 / 5,591                  │
└─────────────────────────────────┘
```

---

## TTS 朗读设计

### 朗读序列逻辑

根据 `readDefinition` 和 `readExample` 开关状态：

| readDefinition | readExample | 朗读序列 |
|----------------|-------------|----------|
| 关 | 关 | 单词 |
| 开 | 关 | 单词 → 中文释义 |
| 关 | 开 | 单词 → 例句 |
| 开 | 开 | 单词 → 中文释义 → 例句 |

### useAutoPlay 改造

修改 `src/hooks/useTTS.ts` 中的 `useAutoPlay`：

```typescript
const playCurrentWord = async () => {
  const state = useAppStore.getState();
  const settings = state.settings;

  // 1. 读单词
  const success = await speak(currentWord.word, settings.accent, settings.speechRate);
  if (!success) { /* 停止播放 */ return; }

  await delay(300);

  // 2. 如果开启读释义，读中文释义
  if (settings.readDefinition && currentWord.definition) {
    const defSuccess = await speakChinese(
      currentWord.definition.replace(/^[a-z]+\.\s*/i, '').trim(),
      settings.speechRate
    );
    if (!defSuccess) { /* 继续播放 */ }
    await delay(300);
  }

  // 3. 如果开启读例句，读例句
  if (settings.readExample && currentWord.example) {
    await speak(currentWord.example, settings.accent, settings.speechRate);
    await delay(500);
  }

  // 4. 等待用户设置的间隔后切换下一个
  timeoutId = setTimeout(() => {
    nextWord();
  }, settings.speed * 1000);
};
```

### 朗读停顿时长

- 单词 → 释义：300ms
- 释义 → 例句：300ms
- 例句 → 下一单词：用户设置的 `speed` 间隔（默认 0.5s）

---

## Bug 修复设计

### 1. 长单词溢出处理

**问题**：单词如 "electroencephalogram" 在小屏幕上溢出容器。

**解决方案**：CSS 响应式缩放 + 允许换行

修改 `src/components/WordCard.tsx`：

```tsx
// 现有：
<h1 className="text-5xl sm:text-6xl font-bold text-gradient text-center mb-6 tracking-tight">
  {word.word}
</h1>

// 修改为：
<h1 className="word-title text-gradient text-center mb-6 tracking-tight">
  {word.word}
</h1>
```

修改 `src/index.css`：

```css
.word-title {
  font-size: clamp(1.75rem, 8vw, 3.75rem);
  font-weight: 700;
  word-break: break-word;
  line-height: 1.3;
  max-width: 100%;
}
```

**效果**：
- 字体大小在 `1.75rem` ~ `3.75rem` 之间自适应
- 超长单词自动换行
- 保持视觉美观

### 2. 字母底部裁剪修复

**问题**：字母下缘如 `g`、`y`、`p` 被切掉一部分。

**解决方案**：增加 line-height 和 padding

修改 `src/index.css`：

```css
.word-title {
  font-size: clamp(1.75rem, 8vw, 3.75rem);
  font-weight: 700;
  word-break: break-word;
  line-height: 1.4;      /* 增加行高 */
  padding-bottom: 4px;   /* 增加底部空间 */
  max-width: 100%;
}
```

**效果**：
- 字母下缘完整显示
- 不影响整体布局

### 3. Wake Lock 屏幕常亮

**问题**：手机自动锁屏导致朗读停止。

**解决方案**：使用 Screen Wake Lock API

新增 `src/hooks/useWakeLock.ts`：

```typescript
import { useEffect, useRef } from 'react';

export function useWakeLock(enabled: boolean) {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!enabled) {
      // 释放 Wake Lock
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
      return;
    }

    // 检查浏览器支持
    if (!('wakeLock' in navigator)) {
      console.warn('Wake Lock API not supported');
      return;
    }

    // 请求 Wake Lock
    navigator.wakeLock.request('screen')
      .then(wakeLock => {
        wakeLockRef.current = wakeLock;

        // 监听释放事件（如用户切换标签页、最小化窗口）
        wakeLock.addEventListener('release', () => {
          wakeLockRef.current = null;
        });
      })
      .catch(err => {
        console.warn('Wake Lock request failed:', err);
      });

    // 清理
    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    };
  }, [enabled]);
}
```

在 `src/App.tsx` 中使用：

```typescript
import { useWakeLock } from './hooks/useWakeLock';

function App() {
  const isPlaying = useAppStore(state => state.isPlaying);

  // 播放时保持屏幕常亮
  useWakeLock(isPlaying);

  // ... 其余代码
}
```

**兼容性处理**：
- Wake Lock API 支持：Chrome 84+、Edge 84+、Safari 16.4+
- 不支持的浏览器：静默失败，不阻断用户
- 低电量或权限拒绝：优雅降级，继续播放

**页面可见性处理**：
- 页面隐藏时 Wake Lock 自动释放（浏览器行为）
- 页面恢复时重新请求（如果仍在播放）

---

## 架构预留：多语种扩展

### 数据结构

```typescript
// 词表配置
export interface WordList {
  id: string;
  name: string;
  tag: string;
  language: string;  // 'en', 'ja', 'ko', 'fr', 'de', 'es' 等
  description?: string;
}

// 按语言分组
export const WORD_LISTS_BY_LANGUAGE: Record<string, WordList[]> = {
  en: [ /* 英语词表 */ ],
  ja: [ /* 日语词表 */ ],
  ko: [ /* 韩语词表 */ ],
};
```

### 存储结构

```typescript
interface StorageData {
  language: string;  // 当前语言
  // ...
}
```

### Store 结构

```typescript
interface AppState {
  language: string;  // 当前语言
  switchLanguage: (lang: string) => void;
  // ...
}
```

### 数据文件

```
public/data/
  ├── en/
  │   ├── words-001.json
  │   └── ...
  ├── ja/
  │   ├── words-001.json
  │   └── ...
  └── ko/
      ├── words-001.json
      └── ...
```

**说明**：本次实现仅支持英语，但架构设计预留扩展接口，后续新增语种只需：
1. 添加对应的数据文件
2. 更新词表配置
3. 无需修改核心逻辑

---

## 实现优先级

### Phase 1：Bug 修复（优先）

1. 修复长单词溢出
2. 修复字母底部裁剪
3. 实现 Wake Lock 屏幕常亮

### Phase 2：单词表系统核心

1. 实现词表索引构建
2. 扩展 Store 和 Storage
3. 实现词表切换逻辑

### Phase 3：UI 改造

1. 改造首页双入口
2. 实现词表选择页
3. 修改学习页面显示当前词表

### Phase 4：朗读增强

1. 实现读中文释义开关
2. 改造 useAutoPlay 逻辑
3. 更新设置页面 UI

---

## 测试要点

### 功能测试

- [ ] 词表切换后进度独立保存
- [ ] 已掌握单词在所有词表中生效
- [ ] 切换词表后导航逻辑正确
- [ ] 长单词在小屏幕上正常显示
- [ ] 字母下缘完整显示
- [ ] 播放时屏幕保持常亮
- [ ] 朗读序列符合开关组合
- [ ] 首页双入口导航正确

### 兼容性测试

- [ ] Chrome/Edge：Wake Lock API 正常工作
- [ ] Safari：降级处理正常
- [ ] 移动端浏览器：锁屏测试
- [ ] 现有用户数据迁移成功

### 性能测试

- [ ] 词表索引构建时间（预计 < 100ms）
- [ ] 词表切换响应时间（预计 < 50ms）
- [ ] 16K 单词运行时过滤性能

---

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Wake Lock API 兼容性 | 部分浏览器不支持 | 静默降级，不影响核心功能 |
| 数据迁移失败 | 用户进度丢失 | 保留旧数据格式，渐进迁移 |
| 词表索引内存占用 | 约 100KB（可接受） | 按需加载，不预加载所有词表 |
| 单词重复出现在多词表 | 用户困惑 | 在 UI 标明单词可能属于多个词表 |

---

## 后续扩展

1. **用户自定义词表**：允许用户创建生词本
2. **词表统计**：每个词表的掌握率、学习时长
3. **词表分享**：导出/导入词表配置
4. **多语种切换**：在设置中选择学习语言