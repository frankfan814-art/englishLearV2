### Task 6: 学习页 UI 适配多语言

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/WordCard.tsx`
- Modify: `src/components/ProgressBar.tsx`
- Modify: `src/components/SettingsModal.tsx`

**说明：**
学习页面的 Header Logo、WordCard 显示、Settings 发音口音选项根据当前语言适配。

- [ ] **Step 1: 改造 App.tsx 中的 Header**

```tsx
// 在 App.tsx 的 Header 部分
// Logo 字母根据语言变化

const languageLogo = {
  en: 'E', ja: '日', ko: '한', de: 'D',
}[currentLanguage] || 'E';

// 标题区域
<span className="text-base font-semibold text-foreground">
  单词朗读
</span>
<p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
  {currentLanguage === 'en' ? 'Vocab Master' : 
   currentLanguage === 'ja' ? '日本語マスター' :
   currentLanguage === 'ko' ? '단어 마스터' :
   currentLanguage === 'de' ? 'Wortmeister' : 'Vocab Master'}
</p>
```

- [ ] **Step 2: 改造 SettingsModal.tsx 发音口音部分**

```tsx
// 在 SettingsModal 中，根据当前语言显示 accent 选项
import { getLanguageInfo } from '../config/wordLists';

// 在组件内部
const { currentLanguage } = useAppStore();
const langInfo = getLanguageInfo(currentLanguage);
const accentOptions = langInfo?.ttsConfig.accentOptions || [];

// 发音口音区域
<div>
  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
    发音口音
  </label>
  {accentOptions.length > 1 ? (
    <div className="grid grid-cols-2 gap-3">
      {accentOptions.map(opt => (
        <Button
          key={opt.value}
          variant={settings.accent === opt.value ? 'default' : 'outline'}
          onClick={() => onUpdateSettings({ accent: opt.value })}
          className="justify-start gap-2"
        >
          <span className="font-medium">{opt.label}</span>
        </Button>
      ))}
    </div>
  ) : (
    <div className="bg-muted/50 rounded-xl p-4 text-center">
      <span className="text-sm text-muted-foreground">标准发音</span>
    </div>
  )}
</div>
```

- [ ] **Step 3: 改造 WordCard.tsx 适配多语言展示**

```tsx
// WordCard 中，tag 显示逻辑
// 如果 word.tag 为空，显示语言类型
const tagDisplay = word.tag 
  ? word.tag.split(' ')[0].toUpperCase() 
  : (language === 'ja' ? '日本語' : 
     language === 'ko' ? '한국어' : 
     language === 'de' ? 'DEUTSCH' : 'VOCAB');

// parseDefinition 只对英文释义有效（有 a./n./v. 前缀）
// 日语/韩语/德语释义直接显示，不解析 pos
```

- [ ] **Step 4: 验证**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/components/WordCard.tsx src/components/SettingsModal.tsx
git commit -m "feat: 学习页UI适配多语言
- Header Logo 和副标题随语言变化
- Settings 发音口音动态显示（英语显示美式/英式，其他显示标准）
- WordCard 标签显示随语言变化
Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

