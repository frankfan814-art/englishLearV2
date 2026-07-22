# 词库补全（不使用 Gemini）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不使用 Gemini（agy/gemini CLI）的前提下，把韩语词库从 6,359 词补全到 20,000 词、德语词库从 10 个示例词补全到 20,000 词，并完成校验、注册表更新与 App 验证。

**Architecture:** 复用现有 `scripts/gen_dict_agy.js` 生成管线（断点续跑、幻觉过滤、原形去重、考级打标、分片输出全部保留），仅把生成后端从 Gemini CLI 替换为国内可直连的 OpenAI 兼容 HTTP API（智谱 GLM-4-Flash 免费，DeepSeek 廉价兜底）。韩语已有的 6,359 条 Gemini 生成数据通过 `progress_agy.json` 断点文件无缝保留续用。

**Tech Stack:** Node.js（≥18，全局 fetch）ESM 脚本、OpenAI 兼容 chat/completions API、现有 hermitdave 词频表与考级词表预处理产物。

## Global Constraints

- **不使用 Gemini**：禁止调用 `agy` / `gemini` CLI 生成任何新词条；已有 Gemini 产出的 6,359 条韩语数据保留复用。
- API Key 只通过环境变量传入（`ZHIPU_API_KEY` / `DEEPSEEK_API_KEY`），**绝不写进代码、绝不提交仓库**。
- 输出词条结构严格匹配 `src/types/word.ts` 的 `Word`：`{id, word, phonetic, pos, definition, tag, example, exampleTranslation}`；分片格式 `{shardIndex, totalShards, words}`。
- `tag` 字段不允许含空格（`wordListIndex` 按空白切分多标签），且必须与 `src/config/wordLists.ts` 已注册词表对齐：韩语 `topik_1..topik_6`，德语 `a1..c1`。
- `progress_agy.json` 断点文件格式不得变更（字段 `_input/_key/skip/word/phonetic/pos/definition/example/exampleTranslation`），保证随时中断可续跑。
- 所有脚本从**仓库根目录**运行（`node scripts/xxx.js`）；脚本内注释用中文。
- 每完成一个 Task 就按步骤里的命令验证，验证不过不得进入下一个 Task。

---

## 执行代理须知（给 gemini-cli 等执行者）

- 忽略本文开头的 "REQUIRED SUB-SKILL: superpowers:subagent-driven-development / executing-plans" 提示——那是特定工具链的技能约定，与本仓库无关；你只需按 Task 1 → Task 5 顺序逐条执行步骤，Task 6/7 为可选项，默认不做。
- Global Constraints 里"不使用 Gemini"特指**数据生成后端**：禁止用 agy/gemini CLI 生成词条（配额原因），数据生成一律走 `--backend glm`（智谱 GLM-4-Flash）。你（gemini-cli）作为执行代理，编辑文件、运行命令不受此约束。
- `ZHIPU_API_KEY` 由用户在启动你之前导出到环境变量，你的 shell 直接继承使用；任何文件里都不得写入真实 key，也不要提交进 git。
- Task 2/3 的生成脚本单语言要跑 4-8 小时：用后台方式启动（如 `nohup ... > /tmp/gen_ko.log 2>&1 &`），定期查看 `public/data/{lang}/progress_agy.json` 的条目数确认进度，不要前台阻塞等待；脚本支持断点续跑，中断后重跑同一命令即可。

---

## 一、现状盘点（2026-07-20 实测数据）

| 语言 | 现状 | 缺口 |
|------|------|------|
| en 英语 | 16,194 词，17 分片，完整可用 | 5,413 词缺例句、811 词缺音标（历史遗留，见 Task 6 可选补齐） |
| ja 日语 | 19,929 词，4 分片，完整（例句/标签齐全） | 无 |
| ko 韩语 | **已生成 6,359 有效词**（`public/data/ko/progress_agy.json`，7,565 条记录含 1,206 条 skip），线上分片仍是 10 个示例词 | 差 13,641 词到 20,000；7 条有效词缺例句 |
| de 德语 | 只有 10 个示例词；预处理已就绪（`de_input.txt` 40,102 词、`de_levels.json` 11,382 条 A1-C1 映射） | 差 20,000 词 |
| fr/es | 各 10 个示例词，未注册进 `LANGUAGE_CONFIGS`，当前不可用 | 不在本期范围（见 Task 7 可选） |

已就位的资产（勿重复劳动）：

