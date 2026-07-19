# AGENTS.md

本文件面向 AI 编码代理，介绍本仓库的架构、命令与约定。读者不需要任何项目背景知识。

## 项目概述

「单词朗读」（包名 `vocab-app`，Android appId `com.vocab.app`）是一款极简单词朗读学习应用：自动朗读单词、显示释义、按"轮次"刷词，支持"已掌握"单词跳过、按标签筛选词表、多语言切换。无登录、无后端、无路由，是纯前端单页应用（SPA），通过 Capacitor 打包为 Android APK。

- 入口：`index.html` → `src/main.tsx`（StrictMode）→ `src/App.tsx`
- 界面分两屏：首页 `Home`（选语言/选词表/开始学习）与学习页（`isLearningMode=true` 时的 WordCard 刷词界面）
- 支持语言：英语（en）、日语（ja）、韩语（ko）、德语（de），在 `src/config/wordLists.ts` 的 `LANGUAGES` 中定义
- 注意：`public/data/` 下存在 `fr/`、`es/` 分片数据（各 1 个 `words-001.json`），但未在 `LANGUAGE_CONFIGS` 中注册，当前不可用

## 技术栈

- React 18（函数组件 + Hooks）+ TypeScript 5.6（strict 模式）+ Vite 6
- 状态管理：Zustand 4（单一 store，无 Redux、无路由库）
- 样式：Tailwind CSS 3 + CSS 变量主题（仅暗色，变量直接定义在 `:root`），shadcn/ui（components.json 风格 `base-nova`，baseColor `neutral`），图标用 lucide-react
- 移动端：Capacitor 7（仅配置了 android 平台，iOS 未添加，方案见 `docs/ios-testing-plan.md`）
- 发音：英语走网易有道词典音频 API（Web Speech 兜底），其他语言走浏览器 Web Speech API

## 常用命令

```bash
npm run dev        # 开发服务器，端口 3000
npm run build      # tsc -b 类型检查 + vite build → dist/
npm run preview    # 预览构建产物
npm run cap:sync   # 将 dist/ 同步到 android/
npm run cap:open   # 打开 Android Studio 构建 APK
```

注意事项：

- `npm run lint` 存在于 package.json，但仓库中**没有 eslint 配置文件**（ESLint 9 需要 `eslint.config.js`），该命令当前无法正常运行。提交前请以 `npm run build`（含 tsc 严格检查）作为质量门禁。
- 没有任何自动化测试框架（无 vitest/jest，无 test 脚本）。验证方式为手动运行 dev server 或构建后在真机/模拟器测试。
- 数据生成脚本在 `scripts/`（`generate_dict.js`、`free_crawler.js`、`mock_data.js` 为 Node ESM 脚本，`tag-jlpt.py` 为 Python 脚本），从仓库根目录运行；`scripts/raw/` 存放原始语料（如 `ja_50k.txt`）。这些脚本依赖翻译 API，仅用于离线生成词库，不属于应用运行时。`generate_dict.js` 会在输出目录写 `progress_ai.json` 断点续跑文件（`public/data/ja/progress_ai.json` 即是其产物，会被一并拷入 dist，无害）。

## 目录结构与模块划分

