# 多语言词库集成设计文档

**日期**: 2026-07-16
**状态**: 已确认

---

## 1. 概述

将现有英语单词学习应用扩展为多语言词汇学习工具，支持日语、韩语、德语等语种。用户通过首页语言Tab切换语种，每个语种有独立的词库、词表分类、发音方式和学习进度。

## 2. 核心理念

- **按语种独立**：每种语言独立管理数据加载、词表分类、进度存储
- **复用现有流程**：学习模式的核心逻辑（自动播放、进度追踪、已掌握标记）保持不变，只做语言感知适配
- **渐进扩展**：新语言只需添加数据文件 + 一条配置即可接入

## 3. 架构总览

```
┌──────────────────────────────────────────────────────────┐
│                         UI Layer                          │
│   Home (语言Tab + 进度)    WordCard    SettingsModal      │
│   WordListSelect            ProgressBar                  │
├──────────────────────────────────────────────────────────┤
│                      Store (Zustand)                      │
│   currentLanguage  →  影响 DataLoader / TTS / 词表列表    │
│   currentList      →  切换到该语言下的具体词表             │
├──────────────────────────────────────────────────────────┤
│                      Data Layer                           │
│   languageRegistry  →  DataLoader(lang)  →  分片JSON数据  │
│   wordListIndex     →  按tag构建索引                       │
│   wordLists.ts      →  按语言分组的词表配置                 │
├──────────────────────────────────────────────────────────┤
│                      TTS Layer                            │
│   语言感知的 speakByLanguage()                             │
│   ├── en: 有道API（真人发音）                              │
│   ├── ja: Web Speech API (ja-JP)                          │
│   ├── ko: Web Speech API (ko-KR)                          │
│   └── de: Web Speech API (de-DE)                          │
├──────────────────────────────────────────────────────────┤
│                      Storage                              │
│   localStorage: 词表ID → ProgressData                     │
│   masteredWords: globalIndex → { word, definition }       │
│   currentLanguage: 'en' | 'ja' | 'ko' | 'de'             │
└──────────────────────────────────────────────────────────┘
```

## 4. 数据层

### 4.1 文件结构

```
public/data/
  words-001.json  ~ words-017.json    # 英语（保持现有路径，兼容）
  ja/words-001.json  ~ words-004.json  # 日语，每片5000词
  ko/words-001.json                    # 韩语
  de/words-001.json                    # 德语
  fr/words-001.json                    # 法语（可选）
  es/words-001.json                    # 西语（可选）
```

### 4.2 DataLoader 重构

从单例变为可实例化，每种语言一个实例：

```
class DataLoader(config: DataLoaderConfig)
├── basePath: string      // '/data/' 或 '/data/ja/'
├── shardSize: number     // 英文1000，日韩德5000
├── totalShards: number
└── filePattern: string   // 'words-{index}.json'
```

语言配置注册表：

| 语言 | basePath | shardSize | totalShards |
|------|----------|-----------|-------------|
| en | /data/ | 1000 | 17 |
| ja | /data/ja/ | 5000 | 4 |
| ko | /data/ko/ | 5000 | 1 |
| de | /data/de/ | 5000 | 1 |

`getDataLoader(language)` 按需创建并缓存实例。

### 4.3 词表配置

`wordLists.ts` 增加 `Language` 接口和 `LANGUAGES` 注册表：

```typescript
interface Language {
  code: string;        // 'en' | 'ja' | 'ko' | 'de'
  name: string;        // '英语' | '日语' | '韩语' | '德语'
  flag: string;        // emoji flag
  ttsConfig: TTSConfig;
}

interface TTSConfig {
  mode: 'youdao' | 'webspeech';
  webspeechLang?: string;
  accentOptions: { label: string; value: string }[];
}
```

`WordList` 增加 `language` 字段：
- `en_all`, `toefl`, `gre`, `cet6`, `ky`, `ielts`, `cet4`, `gk`, `other`
- `ja_all`（后续可扩展为 `jlpt_n5` ... `jlpt_n1`）
- `ko_all`（后续可扩展为 `topik_1`, `topik_2`）
- `de_all`（后续可扩展为 `goethe_a1` ... `goethe_c2`）

### 4.4 wordListIndex 改造

`buildWordListIndex()` 需要知道当前语言的 `totalWords` 和 `dataLoader`。改为接受 `language` 参数：

```typescript
export async function buildWordListIndex(language: string): Promise<Map<string, Set<number>>>
```

## 5. Store 改造

### 5.1 新增字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `currentLanguage` | `string` | 当前语种，从 localStorage 恢复 |

### 5.2 新增 Action

**`switchLanguage(lang)`**：
1. 保存当前词表进度
2. 切换 DataLoader → `getDataLoader(lang)`
3. 重新构建该语言的 wordListIndex
4. 加载该语言上次选择的词表（或默认词表）
5. 更新 settings.accent 为该语言的默认值

### 5.3 改造 Action