- `scripts/raw/ko_50k.txt` / `de_50k.txt`：hermitdave 词频表各 5 万行。
- `scripts/raw/ko_input.txt`（43,698 词）、`scripts/raw/ko_levels.json`（6,701 条 TOPIK 等级映射）、`scripts/raw/de_input.txt`（40,102 词）、`scripts/raw/de_levels.json`（11,382 条 CEFR 等级映射）：`scripts/prep_exam_lists.js` 的产物，直接作为生成管线输入。
- `scripts/gen_dict_agy.js`：成熟管线——读词表 → 分批 50 词 → LLM 生成 JSON → 输入集校验滤幻觉 → 原形去重 → 断点落盘 → 考级标签优先/排名兜底 → 切 5,000 词分片。
- `src/config/wordLists.ts` 已注册韩语 TOPIK 1-6、德语 A1-C1 词表（tag `topik_1..6` / `a1..c1`），数据到位即可用，**无需改前端代码**。

## 二、路线选型

| 路线 | 做法 | 成本 | 质量 | 工程量 | 结论 |
|------|------|------|------|--------|------|
| **A. 非 Gemini LLM API**（推荐） | `gen_dict_agy.js` 增加 OpenAI 兼容 HTTP 后端，GLM-4-Flash（免费）主跑、DeepSeek 兜底 | 0 ~ ¥15 | 与已有 6,359 条韩语数据同源同风格，一致性最好 | 极小（改 1 个文件） | **采用** |
| B. 纯开放数据拼装 | kaikki.org（Wiktionary 机读版）+ Tatoeba 例句库 + epitran/kroman 离线注音 | 0 | 字段覆盖率参差，需多级兜底；CC BY-SA/CC-BY 许可对商用 App 有署名义务 | 大（新写 3-4 个脚本） | 作为附录 A 备选，本期不用 |
| C. 付费商用词典 API | 有道/百度词典开放 API | 高，且词条级授权不允许离线打包 | — | — | 不采用（商用授权不允许打包进 APK） |

**API 选型（2026-07 核实）：**