```
src/
  App.tsx                 主布局（首页/学习页切换）、键盘快捷键、页面可见性处理
  main.tsx                React 挂载入口
  index.css               全局样式：暗色主题 CSS 变量（:root）、玻璃拟态、动画
  components/             业务组件：Home / WordCard / SettingsModal /
                          MasteredList / ProgressBar / WordListSelect / GradientProgress
  components/ui/          shadcn/ui 基础组件（button/card/dialog/drawer/progress）
  config/wordLists.ts     LANGUAGES（含各语言 TTS 配置）、WORD_LISTS（词表 id→tag 映射）
  hooks/useTTS.ts         useTTS / useAutoPlay / unlockAudio
  hooks/useWakeLock.ts    播放期间屏幕常亮
  store/useAppStore.ts    Zustand 全局状态（唯一事实来源）
  utils/dataLoader.ts     分片懒加载 DataLoader 类
  utils/languageRegistry.ts 各语言 DataLoaderConfig 与工厂（getDataLoader / getTotalWords）
  utils/wordListIndex.ts  标签→全局索引映射，加速词表筛选
  utils/storage.ts        localStorage 封装
  lib/utils.ts            cn() 等 shadcn 工具函数
  types/word.ts           Word / Settings / ProgressData / DataLoaderConfig 等类型
public/data/              词库 JSON 分片（构建时原样拷入 dist/）
scripts/                  离线词库生成/标注脚本（非运行时）
android/                  Capacitor 生成的 Android 工程
docs/                     设计文档（ios-testing-plan.md、superpowers/plans 与 superpowers/specs）
```

## 核心架构要点

### 状态管理

`src/store/useAppStore.ts` 是唯一状态源：单词数据、轮次进度、设置、播放状态、已掌握单词、当前词表（`currentList`）、多语言状态（`currentLanguage`）。进度与设置通过 `src/utils/storage.ts` 持久化到 localStorage，键包括：

- `vocab_settings`：Settings（`speed` 词间间隔秒数、`speechRate` 语速、`readDefinition`、`readExample`、`accent`、`autoPlay`）
- `vocab_progress`：旧版全局进度（仅"全部单词"词表使用）
- `vocab_list_progress`：按词表 id 存储的进度
- `vocab_mastered`：已掌握单词，`Record<全局索引, {word, definition}>`
- `vocab_current_list` / `vocab_current_language`：当前词表 / 当前语言

已知怪癖：`vocab_mastered` 按**全局索引**记录且不按语言区分，在某一语言标记"已掌握"会影响其他语言相同索引的单词。改动相关逻辑时注意这一点。

### 数据加载

词库是分片 JSON，`DataLoader` 按需懒加载（内存缓存 + 在途请求去重）+ 相邻分片预加载（`preloadAdjacent`，当前分片 ±1）：

| 语言 | 路径 | 分片 | 词数 |
|------|------|------|------|
| en | `/data/words-XXX.json` | 17 × 1000（末片 194） | 16,194 |
| ja | `/data/ja/words-XXX.json` | 4 × 5000（末片 4929） | 19,929 |
| ko / de | `/data/{lang}/words-001.json` | 1 | 各 5,000 |

- 分片文件名从 001 开始、三位数字补齐；分片内为 `{ shardIndex, totalShards, words: Word[] }`。
- 新增语言需要三步：在 `public/data/{lang}/` 放分片 → 在 `src/utils/languageRegistry.ts` 的 `LANGUAGE_CONFIGS` 注册 → 在 `src/config/wordLists.ts` 的 `LANGUAGES` 与 `WORD_LISTS` 中添加条目。
- 词表筛选基于单词的 `tag` 字段（多标签以空白分隔，无标签归入空串 `''`）。`wordListIndex.ts` 全量扫描建立 `Map<tag, Set<全局索引>>` 并按语言缓存。`WORD_LISTS` 中 tag 为 `*` 表示该语言全部单词。
- 预定义词表：英语（托福/GRE/四六级/考研/雅思/高考/其他/全部）、日语（全部 + JLPT N5–N1）、韩语（全部）、德语（全部）。
- `dataLoader.ts` 末尾导出的 `dataLoader` 单例已标记 `@deprecated`，新代码请用 `getDataLoader(language)`。

### TTS 系统（`src/hooks/useTTS.ts`）

