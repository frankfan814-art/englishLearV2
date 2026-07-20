/**
 * 词库补全脚本：用本地 agy CLI（Gemini）生成高质量词典数据
 *
 * 用法：
 *   node scripts/gen_dict_agy.js <ko|de> [--limit 20000] [--out <输出目录>]
 *
 * 示例：
 *   node scripts/gen_dict_agy.js ko            # 补全韩语到 2 万词（断点续跑）
 *   node scripts/gen_dict_agy.js de --limit 30 --out /tmp/de_test   # 小批量测试
 *
 * 数据来源：scripts/raw/{lang}_50k.txt（hermitdave/FrequencyWords 词频表，按使用频率排序，
 * 保证生成的是"最实用的 N 词"）。AI 负责把变形词归一到词典原形并生成注音/词性/释义/例句，
 * 脚本负责按频率去重、按排名打等级标签（韩语 TOPIK 1-6 / 德语 A1-C1）、切分分片。
 * 中断后重跑自动从 progress_agy.json 续跑。
 */
import fs from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ================= 配置区 =================
const AGY_MODEL = 'Gemini 3.5 Flash (Low)';
const BATCH_SIZE = 50;          // 每次调用处理的单词数
const MAX_RETRIES = 5;          // 单批失败重试次数（超过则中止，可重跑续跑）
const CALL_TIMEOUT_MS = 280000; // 单次调用超时
const SHARD_SIZE = 5000;

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

const LANGS = {
  ko: {
    name: '韩语',
    phoneticHint: '罗马字注音（修订罗马字方案，如 gada）',
    normalizeHint: '若单词是活用/变形形式（如 가요、갔다、하는），word 一律返回词典原形（如 가다）',
    scriptRe: /[가-힯]/,
    // 按最终排名打 TOPIK 等级标签（标签不能含空格，wordListIndex 按空白切分多标签）
    tagOf: (i) => (i < 2000 ? 'topik_1' : i < 4000 ? 'topik_2' : i < 6000 ? 'topik_3' : i < 9000 ? 'topik_4' : i < 13000 ? 'topik_5' : 'topik_6'),
    dedupKey: (w) => w.normalize('NFC'),
  },
  de: {
    name: '德语',
    phoneticHint: '国际音标 IPA（如 ˈɡeːən）',
    normalizeHint: '若单词是变形形式（如 ging、Häuser、schönere），word 一律返回词典原形（如 gehen、Haus、schön）；名词首字母大写',
    scriptRe: /[a-zäöüß]/i,
    tagOf: (i) => (i < 1500 ? 'a1' : i < 3000 ? 'a2' : i < 5500 ? 'b1' : i < 9000 ? 'b2' : 'c1'),
    dedupKey: (w) => w.toLowerCase(),
  },
};
// ===========================================

const args = process.argv.slice(2);
const lang = args[0];
const cfg = LANGS[lang];
if (!cfg) {
  console.error('用法: node scripts/gen_dict_agy.js <ko|de> [--limit N] [--out 目录] [--input 词表] [--levels 等级映射.json] [--maxinput N]');
  process.exit(1);
}
const optValue = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : dflt;
};
const TARGET = parseInt(optValue('--limit', '20000'), 10);
const OUT_DIR = optValue('--out', path.join(__dirname, '..', 'public', 'data', lang));
const INPUT_PATH = optValue('--input', path.join(__dirname, 'raw', `${lang}_50k.txt`));
const LEVELS_PATH = optValue('--levels', ''); // 词→等级标签 JSON（考级词表），命中时优先于按排名打标
const MAXINPUT = parseInt(optValue('--maxinput', String(TARGET * 2)), 10);
const PROGRESS_PATH = path.join(OUT_DIR, 'progress_agy.json');

/**
 * 读取输入词表。兼容两种格式：
 * - hermitdave 词频表："word count" 每行一条（取首个 token）
 * - 预处理合并词表（prep_exam_lists.js 产出）：每行一个词
 */
async function readInputWords() {
  const content = await fs.readFile(INPUT_PATH, 'utf-8');
  const seen = new Set();
  const words = [];
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    const token = /^\S+\s+\d+$/.test(line) ? line.split(' ')[0] : line;
    if (!token || !cfg.scriptRe.test(token) || /^\d+$/.test(token)) continue;
    const w = token.normalize('NFC');
    if (seen.has(w)) continue;
    seen.add(w);
    words.push(w);
    if (words.length >= MAXINPUT) break;
  }
  return words;
}

function buildPrompt(batch) {
  return `你是专业的${cfg.name}词典API。请为以下${cfg.name}单词提供精准的词典数据。
严格要求：
1. 只返回纯 JSON 数组，不要任何 markdown 标记（如 \`\`\`json）或解释文字。
2. ${cfg.normalizeHint}。
3. 每个对象严格包含以下字段：
- "word": 词典原形（按第 2 条归一）。
- "phonetic": ${cfg.phoneticHint}。
- "pos": 词性缩写（如 v., n., adj., adv., pron., conj., prep., num. 等）。
- "definition": 简体中文释义，多个义项用 \\n 分隔。
- "example": 一个简短的${cfg.name}例句（使用该词原形）。
- "exampleTranslation": 例句的简体中文翻译。
4. 若某个输入不是有效的${cfg.name}单词，该条返回 {"word":"原词","skip":true}。

待处理单词：
${batch.join(', ')}`;
}

