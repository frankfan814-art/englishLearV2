### Task 7: 集成测试与最终验证

**Files:**
- 无代码修改

**说明：**
端到端测试多语言学习流程，确保英语功能不受影响，新语言功能正常工作。

- [ ] **Step 1: 启动开发服务器**

```bash
npm run dev
```

- [ ] **Step 2: 测试英语功能回归**

1. 访问首页，确认默认显示英语Tab选中
2. 点击"快速开始" → 进入英语学习模式
3. 自动播放：单词发音（有道API）→ 中文释义发音 → 例句发音
4. 点击"已掌握" → 单词被标记，跳到下一个
5. 打开设置 → 切换美式/英式发音 → 朗读释义开关 → 朗读例句开关
6. 返回首页，确认进度显示

- [ ] **Step 3: 测试日语功能**

1. 点击"日语"Tab
2. 点击"快速开始" → 进入日语学习模式
3. 确认 WordCard 显示日语单词、假名读音、中文释义、日语例句
4. 自动播放：日语单词发音（Web Speech）→ 中文释义发音 → 日语例句发音
5. 打开设置 → 确认发音口音显示"标准发音"
6. 返回首页，确认进度已切换

- [ ] **Step 4: 测试韩语和德语**

1. 点击"韩语"Tab → 快速开始 → 确认韩语单词显示和发音
2. 返回 → 点击"德语"Tab → 快速开始 → 确认德语单词显示和发音

- [ ] **Step 5: 测试语言切换后进度独立**

1. 英语学习到第10个词 → 切换到日语 → 英语进度应保存
2. 日语学习到第5个词 → 切回英语 → 回到第10个词
3. 确认 mastered 单词跨语言不共享

- [ ] **Step 6: 检查 localStorage**

```javascript
// 在浏览器控制台
console.log(localStorage.getItem('vocab_current_language'));
console.log(localStorage.getItem('vocab_list_progress'));
console.log(localStorage.getItem('vocab_mastered'));
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: 多语言词库集成完成
- 支持英语/日语/韩语/德语四种语言切换
- 英语发音使用有道API，其他语言使用Web Speech API
- 各语言学习进度独立存储
- 修复朗读释义开关不生效的bug
Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