1. **智谱 GLM-4-Flash（主力，免费）**：`https://open.bigmodel.cn/api/paas/v4/chat/completions`，OpenAI 兼容。GLM-4-Flash 系列官方定位为永久免费模型（[智谱官方文档](https://docs.bigmodel.cn/cn/guide/models/free/glm-4-flash-250414)），免费档限 1 并发——本管线串行调用，正好匹配。注册 open.bigmodel.cn 手机号即开。
2. **DeepSeek（兜底，极便宜）**：`https://api.deepseek.com/v1/chat/completions`，模型 `deepseek-chat`。估算本期货量：约 3.4 万词 ÷ 50/批 ≈ 680 批，输入 ≈0.8M token、输出 ≈3.1M token，按刊例价约 **¥10-15**（以官网为准）。`scripts/generate_dict.js` 已用同接口跑通过日语，可靠性有先例。
3. 备选：硅基流动 SiliconFlow（新用户送 2,000 万 token，同样 OpenAI 兼容，`https://api.siliconflow.cn/v1/chat/completions`）。如需启用，照 Task 1 的模式在 `BACKENDS` 加一条即可。

**生成量与时长估算**：韩语待生成约 13,700 有效词 ≈ 280 批，德语 20,000 词 ≈ 400-500 批（含 skip/去重损耗）。每批约 20-40s（API 延迟）+ 1.5s 限速，**单语言约 4-8 小时**，可挂机过夜；脚本支持断点续跑，随时可 Ctrl+C。

**输入池充足性**：韩语待处理池 43,698 − 7,565 ≈ 3.6 万词，按已有 84% 有效率足够补到 2 万；德语池 40,102 词，CEFR 词元排在前面（`prep_exam_lists.js` 已排好序），低频变形词被去重过滤后预计仍可达 2 万；若最终差几百词，按 Task 3 末尾的降级步骤处理。

---

## 三、文件结构

| 文件 | 责任 | 动作 |
|------|------|------|
| `scripts/gen_dict_agy.js` | 生成管线：新增 HTTP 后端（GLM/DeepSeek），其余逻辑不动 | 修改 |
| `scripts/validate_dict.js` | 词库校验：schema/去重/标签/分片/注册表一致性 | 新建 |
| `public/data/ko/words-00X.json` | 韩语正式分片（覆盖 10 词示例） | 生成 |
| `public/data/de/words-00X.json` | 德语正式分片（覆盖 10 词示例） | 生成 |
| `src/utils/languageRegistry.ts` | ko/de 分片参数更新（totalShards/lastShardSize） | 修改 |
| `AGENTS.md` | 数据规模表、脚本说明同步更新 | 修改 |

后端选择预期：本计划全程使用 `--backend glm`（免费）；GLM 配额/限流出问题再切 `--backend deepseek`。

---

### Task 1: gen_dict_agy.js 增加 OpenAI 兼容 HTTP 后端

**Files:**
- Modify: `scripts/gen_dict_agy.js`（三处：`BACKENDS` 定义、`--backend` 默认值、`callBackend` 函数、限速 sleep）

**Interfaces:**
- Consumes: 环境变量 `ZHIPU_API_KEY` / `DEEPSEEK_API_KEY`；既有 `buildPrompt(batch)`、`extractJsonArray(text)`。
- Produces: `node scripts/gen_dict_agy.js <ko|de> --backend glm|deepseek` 可用；`callBackend(prompt)` 对 CLI/HTTP 后端统一返回字符串（HTTP 后端返回 `choices[0].message.content`），下游 `extractJsonArray` 不变。

- [ ] **Step 1: 替换 `BACKENDS` 定义块**

把现有：

```js
const BACKENDS = {
  agy: { bin: 'agy', args: (p) => ['-p', p, '--model', AGY_MODEL, '--print-timeout', '300s'] },
  gemini: { bin: 'gemini', args: (p) => ['-p', p, '-m', 'gemini-2.5-flash'] },
};
```

替换为：

```js
// 后端：agy/gemini 为本地 CLI（已停用，仅保留记录）；glm/deepseek 为 OpenAI 兼容 HTTP API。
// HTTP 后端配置项：url / model / apiKeyEnv（Key 只走环境变量，绝不入库）。
const BACKENDS = {
  agy: { type: 'cli', bin: 'agy', args: (p) => ['-p', p, '--model', AGY_MODEL, '--print-timeout', '300s'] },
  gemini: { type: 'cli', bin: 'gemini', args: (p) => ['-p', p, '-m', 'gemini-2.5-flash'] },
  glm: {
    type: 'http',
    url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    model: 'glm-4-flash', // 若报模型不存在，改用全名 'glm-4-flash-250414'
    apiKeyEnv: 'ZHIPU_API_KEY',
  },
  deepseek: {
    type: 'http',
    url: 'https://api.deepseek.com/v1/chat/completions',
    model: 'deepseek-chat',
    apiKeyEnv: 'DEEPSEEK_API_KEY',
  },
};
```

- [ ] **Step 2: 把默认后端从 `agy` 改为 `glm`**

把：

```js
const BACKEND = BACKENDS[optValue('--backend', 'agy')];
```

改为：

```js
const BACKEND = BACKENDS[optValue('--backend', 'glm')];
```

- [ ] **Step 3: `callBackend` 支持 HTTP 类型**

把现有 `callBackend` 整个函数：

```js
async function callBackend(prompt) {
  const { stdout } = await execFileAsync(
    BACKEND.bin,
    BACKEND.args(prompt),
    { maxBuffer: 32 * 1024 * 1024, timeout: CALL_TIMEOUT_MS, windowsHide: true }
  );
  return stdout;
}
```

替换为：

```js
async function callBackend(prompt) {
  if (BACKEND.type === 'cli') {
    const { stdout } = await execFileAsync(
      BACKEND.bin,
      BACKEND.args(prompt),
      { maxBuffer: 32 * 1024 * 1024, timeout: CALL_TIMEOUT_MS, windowsHide: true }
    );
    return stdout;
  }
  // HTTP：OpenAI 兼容 chat/completions。不用 response_format（它要求顶层是 JSON 对象，
  // 而我们返回的是数组），继续走 extractJsonArray 容错提取。
  const apiKey = process.env[BACKEND.apiKeyEnv];
  if (!apiKey) throw new Error(`请先设置环境变量 ${BACKEND.apiKeyEnv}`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CALL_TIMEOUT_MS);
  try {
    const res = await fetch(BACKEND.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: BACKEND.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    return data.choices[0].message.content;
  } finally {
    clearTimeout(timer);
  }
}
```

- [ ] **Step 4: 限速间隔做成环境变量可调**

把 `main()` 里的：

```js
    await sleep(1500); // 温和限速
```

改为：

```js
    // 限速：默认 1.5s；遇 429 限流可用 GEN_SLEEP_MS=5000 之类加大
    await sleep(parseInt(process.env.GEN_SLEEP_MS || '1500', 10));
```

- [ ] **Step 5: 小批量试跑验证（德语 30 词，不动正式数据）**

先在 open.bigmodel.cn 注册拿到 API Key，然后（Git Bash）：

```bash
ZHIPU_API_KEY=<你的key> node scripts/gen_dict_agy.js de --backend glm --limit 30 \
  --input scripts/raw/de_input.txt --levels scripts/raw/de_levels.json --out /tmp/de_test
```

预期输出（逐行含义：读到输入池 → 处理批次 → 收集完成 → 出片）：

```
📖 输入词表可用 40102 词，目标 30 词
⏳ [0/30] 处理批次: ich, sie, das, und, der…
✅ 收集完成：30 词（跳过无效/重复 0 条）
🎉 已输出 1 个分片到 /tmp/de_test
```

再人工抽查 3 条质量：

```bash
node -e "const j=require('/tmp/de_test/words-001.json');console.log(JSON.stringify(j.words.slice(0,3),null,2))"
```

合格标准：`word` 是词典原形（如 `machen` 而非 `mache`）、`phonetic` 是 IPA、`definition` 是简体中文、`example` 含该词、`tag` 为 `a1` 且**无空格**。不合格则换 `--backend deepseek` 重跑对比，选质量好的后端。

- [ ] **Step 6: Commit**

```bash
git add scripts/gen_dict_agy.js
git commit -m "feat: gen_dict_agy 增加 GLM/DeepSeek HTTP 后端，替代 Gemini CLI"
```

---

### Task 2: 韩语续跑补全至 20,000 词

**Files:**
- Modify: `public/data/ko/words-001.json`（被覆盖）、Create: `public/data/ko/words-002..004.json`（生成）
- Input: `scripts/raw/ko_input.txt`、`scripts/raw/ko_levels.json`、既有断点 `public/data/ko/progress_agy.json`

**Interfaces:**
- Consumes: Task 1 的 `--backend glm`；`prep_exam_lists.js` 产出的 `ko_input.txt`（43,698 词，词频序+TOPIK 补尾）与 `ko_levels.json`（6,701 条词→等级映射）。
- Produces: `public/data/ko/progress_agy.json` 达到 ≥20,000 有效词；`words-001..004.json` 各 5,000 词，tag ∈ `topik_1..topik_6`。

- [ ] **Step 1: 备份现有断点（6,359 条有效词是真金白银，先备份）**

```bash
cp public/data/ko/progress_agy.json scripts/raw/ko_progress_agy.bak.json
node -e "const p=require('./public/data/ko/progress_agy.json');console.log('备份前核对：总记录',p.length,'有效',p.filter(r=>!r.skip).length)"
```

预期：`总记录 7565 有效 6359`。

- [ ] **Step 2: 确认断点与输入词表对得上（防用错输入文件导致重跑）**

```bash
node -e "
const fs=require('fs');
const p=JSON.parse(fs.readFileSync('public/data/ko/progress_agy.json','utf8'));
const input=fs.readFileSync('scripts/raw/ko_input.txt','utf8').split('\n').map(s=>s.trim()).filter(Boolean);
const set=new Set(input);
const covered=p.filter(r=>set.has(r._input)).length;
console.log('断点记录中被 ko_input.txt 覆盖:', covered, '/', p.length);"
```

预期：覆盖数 ≥7,500（绝大部分覆盖即可正常续跑；若覆盖接近 0，说明此前用的是 `ko_50k.txt`，则下一步改用 `--input scripts/raw/ko_50k.txt`）。

- [ ] **Step 3: 启动续跑（挂机过夜，随时可 Ctrl+C，重跑即续）**

```bash
ZHIPU_API_KEY=<你的key> node scripts/gen_dict_agy.js ko --backend glm --limit 20000 \
  --input scripts/raw/ko_input.txt --levels scripts/raw/ko_levels.json
```

启动后第一屏预期：

```
📖 输入词表可用 43698 词，目标 20000 词
🏷️ 考级等级映射 6701 词
⏩ 续跑：已完成 7565 词
⏳ [6359/20000] 处理批次: …
```

若反复出现 `HTTP 429`：Ctrl+C，用 `GEN_SLEEP_MS=5000` 重跑；若 GLM 持续不可用，改 `--backend deepseek`（需 `DEEPSEEK_API_KEY`）。

- [ ] **Step 4: 跑完核对产物**

脚本结束会打印 `✅ 收集完成：20000 词` 与 `🎉 已输出 4 个分片`，并提示更新注册表。核对：

```bash
node -e "
const fs=require('fs');
let total=0;
for(let i=1;i<=4;i++){
  const j=JSON.parse(fs.readFileSync('public/data/ko/words-'+String(i).padStart(3,'0')+'.json','utf8'));
  console.log('shard',i,'words=',j.words.length,'totalShards=',j.totalShards);
  total+=j.words.length;
}
console.log('总词数=',total);"
```

预期：4 片各 5,000，总词数 20,000。标签抽查（应只见 `topik_1..topik_6`）：

```bash
node -e "
const fs=require('fs');const dist={};
for(let i=1;i<=4;i++){const j=JSON.parse(fs.readFileSync('public/data/ko/words-'+String(i).padStart(3,'0')+'.json','utf8'));for(const w of j.words){dist[w.tag]=(dist[w.tag]||0)+1;}}
console.log(dist);"
```

- [ ] **Step 5: Commit（数据文件较大，单独一个提交）**

```bash
git add public/data/ko/words-00*.json
git commit -m "data: 韩语词库补全至 20000 词（GLM 生成，含 TOPIK 1-6 标签）"
```

---

### Task 3: 德语全量生成 20,000 词

**Files:**
- Modify: `public/data/de/words-001.json`（被覆盖）、Create: `public/data/de/words-002..004.json`（生成）
- Input: `scripts/raw/de_input.txt`（40,102 词，CEFR 词元优先）、`scripts/raw/de_levels.json`（11,382 条 A1-C1 映射）

**Interfaces:**
- Consumes: Task 1 的后端；德语 `tagOf` 按排名兜底（a1<1500, a2<3000, b1<5500, b2<9000, 其余 c1）。
- Produces: `public/data/de/progress_agy.json` ≥20,000 有效词；`words-001..004.json` 各 5,000 词，tag ∈ `a1..c1`。

- [ ] **Step 1: 启动生成**

```bash
ZHIPU_API_KEY=<你的key> node scripts/gen_dict_agy.js de --backend glm --limit 20000 \
  --input scripts/raw/de_input.txt --levels scripts/raw/de_levels.json
```

第一屏预期：`📖 输入词表可用 40102 词，目标 20000 词` + `🏷️ 考级等级映射 11382 词`（无 `⏩ 续跑` 行，因为是首次运行）。

德语特有注意事项（已在 prompt 的 `normalizeHint` 里，无需改代码，抽查时关注）：名词首字母大写；变形词（如 `ging`、`Häuser`）归一为原形（`gehen`、`Haus`）；去重键为小写。

- [ ] **Step 2: 跑完核对产物（同 Task 2 Step 4，路径换 de）**

```bash
node -e "
const fs=require('fs');
let total=0;
for(let i=1;i<=4;i++){
  const j=JSON.parse(fs.readFileSync('public/data/de/words-'+String(i).padStart(3,'0')+'.json','utf8'));
  total+=j.words.length;
}
console.log('总词数=',total);"
```

预期 20,000。

**降级预案**：若输入池跑完仍不足 20,000（脚本会打印实际收集数，如 19,2xx），两种选择：①接受实际数量，后续 Task 5 按实际数量更新注册表（`lastShardSize` 用末片实际词数）；②把 `--maxinput` 从默认 40,000 提到 50,000 再续跑（`de_50k.txt` 有 5 万行）。差几百词对体验无感，优先选①。

- [ ] **Step 3: Commit**

```bash
git add public/data/de/words-00*.json
git commit -m "data: 德语词库补全至 20000 词（GLM 生成，含 A1-C1 标签）"
```

---

### Task 4: 数据校验脚本 validate_dict.js

**Files:**
- Create: `scripts/validate_dict.js`

**Interfaces:**
- Consumes: `public/data/{lang}/words-*.json`、`src/utils/languageRegistry.ts`（只做文本正则读取，不 import）。
- Produces: 命令 `node scripts/validate_dict.js <ko|de> [期望总词数]`，全部通过时 exit 0 并打印 `✅ 全部校验通过`；任何错误 exit 1 并逐条列出。

- [ ] **Step 1: 写校验脚本（完整代码如下）**

```js
/**
 * 词库分片校验：schema、id 连续、原形去重、标签合法、分片完整、与 languageRegistry 一致
 * 用法：node scripts/validate_dict.js <ko|de> [期望总词数，默认 20000]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const lang = process.argv[2];
const expected = parseInt(process.argv[3] || '20000', 10);

const LANG_RULES = {
  ko: {
    dir: 'public/data/ko',
    wordRe: /[가-힯]/,
    tags: ['topik_1', 'topik_2', 'topik_3', 'topik_4', 'topik_5', 'topik_6'],
    dedupKey: (w) => w.normalize('NFC'),
  },
  de: {
    dir: 'public/data/de',
    wordRe: /^[a-zäöüß][a-zäöüß \-']*$/i,
    tags: ['a1', 'a2', 'b1', 'b2', 'c1'],
    dedupKey: (w) => w.toLowerCase(),
  },
};

const rule = LANG_RULES[lang];
if (!rule) {
  console.error(`用法: node scripts/validate_dict.js <${Object.keys(LANG_RULES).join('|')}> [期望总词数]`);
  process.exit(1);
}

const errors = [];
const warnings = [];
const dir = path.join(ROOT, rule.dir);
const files = fs.readdirSync(dir).filter((f) => /^words-\d{3}\.json$/.test(f)).sort();
if (files.length === 0) errors.push(`${rule.dir} 下没有 words-XXX.json 分片`);

const seen = new Set();
const tagDist = {};
let total = 0;
let noExample = 0;
let expectedShards = 0;

files.forEach((file, fi) => {
  const j = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  if (j.shardIndex !== fi + 1) errors.push(`${file}: shardIndex=${j.shardIndex} 应为 ${fi + 1}`);
  if (fi === 0) expectedShards = j.totalShards;
  if (j.totalShards !== expectedShards) errors.push(`${file}: totalShards 不一致`);
  for (const w of j.words) {
    total++;
    if (w.id !== total) errors.push(`${file}: id 不连续，期望 ${total} 实际 ${w.id}`);
    if (!w.word || !rule.wordRe.test(w.word)) errors.push(`${file}: 非法词条 "${w.word}"`);
    const key = rule.dedupKey(w.word);
    if (seen.has(key)) errors.push(`${file}: 重复词 "${w.word}"`);
    seen.add(key);
    if (!w.phonetic) errors.push(`${file}: "${w.word}" 缺 phonetic`);
    if (!w.definition) errors.push(`${file}: "${w.word}" 缺 definition`);
    if (!rule.tags.includes(w.tag)) errors.push(`${file}: "${w.word}" 非法标签 "${w.tag}"`);
    tagDist[w.tag] = (tagDist[w.tag] || 0) + 1;
    if (!w.example) noExample++;
    if ((w.example && !w.exampleTranslation) || (!w.example && w.exampleTranslation)) {
      warnings.push(`${file}: "${w.word}" 例句与译文不成对`);
    }
  }
});

if (expected && total !== expected) errors.push(`总词数 ${total} ≠ 期望 ${expected}`);
if (files.length && files.length !== expectedShards) errors.push(`分片数 ${files.length} ≠ totalShards ${expectedShards}`);

// 与 languageRegistry 一致性（文本正则，不引入 TS 依赖）
const reg = fs.readFileSync(path.join(ROOT, 'src/utils/languageRegistry.ts'), 'utf8');
const m = reg.match(new RegExp(`${lang}:\\s*\\{[^}]*totalShards:\\s*(\\d+)[^}]*lastShardSize:\\s*(\\d+)`, 's'));
if (!m) {
  errors.push(`languageRegistry.ts 中找不到 ${lang} 配置`);
} else {
  const [, ts, lss] = m;
  const regTotal = 5000 * (Number(ts) - 1) + Number(lss);
  if (regTotal !== total) errors.push(`注册表总词数 ${regTotal} ≠ 实际 ${total}，请更新 languageRegistry.ts`);
}

console.log(`[${lang}] 分片 ${files.length} 个，总词数 ${total}`);
console.log(`[${lang}] 标签分布:`, JSON.stringify(tagDist));
console.log(`[${lang}] 缺例句 ${noExample} 词（容忍，WordCard 有条件渲染）`);
if (warnings.length) console.warn(`⚠️ 警告 ${warnings.length} 条:\n` + warnings.slice(0, 10).join('\n'));
if (errors.length) {
  console.error(`❌ 错误 ${errors.length} 条:\n` + errors.slice(0, 30).join('\n'));
  process.exit(1);
}
console.log('✅ 全部校验通过');
```

