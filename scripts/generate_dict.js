import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 语言配置
const LANGUAGES = {
  ja: { name: 'Japanese', url: 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2016/ja/ja_50k.txt' },
  ko: { name: 'Korean', url: 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2016/ko/ko_50k.txt' },
  de: { name: 'German', url: 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2016/de/de_50k.txt' },
  es: { name: 'Spanish', url: 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2016/es/es_50k.txt' },
  fr: { name: 'French', url: 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2016/fr/fr_50k.txt' }
};

// ================= 配置区 =================
const TARGET_LANG = 'ja'; // 当前处理语言: ja (日语)
const WORDS_COUNT = 20000; // 目标获取单词数
const BATCH_SIZE = 10;     // 每次发送给 API 的单词数量（批量处理更省钱且快）
const SHARD_SIZE = 5000;   // 每个 JSON 文件存放多少个单词

// DeepSeek API 配置（密钥通过环境变量传入，不要写进代码：export DEEPSEEK_API_KEY=sk-...）
const API_KEY = process.env.DEEPSEEK_API_KEY || '';
if (!API_KEY) {
  console.error('请先设置环境变量 DEEPSEEK_API_KEY');
  process.exit(1);
}
const API_URL = 'https://api.deepseek.com/v1/chat/completions';
const MODEL = 'deepseek-chat';

// ===========================================

const RAW_DIR = path.join(__dirname, 'raw');
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'data', TARGET_LANG);

async function downloadFrequencyList(lang) {
  const fileInfo = LANGUAGES[lang];
  await fs.mkdir(RAW_DIR, { recursive: true });
  const rawPath = path.join(RAW_DIR, `${lang}_50k.txt`);
  
  try {
    await fs.access(rawPath);
    console.log(`✅ ${lang}_50k.txt already exists. Skipping download.`);
    return rawPath;
  } catch {
    console.log(`⬇️ Downloading frequency list for ${fileInfo.name}...`);
    // 注意：这里的下载可能需要翻墙，如果本地网络不通可以手动下载
    const res = await fetch(fileInfo.url);
    if (!res.ok) throw new Error(`Failed to download: ${res.statusText}`);
    const text = await res.text();
    await fs.writeFile(rawPath, text, 'utf-8');
    console.log(`✅ Downloaded ${lang}_50k.txt`);
    return rawPath;
  }
}

async function getTopWords(rawPath, limit) {
  const content = await fs.readFile(rawPath, 'utf-8');
  const lines = content.split('\n').map(line => line.trim()).filter(Boolean);
  
  const words = [];
  for (const line of lines) {
    const [word] = line.split(' ');
    // 过滤掉纯数字或单字符的一些无意义标点
    if (word && !/^\d+$/.test(word)) {
      // 对日语来说，稍微过滤一下单假名粒子，不过词频表前列的往往是需要的
      words.push(word);
    }
    if (words.length >= limit) break;
  }
  return words;
}

async function fetchWordDetailsBatch(lang, words) {
  const langName = LANGUAGES[lang].name;
  
  const prompt = `你是一个专业的语言词典API。现在请为以下 ${langName} 单词提供精准的词典数据。
必须返回一个 JSON 数组，不要返回任何 markdown 标记（如 \`\`\`json ），只需返回纯 JSON。
每个对象必须严格包含以下字段：
- "word": 原单词。
- "phonetic": 音标（日语请提供平假名罗马音，或者仅仅平假名注音）。
- "pos": 词性（如 v., n., adj., adv. 等，未知或助词请如实标注）。
- "definition": 简体中文释义。
- "example": 一个简短的 ${langName} 例句。
- "exampleTranslation": 该例句的简体中文翻译。

待处理单词：
${words.join(', ')}
`;

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
      })
    });

    if (!response.ok) {
      console.error(`API Error: ${response.status} ${response.statusText}`);
      const text = await response.text();
      console.error(text);
      return [];
    }

    const data = await response.json();
    let content = data.choices[0].message.content.trim();
    if (content.startsWith('```')) {
      content = content.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    }
    
    return JSON.parse(content);
  } catch (error) {
    console.error(`Failed to process batch: ${words.join(', ')}`, error.message);
    return [];
  }
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const rawPath = await downloadFrequencyList(TARGET_LANG);
  const words = await getTopWords(rawPath, WORDS_COUNT);
  
  console.log(`🚀 Starting AI extraction for ${words.length} ${TARGET_LANG} words using DeepSeek...`);
  
  const progressFile = path.join(OUTPUT_DIR, 'progress_ai.json');
  let allResults = [];
  try {
    const savedProgress = await fs.readFile(progressFile, 'utf-8');
    allResults = JSON.parse(savedProgress);
    console.log(`⏩ Resuming from saved progress. ${allResults.length} words already processed.`);
  } catch {
    // 忽略文件不存在的错误
  }

  const processedWords = new Set(allResults.map(r => r.word));
  const remainingWords = words.filter(w => !processedWords.has(w));
  
  let globalIdCounter = allResults.length > 0 ? Math.max(...allResults.map(w => w.id)) + 1 : 1;

  for (let i = 0; i < remainingWords.length; i += BATCH_SIZE) {
    const batch = remainingWords.slice(i, i + BATCH_SIZE);
    console.log(`⏳ Processing batch ${Math.floor(i / BATCH_SIZE) + 1} / ${Math.ceil(remainingWords.length / BATCH_SIZE)}: ${batch.join(', ')}`);
    
    const results = await fetchWordDetailsBatch(TARGET_LANG, batch);
    
    if (results && results.length > 0) {
      // 验证并添加 ID
      const formattedResults = results.map(r => ({
        id: globalIdCounter++,
        word: r.word || '',
        phonetic: r.phonetic || '',
        pos: r.pos || '',
        definition: r.definition || '',
        tag: '',
        example: r.example || null,
        exampleTranslation: r.exampleTranslation || null
      }));

      allResults.push(...formattedResults);
      await fs.writeFile(progressFile, JSON.stringify(allResults, null, 2), 'utf-8');
    }
    
    // DeepSeek API 并发较高，但为了安全加点微小延时
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log(`✅ All words processed. Saving to JSON shards...`);
  
  const totalShards = Math.ceil(allResults.length / SHARD_SIZE);
  for (let i = 0; i < totalShards; i++) {
    const shardWords = allResults.slice(i * SHARD_SIZE, (i + 1) * SHARD_SIZE);
    const shardIndex = i + 1;
    const padIndex = shardIndex.toString().padStart(3, '0');
    
    await fs.writeFile(
      path.join(OUTPUT_DIR, `words-${padIndex}.json`),
      JSON.stringify({ shardIndex, totalShards, words: shardWords }, null, 2),
      'utf-8'
    );
  }
  
  console.log(`🎉 Success! High quality AI data saved in ${OUTPUT_DIR}`);
}

main().catch(console.error);
