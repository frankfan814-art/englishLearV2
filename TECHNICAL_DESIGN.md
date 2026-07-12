# 英语单词朗读学习 APP - 技术设计文档

## 1. 技术选型

### 1.1 核心技术栈

| 层 | 技术 | 版本 | 说明 |
|----|------|------|------|
| 框架 | React | 18.x | 函数组件 + Hooks |
| 构建 | Vite | 5.x | 快速开发构建 |
| 样式 | Tailwind CSS | 3.x | 原子化CSS，移动端适配 |
| 状态管理 | Zustand | 4.x | 轻量，替代Redux |
| 路由 | 无 | - | 单页应用，不需要路由 |
| 存储 | localStorage + IndexedDB | - | 进度用localStorage，词库缓存用IndexedDB |
| 发音 | Capacitor TTS Plugin | - | 原生TTS，离线可用 |
| 打包 | Capacitor | 6.x | Web → Android APK |

### 1.2 为什么选择 Capacitor？

| 方案 | 能否复用Web代码 | TTS支持 | 后台播放 | APK体积 | 推荐度 |
|------|:---:|:---:|:---:|:---:|:---:|
| **Capacitor** | ✅ 100%复用 | ✅ 原生插件 | ✅ 需自定义插件 | ~8MB | ⭐⭐⭐⭐⭐ |
| TWA/PWA | ✅ | ✅ Chrome支持 | ❌ 不支持 | ~1MB | ⭐⭐ |
| React Native | ❌ 需重写 | ✅ | ✅ | ~25MB | ⭐⭐ |
| Cordova | ✅ | ✅ 插件 | ✅ 插件 | ~10MB | ⭐⭐⭐ |

**结论**：Capacitor 是最佳选择，代码100%复用，生态成熟，打包体积小。

### 1.3 关键技术决策

| 问题 | 决策 | 理由 |
|------|------|------|
| TTS方案 | `@capacitor-community/text-to-speech` | Android原生TTS，离线可用，质量稳定 |
| 后台播放 | Phase 2 自定义插件 | Phase 1 仅前台播放，Phase 2 开发原生Foreground Service |
| 词库存储 | JSON分片 + IndexedDB缓存 | 2万词分20片，首屏加载快，内存占用低 |
| 进度存储 | localStorage | 数据量小（<1KB），无需复杂方案 |

---

## 2. 项目结构

```
englishLearn/
├── public/
│   ├── data/                      # 词库JSON分片
│   │   ├── words-001.json         # 第1-1000词
│   │   ├── words-002.json         # 第1001-2000词
│   │   └── ...                    # 共20个文件
│   ├── audio/                     # 音频文件（可选，Phase 2）
│   │   ├── us/                    # 美式发音
│   │   └── uk/                    # 英式发音
│   ├── manifest.json              # PWA配置
│   └── icons/                     # APP图标
├── src/
│   ├── components/
│   │   ├── WordCard.tsx           # 单词卡片组件
│   │   ├── ControlBar.tsx         # 控制栏（上/下/播放暂停）
│   │   ├── ProgressBar.tsx        # 进度条
│   │   └── SettingsModal.tsx      # 设置弹窗
│   ├── hooks/
│   │   ├── useWordList.ts         # 词库加载hook
│   │   ├── useTTS.ts              # 发音hook
│   │   ├── useProgress.ts         # 进度管理hook
│   │   └── useAutoPlay.ts         # 自动播放控制hook
│   ├── store/
│   │   └── useAppStore.ts         # Zustand全局状态
│   ├── utils/
│   │   ├── storage.ts             # localStorage封装
│   │   ├── db.ts                  # IndexedDB封装
│   │   └── dataLoader.ts          # 词库加载器
│   ├── types/
│   │   └── word.ts                # 类型定义
│   ├── App.tsx                    # 根组件
│   ├── main.tsx                   # 入口
│   └── index.css                  # Tailwind入口
├── android/                       # Capacitor生成的Android项目
│   └── app/
│       └── src/main/
│           └── java/...           # 自定义原生插件（Phase 2）
├── capacitor.config.ts            # Capacitor配置
├── vite.config.ts                 # Vite配置
├── tailwind.config.js             # Tailwind配置
├── package.json
└── tsconfig.json
```

