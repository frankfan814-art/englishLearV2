import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { translate } from 'bing-translate-api';
// Bing translate doesn't support generic proxy agent easily without patching, but let's try it if it fails we remove it.
// Actually bing-translate-api supports passing proxy in options if needed, but wait it uses fetch too.
// We'll omit proxy initially for bing as it might not be blocked.
import { HttpsProxyAgent } from 'https-proxy-agent';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || 'http://127.0.0.1:2080';
const agent = new HttpsProxyAgent(proxyUrl);

const LANGUAGES = {
  ja: { name: 'Japanese', url: 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2016/ja/ja_50k.txt' }
};

const WORDS_COUNT = 20000;
const SHARD_SIZE = 5000;
const RAW_DIR = path.join(__dirname, 'raw');

const delay = ms => new Promise(res => setTimeout(res, ms));

async function downloadFrequencyList(lang) {
  const fileInfo = LANGUAGES[lang];
  await fs.mkdir(RAW_DIR, { recursive: true });
  const rawPath = path.join(RAW_DIR, `${lang}_50k.txt`);
  
  try {
    await fs.access(rawPath);
    return rawPath;
  } catch {
    console.log(`[${lang}] Downloading frequency list...`);
    const res = await fetch(fileInfo.url, { agent });
    if (!res.ok) throw new Error(`Failed to download ${lang}`);
    const text = await res.text();
    await fs.writeFile(rawPath, text, 'utf-8');
    return rawPath;
  }
}

async function processLanguage(langCode) {
  const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'data', langCode);
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const rawPath = await downloadFrequencyList(langCode);
  const content = await fs.readFile(rawPath, 'utf-8');
  const allWords = content.split('\n')
    .map(line => line.split(' ')[0].trim())
    .filter(w => w && !/^\d+$/.test(w))
    .slice(0, WORDS_COUNT);

  const progressFile = path.join(OUTPUT_DIR, 'progress.json');
  let results = [];
  try {
    const saved = await fs.readFile(progressFile, 'utf-8');
    results = JSON.parse(saved);
    console.log(`[${langCode}] Resuming. ${results.length} already processed.`);
  } catch (e) {}

  const processedWords = new Set(results.map(r => r.word));
  const remaining = allWords.filter(w => !processedWords.has(w));
  
  let globalId = results.length > 0 ? Math.max(...results.map(w => w.id)) + 1 : 1;

  console.log(`[${langCode}] Remaining to process: ${remaining.length}`);

  for (let i = 0; i < remaining.length; i++) {
    const word = remaining[i];
    try {
      // Use Bing Translate API
      const res = await translate(word, null, 'zh-Hans');
      
      const text = res.translation;
      // Bing doesn't give phonetic for single words as reliably in this wrapper, but we get definitions

      results.push({
        id: globalId++,
        word: word,
        phonetic: '',
        pos: "", 
        definition: text,
        tag: "",
        example: null,
        exampleTranslation: null
      });

      if (i % 10 === 0) {
        console.log(`[${langCode}] Progress: ${i}/${remaining.length} (word: ${word} -> ${text})`);
        await fs.writeFile(progressFile, JSON.stringify(results, null, 2));
      }
      
      await delay(1000); // 1 second delay to avoid rate limits

    } catch (err) {
      console.error(`[${langCode}] Translate error on word "${word}":`, err.message);
      await delay(5000);
    }
  }

  await fs.writeFile(progressFile, JSON.stringify(results, null, 2));

  const totalShards = Math.ceil(results.length / SHARD_SIZE);
  for (let i = 0; i < totalShards; i++) {
    const shardWords = results.slice(i * SHARD_SIZE, (i + 1) * SHARD_SIZE);
    const shardIndex = i + 1;
    const padIndex = shardIndex.toString().padStart(3, '0');
    await fs.writeFile(
      path.join(OUTPUT_DIR, `words-${padIndex}.json`),
      JSON.stringify({ shardIndex, totalShards, words: shardWords }, null, 2),
      'utf-8'
    );
  }
  console.log(`[${langCode}] Finished all chunks.`);
}

async function main() {
  console.log("Starting Japanese background crawling loop with Bing Translate...");
  try {
    await processLanguage('ja');
  } catch (e) {
    console.error(`Failed:`, e);
  }
  console.log("Japanese vocabulary crawling complete!");
}

main().catch(console.error);