- [ ] **Step 2: 跑两语言校验**

```bash
node scripts/validate_dict.js ko 20000
node scripts/validate_dict.js de 20000
```

预期（de 示例）：

```
[de] 分片 4 个，总词数 20000
[de] 标签分布: {"a1":...,"a2":...,"b1":...,"b2":...,"c1":...}
[de] 缺例句 0 词（容忍，WordCard 有条件渲染）
✅ 全部校验通过
```

此时注册表尚未更新，`languageRegistry` 一致性检查会报错——**这是预期的**，Task 5 更新注册表后重跑必须全绿。

- [ ] **Step 3: 人工抽检 10 词（脚本替代不了的语感检查）**

```bash
node -e "
const j=require('./public/data/de/words-002.json');
for(const w of j.words.filter((_,i)=>i%500===0)) console.log(w.word,'|',w.phonetic,'|',w.pos,'|',w.definition.split('\n')[0],'|',w.tag,'|',w.example);"
```

肉眼确认：释义通顺、例句含原词、标签合理（高频词应在 a1/a2）。若发现系统性问题（如大量词条变形未归一、释义是英文），不要带病进入 Task 5——删除对应分片与 `progress_agy.json` 中的问题段，换后端重跑。

- [ ] **Step 4: Commit**

```bash
git add scripts/validate_dict.js
git commit -m "feat: 新增词库分片校验脚本 validate_dict.js"
```