---

## 3. 数据结构设计

### 3.1 单词数据格式

```typescript
// src/types/word.ts
interface Word {
  id: number;                    // 唯一ID，按词频排序
  word: string;                  // 单词
  phonetic: string;              // 音标（美式）
  pos: string;                   // 词性：n./v./adj./adv./prep./conj.
  definition: string;            // 中文释义
  example?: string;              // 例句（英文）
  exampleTranslation?: string;   // 例句翻译（中文）
  tag?: string;                  // 来源标签：cet4/cet6/ielts/toefl/gre
  audioUs?: string;              // 美式音频路径（可选）
  audioUk?: string;              // 英式音频路径（可选）
}

// 词库JSON文件格式
interface WordShard {
  shardIndex: number;            // 分片序号 1-20
  totalShards: number;           // 总分片数 20
  words: Word[];                 // 该分片的单词数组
}
```

### 3.2 进度存储格式

```typescript
// src/utils/storage.ts
interface ProgressData {
  currentRound: number;          // 当前轮次
  currentIndex: number;          // 当前单词索引（0-19999）
  completedRounds: number;       // 已完成轮次数
  lastUpdate: string;            // 最后更新时间 ISO格式
}

interface Settings {
  speed: number;                 // 朗读间隔（秒）：0.5/1/1.5/2/3
  accent: 'us' | 'uk';           // 发音类型
  autoPlay: boolean;             // 是否自动播放
}

// localStorage key
const STORAGE_KEYS = {
  PROGRESS: 'vocab_progress',
  SETTINGS: 'vocab_settings',
};
```

### 3.3 全局状态（Zustand）

```typescript
// src/store/useAppStore.ts
interface AppState {
  // 状态
  words: Word[];                 // 当前加载的词库分片
  currentWordIndex: number;      // 当前单词索引
  isPlaying: boolean;            // 是否正在播放
  isLoading: boolean;            // 是否正在加载词库

  // 进度
  currentRound: number;
  completedRounds: number;

  // 设置
  settings: Settings;

  // Actions
  loadWords: () => Promise<void>;
  nextWord: () => void;
  prevWord: () => void;
  togglePlay: () => void;
  updateSettings: (settings: Partial<Settings>) => void;
  resetProgress: () => void;
}
```

---

## 4. 核心功能实现

### 4.1 词库加载策略

```typescript
// src/utils/dataLoader.ts
const SHARD_SIZE = 1000;         // 每片1000词
const TOTAL_SHARDS = 20;         // 共20片
const PRELOAD_RANGE = 1;         // 预加载前后各1片

class DataLoader {
  private cache: Map<number, Word[]> = new Map();

  // 加载指定分片
  async loadShard(index: number): Promise<Word[]> {
    if (this.cache.has(index)) {
      return this.cache.get(index)!;
    }

    const response = await fetch(`/data/words-${String(index).padStart(3, '0')}.json`);
    const data: WordShard = await response.json();

    this.cache.set(index, data.words);
    return data.words;
  }

  // 根据全局索引获取单词（自动加载对应分片）
  async getWord(globalIndex: number): Promise<Word> {
    const shardIndex = Math.floor(globalIndex / SHARD_SIZE) + 1;
    const localIndex = globalIndex % SHARD_SIZE;

    const words = await this.loadShard(shardIndex);
    return words[localIndex];
  }

  // 预加载相邻分片
  async preloadAdjacent(currentIndex: number): Promise<void> {
    const currentShard = Math.floor(currentIndex / SHARD_SIZE) + 1;

    const toPreload = [
      currentShard - 1,
      currentShard,
      currentShard + 1
    ].filter(i => i >= 1 && i <= TOTAL_SHARDS);

    await Promise.all(toPreload.map(i => this.loadShard(i)));
  }
}
```

### 4.2 TTS 发音实现

