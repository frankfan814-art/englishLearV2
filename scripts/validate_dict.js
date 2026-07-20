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
    wordRe: /^[\p{L}][\p{L} \-'.]*$/ui,
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
const m = reg.match(new RegExp(`${lang}:\\s*\\{[\\s\\S]*?totalShards:\\s*(\\d+)[\\s\\S]*?lastShardSize:\\s*(\\d+)`, 's'));
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