---

### Task 5: App 收尾（注册表 + 清理 + 构建验证 + 文档）

**Files:**
- Modify: `src/utils/languageRegistry.ts:19-33`
- Modify: `AGENTS.md`（数据规模表、脚本说明）
- Delete: `public/data/ja/progress_ai.json`、`public/data/ko/progress_agy.json`、`public/data/de/progress_agy.json`（生成完毕后移出发布目录，见 Step 2）

**Interfaces:**
- Consumes: Task 2/3 的实际分片数与末片词数。
- Produces: `npm run build` 通过；dev server 上韩语/德语词表可见可选可刷词。

- [ ] **Step 1: 更新 `src/utils/languageRegistry.ts` 的 ko/de 配置**

把 ko/de 两段（含上面那行 `// 注意：ko/de 当前为示例词库（各 10 词）…` 注释，一并删掉）改为（若实际词数与 20,000 有出入，按实际末片词数填 `lastShardSize`）：

```ts
  ko: {
    basePath: '/data/ko/',
    shardSize: 5000,
    totalShards: 4,
    filePattern: 'words-{index}.json',
    lastShardSize: 5000,
  },
  de: {
    basePath: '/data/de/',
    shardSize: 5000,
    totalShards: 4,
    filePattern: 'words-{index}.json',
    lastShardSize: 5000,
  },
```