```typescript
// src/hooks/useTTS.ts
import { TextToSpeech } from '@capacitor-community/text-to-speech';

interface TTSOptions {
  speed: number;
  accent: 'us' | 'uk';
}

export function useTTS() {
  const speak = async (word: string, options: TTSOptions) => {
    try {
      // 优先使用 Capacitor 原生 TTS
      await TextToSpeech.speak({
        text: word,
        lang: options.accent === 'us' ? 'en-US' : 'en-GB',
        rate: 1.0,
        pitch: 1.0,
      });
    } catch (error) {
      // 降级到 Web Speech API（Web端开发时使用）
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(word);
        utterance.lang = options.accent === 'us' ? 'en-US' : 'en-GB';
        utterance.rate = 1.0;
        window.speechSynthesis.speak(utterance);
      } else {
        console.error('TTS not available');
      }
    }
  };

  const stop = async () => {
    try {
      await TextToSpeech.stop();
    } catch {
      window.speechSynthesis?.cancel();
    }
  };

  return { speak, stop };
}
```

### 4.3 自动播放控制

```typescript
// src/hooks/useAutoPlay.ts
import { useEffect, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useTTS } from './useTTS';

export function useAutoPlay() {
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const {
    isPlaying,
    currentWordIndex,
    settings,
    nextWord,
    words
  } = useAppStore();

  const { speak } = useTTS();

  useEffect(() => {
    if (!isPlaying) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const currentWord = words[currentWordIndex];
    if (!currentWord) return;

    // 朗读当前单词
    speak(currentWord.word, {
      speed: settings.speed,
      accent: settings.accent
    });

    // 设置定时器切换到下一个
    timerRef.current = setTimeout(() => {
      nextWord();
    }, settings.speed * 1000);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [isPlaying, currentWordIndex, settings.speed, settings.accent]);

  return {
    start: () => useAppStore.setState({ isPlaying: true }),
    stop: () => useAppStore.setState({ isPlaying: false }),
    toggle: () => useAppStore.setState({ isPlaying: !isPlaying }),
  };
}
```

### 4.4 进度持久化

```typescript
// src/utils/storage.ts
import { ProgressData, Settings } from '../types';

const STORAGE_KEYS = {
  PROGRESS: 'vocab_progress',
  SETTINGS: 'vocab_settings',
};

export const storage = {
  // 获取进度
  getProgress(): ProgressData {
    const data = localStorage.getItem(STORAGE_KEYS.PROGRESS);
    if (data) {
      return JSON.parse(data);
    }
    return {
      currentRound: 1,
      currentIndex: 0,
      completedRounds: 0,
      lastUpdate: new Date().toISOString(),
    };
  },

  // 保存进度
  saveProgress(progress: ProgressData): void {
    localStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify({
      ...progress,
      lastUpdate: new Date().toISOString(),
    }));
  },

  // 获取设置
  getSettings(): Settings {
    const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (data) {
      return JSON.parse(data);
    }
    return {
      speed: 1,
      accent: 'us',
      autoPlay: true,
    };
  },

  // 保存设置
  saveSettings(settings: Settings): void {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  },

  // 重置进度
  resetProgress(): void {
    localStorage.removeItem(STORAGE_KEYS.PROGRESS);
  },
};
```

---

## 5. UI 组件设计

### 5.1 WordCard 组件

```tsx
// src/components/WordCard.tsx
import { Word } from '../types';

interface Props {
  word: Word;
}

export function WordCard({ word }: Props) {
  return (
    <div className="flex flex-col items-center justify-center p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-lg">
      {/* 单词 */}
      <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
        {word.word}
      </h1>

      {/* 音标 */}
      <p className="text-xl text-gray-600 dark:text-gray-300 mb-4">
        {word.phonetic}
      </p>

      {/* 释义 */}
      <p className="text-lg text-gray-800 dark:text-gray-200 mb-4">
        <span className="text-blue-600">{word.pos}</span> {word.definition}
      </p>

      {/* 例句 */}
      {word.example && (
        <div className="text-center">
          <p className="text-base text-gray-700 dark:text-gray-300 italic mb-1">
            "{word.example}"
          </p>
          {word.exampleTranslation && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {word.exampleTranslation}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
```

### 5.2 ControlBar 组件