- 英语：有道音频 `https://dict.youdao.com/dictvoice?audio={word}&type={1|2}`（type 2 美式 / 1 英式），5 秒超时或出错时回退 Web Speech
- 日/韩/德：Web Speech API（`speechSynthesis`），按 `ttsConfig.webspeechLang` 选 voice；中文释义固定走 `zh-CN`
- 全局单例 `Audio` 实例；移动端必须先在用户手势中调用 `unlockAudio()` 解锁自动播放
- 取消机制：`currentSpeakRef` 自增 speakId，过期回调一律丢弃；`stop()` 置 cancelled 标志
- `useAutoPlay()` 编排完整播放序列：单词 → 300ms →（可选）中文释义 → 300ms →（可选）例句 → 500ms → 间隔 `settings.speed` 秒后 `nextWord()`
- 其他行为：学习页支持键盘快捷键（←/→ 切换单词，空格播放/暂停）；页面切入后台（`visibilitychange`）自动暂停；播放期间 `useWakeLock` 保持屏幕常亮
- 注意：`@capacitor-community/text-to-speech` 在依赖中但 src 内未引用，当前 TTS 全部走 Web 方案

## 代码风格约定

- TypeScript strict 模式，开启 `noUnusedLocals` / `noUnusedParameters` / `noFallthroughCasesInSwitch` / `noUncheckedSideEffectImports`，提交前必须能通过 `npm run build`
- 路径别名 `@/` → `src/`（tsconfig 与 vite.config.ts 均已配置）
- 函数组件 + Hooks；业务状态一律放入 Zustand store，不引入新状态库
- 样式用 Tailwind 原子类；主题色使用 `src/index.css` 中的 CSS 变量（dark only），不要硬编码颜色
- UI 基础组件优先复用 `src/components/ui/`（shadcn 风格）；合并类名用 `@/lib/utils` 的 `cn()`
- 注释与文档使用中文（现有代码注释、REQUIREMENT.md、TECHNICAL_DESIGN.md 均为中文）

## 构建与部署

- Web 构建产物输出到 `dist/`；**`dist/` 已在 `.gitignore` 中，不随仓库提交**，克隆后需先 `npm run build` 再 `cap:sync`
- Android：`capacitor.config.ts`（appId `com.vocab.app`，webDir `dist`）；本地用 `npm run cap:sync` + Android Studio
- debug 签名：`android/app/debug.keystore` 已提交仓库并在 `android/app/build.gradle` 的 `signingConfigs.debug` 中固定（标准 debug 口令 `android`/`androiddebugkey`），本地与 CI 打出的包签名一致可覆盖安装；**不要删除或重新生成该文件**，否则已安装用户又会被迫卸载重装
- CI 有两个 GitHub Actions 工作流：
  - `.github/workflows/build-apk.yml`：push 到 main（或手动触发）时构建 debug APK，发布到 GitHub Releases（tag `latest`），并上传蒲公英（需 Secrets 配置 `PGYER_API_KEY`，构建摘要会输出两个手机直装链接；Node 22 + Java 21）
  - `.github/workflows/android-build.yml`：push/PR 到 main 时仅构建验证并上传 artifact，不发版（Node 20 + Java 21）

## 安全注意事项

- 无任何密钥/凭证管理需求：有道音频 API 为公开接口，客户端直接调用
- `scripts/` 中的爬虫/翻译脚本使用公开翻译 API（`@vitalets/google-translate-api`、`bing-translate-api`）与代理（`https-proxy-agent`），不要把任何 API key 提交进仓库
- 用户数据仅存于浏览器 localStorage，不上传任何服务器

## 文档与现实的偏差提醒

- `TECHNICAL_DESIGN.md` 中写的 Vite 5 / Capacitor 6 / IndexedDB 缓存已过时：实际为 Vite 6 / Capacitor 7，存储仅 localStorage
- `docs/superpowers/` 下的 plans/specs 是历次功能（Android 打包、词表与 TTS 增强、多语言）的设计档案，可作背景参考，但不保证与当前代码完全一致
- `CLAUDE.md` 内容与本文件大体一致，可作为补充参考