- [ ] **Step 2: 把断点文件移出发布目录并防止再进 dist**

断点文件体积大（ja 5.6MB + ko 1.9MB），会被 `vite build` 原样拷进 dist/APK，纯属浪费包体。生成已全部完成，移走：

```bash
mkdir -p scripts/raw/progress_archive
git mv public/data/ja/progress_ai.json scripts/raw/progress_archive/ja_progress_ai.json 2>/dev/null || mv public/data/ja/progress_ai.json scripts/raw/progress_archive/ja_progress_ai.json
mv public/data/ko/progress_agy.json scripts/raw/progress_archive/ko_progress_agy.json
mv public/data/de/progress_agy.json scripts/raw/progress_archive/de_progress_agy.json
```

在 `.gitignore` 末尾追加一行（未来再跑生成脚本时断点不会再被提交/打包）：

```
public/data/**/progress_*.json
```

注意：移走后若想再续跑，需把对应文件拷回 `public/data/{lang}/progress_agy.json`——在 `AGENTS.md` 的脚本说明里记一笔。

- [ ] **Step 3: 重跑校验（注册表一致性检查现在必须通过）**

```bash
node scripts/validate_dict.js ko 20000
node scripts/validate_dict.js de 20000
```

预期：两个 `✅ 全部校验通过`。