const BACKEND = BACKENDS[optValue('--backend', 'glm')];
if (!BACKEND) {
  console.error(`未知后端，可选: ${Object.keys(BACKENDS).join(', ')}`);
  process.exit(1);
}

/** 从 CLI 输出中提取 JSON 数组（容忍前后的日志/围栏文字） */
function extractJsonArray(text) {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start < 0 || end <= start) throw new Error('输出中未找到 JSON 数组');
  return JSON.parse(text.slice(start, end + 1));
}

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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const freqWords = await readInputWords();
  console.log(`📖 输入词表可用 ${freqWords.length} 词，目标 ${TARGET} 词`);

  // 考级等级映射（命中时优先于按排名打标）
  let levels = {};
  if (LEVELS_PATH) {
    levels = JSON.parse(await fs.readFile(LEVELS_PATH, 'utf-8'));
    console.log(`🏷️ 考级等级映射 ${Object.keys(levels).length} 词`);
  }

  // 断点续跑
  let results = [];
  try {
    results = JSON.parse(await fs.readFile(PROGRESS_PATH, 'utf-8'));
    console.log(`⏩ 续跑：已完成 ${results.length} 词`);
  } catch { /* 首次运行 */ }

  const collectedKeys = new Set(results.map((r) => r._key));
  // 找出尚未覆盖的词频表前缀：跳过已处理区间
  const processedInputs = new Set(results.map((r) => r._input));
  const pending = freqWords.filter((w) => !processedInputs.has(w));

  for (let i = 0; i < pending.length && results.filter((r) => !r.skip).length < TARGET; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);
    const doneCount = results.filter((r) => !r.skip).length;
    console.log(`⏳ [${doneCount}/${TARGET}] 处理批次: ${batch.slice(0, 5).join(', ')}…`);

    const prompt = buildPrompt(batch);
    let entries = null;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const out = await callBackend(prompt);
        entries = extractJsonArray(out);
        break;
      } catch (err) {
        const wait = [5000, 15000, 45000, 90000][Math.min(attempt - 1, 3)];
        console.error(`  ⚠️ 第 ${attempt}/${MAX_RETRIES} 次失败（${err.message.slice(0, 120)}），${wait / 1000}s 后重试`);
        if (attempt === MAX_RETRIES) {
          console.error(`❌ 批次多次失败，中止。失败批次: ${batch.join(', ')}`);
          console.error('   进度已保存，重新运行本脚本即可续跑。');
          process.exit(1);
        }
        await sleep(wait);
      }
    }

    // 以 input 集合校验返回结果，过滤幻觉词条；按输出原形去重
    const inputSet = new Set(batch.map((w) => w.toLowerCase()));
    for (const e of entries) {
      const word = String(e.word || '').trim();
      const isSkip = e.skip === true;
      if (!isSkip) {
        if (!word || !inputSet.has(word.toLowerCase())) continue; // 幻觉词条/空词条
        const key = cfg.dedupKey(word);
        if (collectedKeys.has(key)) continue; // 归一后与高频词重复（如 가요→가다）
        if (!e.definition || !e.phonetic) continue; // 缺关键字段
        collectedKeys.add(key);
        results.push({
          _input: batch.find((w) => w.toLowerCase() === word.toLowerCase()) || word,
          _key: key,
          skip: false,
          word,
          phonetic: String(e.phonetic || ''),
          pos: String(e.pos || ''),
          definition: String(e.definition || ''),
          example: e.example ? String(e.example) : null,
          exampleTranslation: e.exampleTranslation ? String(e.exampleTranslation) : null,
        });
      } else {
        // 记录 skip 以避免重跑时重复处理
        results.push({ _input: word, _key: `skip:${word}`, skip: true });
      }
    }

    await fs.writeFile(PROGRESS_PATH, JSON.stringify(results, null, 2), 'utf-8');
    // 限速：默认 1.5s；遇 429 限流可用 GEN_SLEEP_MS=5000 之类加大
    await sleep(parseInt(process.env.GEN_SLEEP_MS || '1500', 10));
  }

  const valid = results.filter((r) => !r.skip).slice(0, TARGET);
  console.log(`✅ 收集完成：${valid.length} 词（跳过无效/重复 ${results.length - valid.length} 条）`);

  // 打标签 + 编号 + 切分片（考级词优先用考级等级，其余按排名）
  const finalWords = valid.map((r, idx) => ({
    id: idx + 1,
    word: r.word,
    phonetic: r.phonetic,
    pos: r.pos,
    definition: r.definition,
    tag: levels[cfg.dedupKey(r.word)] || cfg.tagOf(idx),
    example: r.example,
    exampleTranslation: r.exampleTranslation,
  }));

  const totalShards = Math.ceil(finalWords.length / SHARD_SIZE);
  for (let s = 0; s < totalShards; s++) {
    const shardWords = finalWords.slice(s * SHARD_SIZE, (s + 1) * SHARD_SIZE);
    const pad = String(s + 1).padStart(3, '0');
    await fs.writeFile(
      path.join(OUT_DIR, `words-${pad}.json`),
      JSON.stringify({ shardIndex: s + 1, totalShards, words: shardWords }, null, 2),
      'utf-8'
    );
  }
  console.log(`🎉 已输出 ${totalShards} 个分片到 ${OUT_DIR}`);
  console.log(`   末片大小 ${finalWords.length - (totalShards - 1) * SHARD_SIZE}，记得更新 src/utils/languageRegistry.ts 的 ${lang} 配置`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