```tsx
// src/components/ControlBar.tsx
interface Props {
  isPlaying: boolean;
  onPrev: () => void;
  onNext: () => void;
  onTogglePlay: () => void;
}

export function ControlBar({ isPlaying, onPrev, onNext, onTogglePlay }: Props) {
  return (
    <div className="flex items-center justify-center gap-8 py-4">
      {/* 上一个 */}
      <button
        onClick={onPrev}
        className="w-14 h-14 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-600 transition"
      >
        ◀️
      </button>

      {/* 播放/暂停 */}
      <button
        onClick={onTogglePlay}
        className="w-20 h-20 rounded-full bg-blue-500 flex items-center justify-center hover:bg-blue-600 transition text-white text-3xl"
      >
        {isPlaying ? '⏸️' : '▶️'}
      </button>

      {/* 下一个 */}
      <button
        onClick={onNext}
        className="w-14 h-14 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-600 transition"
      >
        ▶️
      </button>
    </div>
  );
}
```

### 5.3 进度条组件

```tsx
// src/components/ProgressBar.tsx
interface Props {
  current: number;
  total: number;
  round: number;
}

export function ProgressBar({ current, total, round }: Props) {
  const percentage = ((current + 1) / total) * 100;

  return (
    <div className="w-full">
      {/* 文字进度 */}
      <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
        <span>第{round}轮</span>
        <span>{current + 1} / {total}</span>
      </div>

      {/* 进度条 */}
      <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
```

---

## 6. 词库构建流程

### 6.1 数据来源

