# Task 1 Brief: 修复长单词溢出和字母底部裁剪

## Files
- Modify: `src/components/WordCard.tsx:134`
- Modify: `src/index.css` (新增样式)

## Interfaces
- Consumes: 无
- Produces: `.word-title` CSS 类

## Requirements

### Step 1: 修改 WordCard.tsx 单词标题样式

修改 `src/components/WordCard.tsx` 第 134 行：

```tsx
// 修改前：
<h1 className="text-5xl sm:text-6xl font-bold text-gradient text-center mb-6 tracking-tight">
  {word.word}
</h1>

// 修改后：
<h1 className="word-title text-gradient text-center mb-6 tracking-tight">
  {word.word}
</h1>
```

### Step 2: 在 index.css 新增 .word-title 样式

在 `src/index.css` 文件末尾添加：

```css
/* Word title responsive sizing */
.word-title {
  font-size: clamp(1.75rem, 8vw, 3.75rem);
  font-weight: 700;
  word-break: break-word;
  line-height: 1.4;
  padding-bottom: 4px;
  max-width: 100%;
}
```

### Step 3: 手动测试

运行 `npm run dev`，在浏览器中测试：
1. 打开应用进入学习页面
2. 检查普通单词显示是否正常
3. 检查长单词（如 "electroencephalogram"）是否自动换行或缩小
4. 检查字母 g、y、p 下缘是否完整显示

### Step 4: 提交

```bash
git add src/components/WordCard.tsx src/index.css
git commit -m "fix(ui): resolve long word overflow and letter clipping issues

- Use responsive font sizing with clamp() for word title
- Add word-break for long words to wrap
- Increase line-height and padding for descenders

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

## Report Contract

After completing the task, write a report to `E:/work/englishLearn/.superpowers/sdd/task-1-report.md` with:
1. Changes made
2. Test results (manual testing observations)
3. Any concerns or issues encountered
4. Commit hash

Then report status: DONE, DONE_WITH_CONCERNS, NEEDS_CONTEXT, or BLOCKED