- [ ] **Step 4: 构建 + 起 dev server 人工验证**

```bash
npm run build
npm run dev
```

浏览器打开 `http://localhost:3000`，逐项核对：
1. 首页语言 Tab 切到「韩语」→ 词表出现「TOPIK 1 初级 … TOPIK 6 高级」且每个词表显示词数 >0；
2. 选「TOPIK 1 初级」开始学习 → 单词、音标、释义、例句正常显示，发音正常（Web Speech ko-KR）；
3. 切到「德语」→ 词表出现「A1 入门 … C1 高级」，同样刷几个词；
4. 试用模式（未激活）下词表被截断为前 200 词——属预期行为（`applyTrialLimit`），不是 bug。

- [ ] **Step 5: 更新 AGENTS.md**

- 数据加载小节的表格：`ko / de` 行改为「`/data/{lang}/words-XXX.json` | 4 × 5000 | 各 20,000」；
- 脚本说明里 `gen_dict_agy.js` 一行补充：默认后端为 GLM（`--backend glm|deepseek`），断点文件归档在 `scripts/raw/progress_archive/`，续跑需拷回 `public/data/{lang}/`；
- 预定义词表一行：韩语改为「全部 + TOPIK 1-6」、德语改为「全部 + A1-C1」（wordLists.ts 早已注册，此前只是数据没到位）。

- [ ] **Step 6: Commit**

```bash
git add src/utils/languageRegistry.ts AGENTS.md .gitignore
git commit -m "chore: ko/de 注册表更新至 20000 词，断点文件移出发布目录"
```

---

### Task 6（可选）: 英语缺例句/音标补齐

**背景**：en 词库 5,413 词缺例句、811 词缺音标（`WordCard` 对缺例句有条件渲染，不影响运行，属体验优化）。

**做法**：新建 `scripts/backfill_en_examples.js`，扫描 17 个分片中 `example == null` 的词，每批 30 词调 GLM/DeepSeek（复用 Task 1 的 HTTP 调用模式），只返回 `{word, example, exampleTranslation}`，按 `word` 匹配写回分片（**保持 id 与顺序不变**）；811 个缺音标词同理补 `phonetic`。完成后 `npm run build` + 抽片核对。

**验收**：17 个分片总词数 16,194 不变、id 连续、缺例句数降为 0（或接近 0）。

### Task 7（可选）: fr/es 词库补全与注册

前置条件（已验证可下载，HTTP 206）：

- `https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2016/fr/fr_50k.txt`
- `https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2016/es/es_50k.txt`

