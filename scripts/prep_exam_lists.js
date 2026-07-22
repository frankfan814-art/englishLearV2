/**
 * 考级词表预处理：把官方/社区考级词表与词频表合并，生成 gen_dict_agy.js 的输入
 *
 * 输出（写到 scripts/raw/）：
 *   ko_input.txt   韩语合并输入词表（词频表优先，TOPIK 官方词补尾）
 *   ko_levels.json 韩语 词→等级标签 映射（TOPIK A/B/C → topik_1/3/5）
 *   de_input.txt   德语合并输入词表（CEFR 词元优先，词频表补尾）
 *   de_levels.json 德语 词→等级标签 映射（A1..C2 → a1..c1，X 不打标）
 *
 * 词源：
 *   ko_topik.tsv  julienshim/combined_korean_vocabulary_list（NIKL 官方 + TOPIK 公开词表）
 *   de_cefr.json  ph98/german-cefr-wordlist（MIT，基于 hermitdave 词频由 LLM 标级）
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW = path.join(__dirname, 'raw');

const FREQ_CAP = 40000; // 词频表取前 4 万作为输入主体

// ===== 韩语 =====

// 与 gen_dict_agy.js 一致的词频表过滤
async function readFreq(lang, scriptRe) {
  const content = await fs.readFile(path.join(RAW, `${lang}_50k.txt`), 'utf-8');
  const seen = new Set();
  const words = [];
  for (const line of content.split('\n')) {
    const token = line.trim().split(' ')[0];
    if (!token || !scriptRe.test(token) || /^\d+$/.test(token)) continue;
    const w = token.normalize('NFC');
    if (seen.has(w)) continue;
    seen.add(w);
    words.push(w);
    if (words.length >= FREQ_CAP) break;
  }
  return { words, seen };
}

// TOPIK A/B/C → 应用内 6 级标签（A=1-2 初级、B=3-4 中级、C=5-6 高级，取各级下限）
const KO_LEVEL_MAP = { A: 'topik_1', B: 'topik_3', C: 'topik_5' };
// NIKL 等级兜底（无 TOPIK 等级时）
const KO_NIKL_MAP = { '초급': 'topik_1', '중급': 'topik_3', '고급': 'topik_5' };
const KO_LEVEL_ORDER = { topik_1: 0, topik_3: 1, topik_5: 2 };

async function prepKorean() {
  const { words: freqWords, seen: freqSeen } = await readFreq('ko', /[가-힯]/);

  const tsv = await fs.readFile(path.join(RAW, 'ko_topik.tsv'), 'utf-8');
  const lines = tsv.split('\n').slice(1); // 跳过表头

  const levels = {};
  const examWords = [];
  for (const line of lines) {
    const cols = line.split('\t');
    if (cols.length < 7) continue;
    // word 列带同形词序号（如 가격03），需剥掉
    const word = (cols[1] || '').trim().replace(/\d+$/, '').normalize('NFC');
    if (!word || !/[가-힯]/.test(word)) continue;
    const nikl = (cols[5] || '').trim();
    const topik = (cols[6] || '').trim();
    const tag = KO_LEVEL_MAP[topik] || KO_NIKL_MAP[nikl];
    if (!tag) continue;
    if (levels[word]) continue; // 同词多义条目只留第一次（等级更高/更早出现）
    levels[word] = tag;
    examWords.push(word);
  }

  // 考级词按等级排序后接在词频表尾部（去重）
  examWords.sort((a, b) => KO_LEVEL_ORDER[levels[a]] - KO_LEVEL_ORDER[levels[b]]);
  const extra = examWords.filter((w) => !freqSeen.has(w));
  const input = [...freqWords, ...extra];

  await fs.writeFile(path.join(RAW, 'ko_input.txt'), input.join('\n'), 'utf-8');
  await fs.writeFile(path.join(RAW, 'ko_levels.json'), JSON.stringify(levels), 'utf-8');
  console.log(`韩语：词频 ${freqWords.length} + 考级新增 ${extra.length} = 输入 ${input.length}，等级映射 ${Object.keys(levels).length} 词`);
}

// ===== 德语 =====

const DE_LEVEL_MAP = { A1: 'a1', A2: 'a2', B1: 'b1', B2: 'b2', C1: 'c1', C2: 'c1' }; // C2 并入 C1

async function prepGerman() {
  const cefr = JSON.parse(await fs.readFile(path.join(RAW, 'de_cefr.json'), 'utf-8'));
  cefr.sort((a, b) => a.rank - b.rank);

  const levels = {};
  const lemmas = [];
  const seen = new Set();
  for (const e of cefr) {
    const w = String(e.word || '').trim();
    if (!w || !/[a-zäöüß]/i.test(w)) continue;
    const key = w.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    lemmas.push(w);
    const tag = DE_LEVEL_MAP[e.level]; // X（未标级）不进映射，由脚本按排名打标
    if (tag) levels[key] = tag;
  }

  // 词频表补充（去掉已覆盖的）
  const { words: freqWords } = await readFreq('de', /[a-zäöüß]/i);
  const extra = freqWords.filter((w) => !seen.has(w.toLowerCase()));
  const input = [...lemmas, ...extra];

  await fs.writeFile(path.join(RAW, 'de_input.txt'), input.join('\n'), 'utf-8');
  await fs.writeFile(path.join(RAW, 'de_levels.json'), JSON.stringify(levels), 'utf-8');
  console.log(`德语：CEFR 词元 ${lemmas.length} + 词频新增 ${extra.length} = 输入 ${input.length}，等级映射 ${Object.keys(levels).length} 词`);
}

await prepKorean();
await prepGerman();
