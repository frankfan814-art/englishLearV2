### Task 5: 首页 UI 添加语言 Tab 切换

**Files:**
- Modify: `src/components/Home.tsx`
- Modify: `src/components/WordListSelect.tsx`
- Modify: `src/App.tsx`

**说明：**
首页添加语言 Tab 栏，切换时更新语言状态。词表选择列表根据当前语言过滤显示。

- [ ] **Step 1: 改造 Home.tsx 添加语言 Tab 栏**

```typescript
// src/components/Home.tsx
// 新增 LanguageTabBar 组件，在 Logo 和 快速开始按钮 之间插入

import { LANGUAGES, getListsByLanguage, getLanguageInfo } from '../config/wordLists';
import { getTotalWords } from '../utils/languageRegistry';

// 在 Home 组件内
const { currentLanguage, switchLanguage, completedRounds, currentRound, currentIndex, switchList, startLearning } = useAppStore();
const [showListSelect, setShowListSelect] = useState(false);

const totalWords = getTotalWords(currentLanguage);
const percentage = totalWords > 0 ? ((currentIndex + 1) / totalWords) * 100 : 0;

const handleQuickStart = async () => {
  // 快速开始：当前语言的全部单词
  const langInfo = getLanguageInfo(currentLanguage);
  if (langInfo) {
    await switchList(`${currentLanguage}_all`);
  } else {
    await switchList('all');
  }
  unlockAudio();
  startLearning();
};

// 在 Logo 下方添加 Language Tab 栏
```

```tsx
{/* Language Tabs */}
<div className="flex gap-1.5 mb-6 bg-background/50 rounded-xl p-1 border border-white/5 w-full">
  {LANGUAGES.map((lang) => (
    <button
      key={lang.code}
      onClick={() => {
        if (lang.code !== currentLanguage) {
          switchLanguage(lang.code);
        }
      }}
      className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
        currentLanguage === lang.code
          ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
      }`}
    >
      <span className="text-base">{lang.flag}</span>
      <span>{lang.name}</span>
    </button>
  ))}
</div>
```

- [ ] **Step 2: 改造 WordListSelect.tsx 按语言过滤**

```typescript
// src/components/WordListSelect.tsx
// 修改 loadListStats 函数

const loadListStats = async () => {
  setLoading(true);
  const { currentLanguage } = useAppStore.getState();
  const listsWithStats: WordListWithStats[] = [];

  const filteredLists = WORD_LISTS.filter(list => list.language === currentLanguage);

  for (const list of filteredLists) {
    const wordCount = list.tag === '*'
      ? getTotalWords(currentLanguage)
      : await getWordCountByTag(list.tag, currentLanguage);  // 传入 language 参数
    listsWithStats.push({
      ...list,
      wordCount,
      progress: listProgress[list.id],
    });
  }

  setLists(listsWithStats);
  setLoading(false);
};
```

- [ ] **Step 3: 验证**

```bash
npm run build
```
手动测试：
1. 首页显示语言Tab（英语/日语/韩语/德语）
2. 点击日语Tab → 切换到日语，进度重置
3. 点击"快速开始" → 进入日语学习模式
4. 返回首页 → 点击韩语Tab → 切换到韩语

- [ ] **Step 4: Commit**

```bash
git add src/components/Home.tsx src/components/WordListSelect.tsx
git commit -m "feat: 首页添加语言Tab切换
- 新增 LanguageTabBar 组件，支持英语/日语/韩语/德语切换
- WordListSelect 按当前语言过滤显示词表
- 快速开始使用当前语言的默认词表
Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