步骤：① 下载到 `scripts/raw/`；② `gen_dict_agy.js` 的 `LANGS` 加 fr/es 配置（`scriptRe` 需含法语 `àâäæçéèêëîïôöùûüÿœ` / 西语 `áéíóúüñ¿¡` 字符；`tagOf` 照搬德语 a1..c1 档位）；③ 各生成 5,000-20,000 词；④ 按 AGENTS.md「新增语言三步」注册：`languageRegistry.ts` + `wordLists.ts` 的 `LANGUAGES`（含 TTS 配置：`webspeechLang` fr-FR / es-ES）与 `WORD_LISTS`、品牌标识；⑤ 跑 Task 4 的校验（`LANG_RULES` 加 fr/es）。

---

## 附录 A：路线 B（纯开放数据）备选方案详录

若将来连 GLM/DeepSeek 都不想用，可用以下全免费数据源拼装。**注意许可**：Wiktionary 数据 CC BY-SA 3.0、Tatoeba 句库 CC-BY 2.0——商用 App 使用需署名且 SA 有传染性风险，这是本期不采用它的主因。以下 URL 均于 2026-07-20 实测可达。

1. **词典数据（kaikki.org，Wiktionary 机读版，JSONL）**
   - 韩语：`https://kaikki.org/dictionary/Korean/kaikki.org-dictionary-Korean.jsonl`
   - 德语：`https://kaikki.org/dictionary/German/kaikki.org-dictionary-German.jsonl`
   - 每行一个 JSON：`{word, pos, sounds:[{ipa}], senses:[{glosses(英文)}], forms:[...], translations:[{lang_code, word}]}`（字段以实际为准）。用途：pos、IPA、`translations` 里 `lang_code:"zh"` 的中文释义、forms→原形映射。
2. **例句（Tatoeba）**
   - 句子：`https://downloads.tatoeba.org/exports/per_language/{kor|deu|cmn}/{kor|deu|cmn}_sentences_detailed.tsv.bz2`（TSV：id、lang、text、用户名…）
   - 句对映射：`https://downloads.tatoeba.org/exports/links.csv`（句 id 对）
   - 做法：kor 句 ↔ cmn 句直连；缺直连时经 eng 句 pivot。按词表每个词匹配一条最短例句。
3. **离线注音**：Python `epitran`（`pip install epitran`，支持 `kor-Hang`/`deu-Latn`/`fra-Latn`/`spa-Latn`）；韩语罗马字也可用 npm `kroman`。
4. **德中词典**：HanDeDict（handedict.zydeo.net，CC-CEDICT 格式文本，下载页地址以其官网为准）。

## 附录 B：风险与 FAQ

- **GLM 限流（429）**：免费档 1 并发+低 RPM。脚本已串行+重试（5/15/45/90s 退避），仍撞限流就 `GEN_SLEEP_MS=5000` 重跑。
- **LLM 幻觉词条**：管线已有防护——返回词必须属于输入批次（`inputSet` 校验），缺 `definition/phonetic` 直接丢弃。抽检仍发现脏数据时，从 `progress_agy.json` 删掉问题段重跑即可。
- **断点损坏**：`progress_agy.json` 是逐批落盘的，Ctrl+C 安全；万一文件写坏（JSON 截断），从 `scripts/raw/` 的备份恢复。
- **标签对不上词表**：`wordLists.ts` 用的是 `topik_1..6` / `a1..c1` 小写下划线，生成侧 `tagOf`/`ko_levels`/`de_levels` 已对齐；示例分片里的旧标签 `TOPIK 1`（带空格）会被正式分片整体覆盖，无需单独处理。
- **APK 体积**：20,000 词 × 2 语言 ≈ 新增 10-12MB JSON；务必执行 Task 5 Step 2 把断点文件移出 `public/data/`，否则白多 7.5MB。
- **不要把 `ZHIPU_API_KEY`/`DEEPSEEK_API_KEY` 写进任何文件**；也不要提交到 git（本计划所有命令均为运行时环境变量传参）。

---

## Self-Review 记录

- Spec 覆盖：ko 6,359→20,000（Task 2）、de 0→20,000（Task 3）、非 Gemini 约束（Task 1 + Global Constraints）、校验（Task 4）、App 收尾（Task 5）均有对应任务；fr/es 与 en 补缺明确标记为可选项，不混入主线。
- 占位符扫描：无 TBD/TODO；所有脚本步骤均附完整代码或确切命令与预期输出。
- 类型一致性：词条字段与 `src/types/word.ts` 一致；标签集合与 `src/config/wordLists.ts`（`topik_1..6` / `a1..c1`）、`validate_dict.js` 的 `LANG_RULES` 三处一致；注册表字段名与 `src/utils/languageRegistry.ts` 一致。