| 数据 | 来源 | 格式 | 许可证 |
|------|------|------|--------|
| 主词库 | [ECDICT](https://github.com/skywind3000/ECDICT) | CSV/SQLite | MIT |
| 例句 | [kajweb/dict](https://github.com/kajweb/dict) | JSON | 不明确（学习用途可接受） |
| 音频 | [ismartcoding/endict](https://github.com/ismartcoding/endict) | MP3 + JSON | MIT |

### 6.2 筛选SQL

```sql
-- 从ECDICT筛选约20000词
SELECT
  row_number() OVER (ORDER BY frq ASC) as id,
  word,
  phonetic,
  pos,
  translation as definition,
  tag
FROM ecdict
WHERE
  (tag IS NULL OR tag NOT LIKE '%zk%')    -- 排除中考词汇
  AND (collins IS NULL OR collins < 5)    -- 排除5星最简单词
  AND frq > 0 AND frq <= 20000            -- 取词频前20000
  AND translation IS NOT NULL
  AND translation != ''
ORDER BY frq ASC;
```

### 6.3 构建脚本（Node.js）

```javascript
// scripts/build-word-list.js
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const SHARD_SIZE = 1000;
const words = [];

// 1. 读取ECDICT CSV并筛选
fs.createReadStream('ecdict.csv')
  .pipe(csv())
  .on('data', (row) => {
    const tag = row.tag || '';
    const collins = parseInt(row.collins) || 0;
    const frq = parseInt(row.frq) || 999999;

    // 筛选条件
    if (
      !tag.includes('zk') &&
      collins < 5 &&
      frq > 0 && frq <= 20000 &&
      row.translation
    ) {
      words.push({
        id: words.length + 1,
        word: row.word,
        phonetic: row.phonetic || '',
        pos: row.pos || '',
        definition: row.translation,
        tag: tag,
      });
    }
  })
  .on('end', () => {
    console.log(`Filtered ${words.length} words`);

    // 2. 合并例句（从kajweb/dict）
    mergeExamples(words);

    // 3. 分片输出
    const totalShards = Math.ceil(words.length / SHARD_SIZE);
    for (let i = 0; i < totalShards; i++) {
      const shard = {
        shardIndex: i + 1,
        totalShards,
        words: words.slice(i * SHARD_SIZE, (i + 1) * SHARD_SIZE),
      };

      const filename = `words-${String(i + 1).padStart(3, '0')}.json`;
      fs.writeFileSync(
        path.join('public/data', filename),
        JSON.stringify(shard, null, 2)
      );
    }

    console.log(`Generated ${totalShards} shard files`);
  });

// 合并例句
async function mergeExamples(words) {
  const kajwebDir = './kajweb-dict';

  for (const word of words) {
    const jsonPath = path.join(kajwebDir, `${word.word}.json`);
    if (fs.existsSync(jsonPath)) {
      const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      const sentences = data.content?.word_content?.sentence?.sentences || [];

      if (sentences.length > 0) {
        word.example = sentences[0].sContent;
        word.exampleTranslation = sentences[0].sCn;
      }
    }
  }
}
```

---

## 7. Capacitor 打包配置

### 7.1 初始化 Capacitor

```bash
# 安装依赖
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor-community/text-to-speech

# 初始化
npx cap init "单词朗读" "com.vocab.app" --web-dir dist

# 添加Android平台
npx cap add android

# 同步
npm run build
npx cap sync
```

### 7.2 capacitor.config.ts

```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.vocab.app',
  appName: '单词朗读',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    TextToSpeech: {
      iosVoice: 'en-US',
      androidVoice: 'en-us',
    }
  }
};

export default config;
```

### 7.3 Android 配置（android/app/src/main/AndroidManifest.xml）

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <!-- 权限 -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/AppTheme">

        <activity
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode"
            android:name=".MainActivity"
            android:label="@string/app_name"
            android:theme="@style/AppTheme.NoActionBarLaunch"
            android:launchMode="singleTask"
            android:exported="true">

            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>

        </activity>

    </application>
</manifest>
```

### 7.4 构建命令

```bash
# Web开发
npm run dev

# 构建
npm run build

# 同步到Android
npx cap sync android

# 打开Android Studio
npx cap open android

# 在Android Studio中构建APK/AAB
# Build > Build Bundle(s) / APK(s) > Build APK(s)
```

---

## 8. 性能优化

### 8.1 词库加载优化

| 策略 | 说明 |
|------|------|
| JSON分片 | 20个文件，每片1000词，首屏只加载1片 |
| 预加载 | 切换时预加载前后各1片 |
| 压缩 | Vite自动gzip，3MB压缩到~800KB |
| 缓存 | 已加载分片缓存在内存中 |

### 8.2 渲染优化

| 策略 | 说明 |
|------|------|
| React.memo | WordCard组件记忆化，避免不必要的重渲染 |
| useMemo | 复杂计算缓存 |
| requestAnimationFrame | 动画使用rAF |

### 8.3 存储优化

| 数据 | 存储方式 | 大小 |
|------|----------|------|
| 进度数据 | localStorage | <1KB |
| 设置数据 | localStorage | <100B |
| 词库缓存 | 内存 | 3-6片 = 3000-6000词 |

---

## 9. 测试计划

### 9.1 单元测试

- [ ] 词库加载逻辑
- [ ] 进度存储/读取
- [ ] TTS调用

### 9.2 集成测试

- [ ] 自动播放流程
- [ ] 手动切换流程
- [ ] 进度持久化

### 9.3 真机测试

| 测试项 | Android 10+ | 预期结果 |
|--------|-------------|----------|
| 首次启动 | ✅ | 显示第1个单词 |
| 自动播放 | ✅ | 1秒切换+朗读 |
| 手动切换 | ✅ | 立即切换 |
| 进度保存 | ✅ | 关闭后恢复 |
| TTS发音 | ✅ | 美式/英式可选 |
| 后台切换 | ✅ | 暂停播放 |

---

## 10. 开发里程碑

### Phase 1 - MVP（1-2周）

| 任务 | 优先级 |
|------|--------|
| 项目初始化（Vite + React + Tailwind） | P0 |
| 词库数据准备（筛选+例句合并+分片） | P0 |
| WordCard 组件 | P0 |
| 自动播放逻辑 | P0 |
| 手动切换 | P0 |
| 进度持久化 | P0 |
| 设置页面 | P1 |
| Capacitor打包 | P1 |

### Phase 2 - 体验优化（1周）

| 任务 | 优先级 |
|------|--------|
| 深色模式 | P1 |
| PWA支持 | P2 |
| 音频文件集成 | P2 |
| 后台播放插件 | P2 |

### Phase 3 - 增强（可选）

| 任务 | 优先级 |
|------|--------|
| 单词收藏 | P3 |
| 按标签筛选 | P3 |
| 学习统计 | P3 |