- **`initialize()`**：从 localStorage 恢复 `currentLanguage`
- **`switchList(listId)`**：根据 wordList.language 获取对应 DataLoader
- **`loadListWord()`**：使用当前语言的 DataLoader
- **`totalWords`**：从 `LANGUAGE_CONFIGS[currentLanguage]` 动态计算

## 6. TTS 改造

### 6.1 核心方法

```typescript
// 语言感知的发音
speakByLanguage(speakId, word, language, accent, rate): Promise<boolean>
  ├── language === 'en' → 有道API + Web Speech 降级
  └── other            → Web Speech API

// 中文释义朗读（所有语言共用）
speakChinese(text, rate): Promise<boolean>
  └── Web Speech API (zh-CN)

// 例句朗读
speakExample(speakId, text, language, accent, rate): Promise<boolean>
  └── 委托给 speakByLanguage
```

### 6.2 useAutoPlay 适配

从 store 读取 `currentLanguage`，自动播放流程：
1. 读单词（speakByLanguage）
2. 停顿 300ms
3. 读中文释义（speakChinese，可选）
4. 停顿 300ms
5. 读例句（speakByLanguage，可选）
6. 等待间隔 → 下一个词

## 7. UI 改造

### 7.1 首页 Home.tsx

- **新增 LanguageTabBar**：顶部滑动的语言标签页（英语/日语/韩语/德语），带emoji国旗
- **"快速开始"按钮**：文字和词数随当前语言动态变化
- **"按词表学习"按钮**：提示文字随当前语言变化
- **进度统计**：显示当前语言的当前词表进度
- **当前语言按"快速开始"**：固定选择该语言的 `*_all` 词表

### 7.2 词表选择 WordListSelect.tsx

- 根据 `currentLanguage` 过滤显示该语言下的词表列表
- 每个词表显示名称、词数、进度条

### 7.3 WordCard 适配

| 显示项 | 英文 | 日语 | 韩语 | 德语 |
|--------|------|------|------|------|
| 音标 | 自定义音标符号 | 假名/罗马音 | 韩文读音 | IPA |
| 词性 | 从释义解析/pos字段 | pos字段直接显示 | pos字段直接显示 | pos字段直接显示 |
| 释义 | 中文释义 | 中文释义 | 中文释义 | 中文释义 |
| 例句 | 原文+中文翻译 | 原文+中文翻译 | 原文+中文翻译 | 原文+中文翻译 |
| tag显示 | CET4/TOEFL等 | （后续补充JLPT） | TOPIK | Goethe |

### 7.4 SettingsModal 适配

- **发音口音**：英语显示美式/英式，其他语言显示"标准发音"（非切换项）
- 其他设置项（速度、语速、读释义、读例句）保持不变

### 7.5 学习模式 Header

- **Logo字母**：根据当前语言变化（E→J→K→D）
- **标题**：根据当前语言变化（"单词朗读" → "单词朗读"通用即可，语言在Tab已体现）

## 8. 存储方案

### 8.1 localStorage Key

| Key | 内容 |
|-----|------|
| `vocab_current_language` | `'en' | 'ja' | 'ko' | 'de'` |
| `vocab_current_list` | 词表ID（如 `en_all`、`ja_all`） |
| `vocab_list_progress` | `{ [listId]: ProgressData }` |
| `vocab_mastered` | `{ [globalIndex]: { word, definition } }` |
| `vocab_settings` | Settings 对象 |

### 8.2 跨语言隔离

- 不同语言用不同词表ID，天然隔离进度
- masteredWords 的 globalIndex 在不同 DataLoader 下指向不同数据，天然隔离
- 当前已掌握词不跨语言共享（已掌握英文词不代表已掌握日语词）

## 9. 实施顺序

| 阶段 | 内容 |
|------|------|
| **阶段1：数据层** | DataLoader重构 + languageRegistry + wordLists配置 |
| **阶段2：Store** | 增加 currentLanguage + switchLanguage action |
| **阶段3：wordListIndex** | 支持按语言构建索引 |
| **阶段4：TTS** | speakByLanguage 多语言支持 |
| **阶段5：首页UI** | LanguageTabBar + 首页适配 |
| **阶段6：学习页UI** | WordCard/Header/WordListSelect 适配 |
| **阶段7：Settings** | SettingsModal 语言感知适配 |
| **阶段8：测试** | 各语言学习流程验证 |

## 10. 注意事项

1. **英语数据路径兼容**：英语数据在 `/data/` 根目录而非 `/data/en/`，DataLoader 配置中 `basePath: '/data/'` 直接兼容，无需移动文件
2. **日语tag补充**：当前日语词库tag均为空，JLPT分类需要后续标注数据（不属于本次开发范围），当前只显示"全部词汇"一项
3. **有道API仅支持英语**：`dict.youdao.com/dictvoice` 只提供英语和少量其他语言，确认只用于英语
4. **Web Speech API 兼容性**：不同浏览器/OS对日语、韩语、德语TTS支持质量不同，属于前端固有局限
5. **Android APK**：Capacitor打包后 Web Speech API 可用性取决于系统 WebView，可能需要测试