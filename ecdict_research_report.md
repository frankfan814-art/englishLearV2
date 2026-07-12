# ECDICT 及相关词库研究分析报告

## 1. ECDICT CSV 字段定义 (skywind3000/ECDICT)

**来源**: https://github.com/skywind3000/ECDICT

### CSV 列名（共15列）

| 字段 | 类型 | 说明 |
|------|------|------|
| word | TEXT | 单词名称 |
| phonetic | TEXT | 音标（英语英标） |
| definition | TEXT | 英文释义（每行一个释义） |
| translation | TEXT | 中文释义（每行一个释义） |
| pos | TEXT | 词性位置，用 "/" 分割 |
| collins | INTEGER | 柯林斯星级（1-5星，0表示无评级） |
| oxford | INTEGER | 是否为牛津三千核心词（1=是，0=否） |
| tag | VARCHAR(64) | 考试标签，空格分割 |
| bnc | INTEGER | 英国国家语料库词频顺序（数值越小越常用） |
| frq | INTEGER | 当代语料库词频顺序（数值越小越常用） |
| exchange | TEXT | 时态复数等变换，"/"分割 |
| detail | TEXT | 详细数据（JSON格式，含近义词、记忆法等） |
| audio | TEXT | 音频信息 |
| sw | TEXT | 搜索键（去除空格后的词条） |

**总词数**: 基础版 ecdict.csv 约 76 万词条，最新版（v1.0.14）收词 222 万。

### Tag 字段值说明

从 issue #5 和源码 `dictutils.py` 中确认的 tag 取值：

| Tag | 含义 |
|-----|------|
| zk | 中考 |
| gk | 高考 |
| ky | 考研 |
| cet4 | 大学英语四级 |
| cet6 | 大学英语六级 |
| ielts | 雅思 |
| toefl | 托福 |
| gre | GRE（红宝书） |

tag 字段以空格分隔多个标签，如 `"cet4 cet6 ky"`。

### Collins 星级

- 范围：1-5（0 表示无评级）
- 5 星：日常最常用词汇，频率最高
- 4 星、3 星、2 星、1 星：依次降低频率
- 牛津三千核心词由 `oxford=1` 标识，可独立于 Collins 使用

### BNC / FRQ 词频字段

- bnc: 英国国家语料库（British National Corpus）词频排名
- frq: 当代美语语料库（COCA）词频排名
- 数值越小表示越常用。例如 quay 的 bnc=8906 表示它在 BNC 中排第 8906 名。

---

## 2. kajweb/dict JSON 结构

**来源**: https://github.com/kajweb/dict

### 数据结构

kajweb/dict 的数据源自网易有道词典的单词本 API，原始格式为每个词库一个 zip 包，解压后为 JSON。

### 词库列表（81 个词库）

按考试分类：
- **国内考试**: 中考(ChuZhong)、高考(GaoZhong)、四级(CET4)、六级(CET6)、专四(Level4)、专八(Level8)、考研(KaoYan)
- **出国考试**: 雅思(IELTS)、托福(TOEFL)、GRE、SAT、GMAT
- **教材同步**: 人教版(PEP)小学/初中/高中、北师大版(BeiShi)高中、外研社版(WaiYanShe)初中
- **商务**: BEC

### 每个词条 JSON 字段

```
{
  "wordRank": 序号,
  "headWord": "单词",
  "content": {
    "word": {
      "wordHead": "单词",
      "wordId": "词库ID_序号",
      "content": {
        "exam": {                           // 考试题目
          "question": "题目",
          "answer": { "explain": "解析", "rightIndex": 正确选项索引 },
          "examType": "考试类型",
          "choices": [{"choiceIndex": "A", "choice": "选项内容"}]
        },
        "sentence": {                       // 例句
          "desc": "例句",
          "sentences": [
            {"sContent": "英文例句", "sCn": "中文翻译"}
          ]
        },
        "usphone": "美式音标",
        "ukphone": "英式音标",
        "syno": [                           // 近义词
          {"pos": "词性", "tran": "中文", "hwds": [{"hwd": "近义词"}]}
        ],
        "phrase": [                         // 短语
          {"pContent": "短语", "pCn": "中文释义"}
        ],
        "relWord": [                        // 同根词
          {"pos": "词性", "hwd": "单词", "tran": "释义"}
        ],
        "trans": [                          // 翻译
          {"tranCn": "中文释义", "pos": "词性", "tranOther": "其他"}
        ],
        "ukspeech": "英音音频参数",
        "usspeech": "美音音频参数"
      }
    }
  }
}
```

### 关键特点

- 每个词条包含 **英/美音标**、**例句**（英中对照）、**近义词**、**短语**、**同根词**
- 词库按考试分类，每个词条有 `bookId` 标识所属词库
- 例句数据质量高，来自有道词典

---

## 3. ismartcoding/endict 结构

**来源**: https://github.com/ismartcoding/endict

### 整体结构

```
endict/
  dict/          -- 608个JSON文件，按字母序号命名 (0001.json ~ 0608.json)
  audio/
    uk/          -- 英式发音 MP3，文件名 = word.mp3
    us/          -- 美式发音 MP3，文件名 = word.mp3
  vocabulary/    -- 纯词表（JSON数组，每个元素是单词字符串）
    chuzhong.json
    gaozhong.json
    cet4.json
    cet6.json
    kaoyan.json
    xiaoxue.json
```

### 字典 JSON 格式

`dict/0001.json` 中的每个词条：

```
{
  "word": "单词或短语",
  "sw": "搜索键（去空格）",
  "phonetic": "音标",
  "definition": "英文释义",
  "translation": "中文翻译",
  "pos": "词性",
  "exchange": "词形变化",
  "examples": []  // 例句数组（多为空）
}
```

### 音频文件

- 约 8000 个常见单词的英式和美式发音 MP3
- 按文件夹区分：`audio/uk/abandon.mp3`, `audio/us/abandon.mp3`
- 文件名就是单词本身

### 词表

- 每个词表是一个纯 JSON 字符串数组，如 `["a", "abandon", "ability", ...]`
- 不包含元数据，只是单词列表

---

## 4. 筛选方案：提取 ~20000 个有用单词

### 目标

从 ECDICT 的 76 万词条中筛选出约 15000-20000 个适合中高级英语学习者的单词，过滤掉：
- 中考（初中）水平及以下的基础词
- Collins 5 星级（最常用词）
- 超低频词

### SQL/Filter Plan

```sql
-- 方案 A：按 tag 和频率组合筛选
SELECT word, phonetic, translation, definition, pos, collins, tag, bnc, frq
FROM ecdict
WHERE 1=1
  -- 排除中考词汇
  AND (tag IS NULL OR tag NOT LIKE '%zk%')
  -- 排除 Collins 5 星（最常用词）
  AND (collins IS NULL OR collins < 5)
  -- 词频排名在合理范围内（排除超低频词）
  AND (frq IS NOT NULL AND frq > 0 AND frq <= 30000)
  -- 必须有中文释义
  AND (translation IS NOT NULL AND translation != '')
ORDER BY frq ASC
LIMIT 20000;
```

```sql
-- 方案 B：分层筛选（更精细）
-- 1. 保留以下标签的单词：gk, cet4, cet6, ky, ielts, toefl, gre
-- 2. 无标签单词：按词频取前 N 名
-- 3. 排除中考标签
-- 4. 排除 Collins 5 星（可选）

SELECT word, phonetic, translation, definition, collins, tag, bnc, frq
FROM ecdict
WHERE (
  -- 有考试标签的（除中考外）
  (tag IS NOT NULL AND tag LIKE '%gk%' OR tag LIKE '%cet4%' OR tag LIKE '%cet6%' 
   OR tag LIKE '%ky%' OR tag LIKE '%ielts%' OR tag LIKE '%toefl%' OR tag LIKE '%gre%')
  OR
  -- 无标签但词频在前 30000 且 Collins <= 4 的
  (tag IS NULL AND frq > 0 AND frq <= 30000 AND (collins IS NULL OR collins < 5))
)
-- 排除中考词汇
AND (tag IS NULL OR tag NOT LIKE '%zk%')
ORDER BY 
  CASE 
    WHEN tag LIKE '%cet4%' THEN 1
    WHEN tag LIKE '%cet6%' THEN 2
    WHEN tag LIKE '%gk%' THEN 3
    WHEN tag LIKE '%ky%' THEN 4
    WHEN tag LIKE '%ielts%' THEN 5
    WHEN tag LIKE '%toefl%' THEN 6
    WHEN tag LIKE '%gre%' THEN 7
    ELSE 8
  END,
  frq ASC;
```

### 预估词量

| 筛选条件 | 预估词量 |
|---------|---------|
| Collins 5 星 | ~700 词（最常用核心词） |
| Collins 4 星 | ~1500 词 |
| Collins 3 星 | ~3000 词 |
| Collins 2 星 | ~6000 词 |
| Collins 1 星 | ~8000 词 |
| 带 cet4 标签 | ~4500 词 |
| 带 cet6 标签 | ~4500 词 |
| 带 gk 标签 | ~3500 词 |
| 带 zk 标签 | ~2000 词 |
| frq <= 30000 | ~30000 词 |
| frq <= 20000 | ~20000 词 |

**推荐组合**: 取 frq <= 20000 且 collins <= 4 且不含 zk 标签，约 16000-20000 词。

### 补充说明

- `collins` 和 `frq` 都是可选的，很多词条没有 Collins 评级但有 frq 值
- `bnc` 偏英式英语词频，`frq` 偏美式/当代，建议优先用 `frq`
- 无 frq 值的词条多为专业术语或低频词，可以排除

---

## 5. 合并例句方案：ECDICT + kajweb/dict

### 问题

ECDICT 不包含例句数据。kajweb/dict 的每个词条包含高质量的双语例句。

### 合并策略

```
Step 1: 从 ECDICT 筛选出目标词表（~20000 词）
Step 2: 从 kajweb/dict 的所有词库中提取例句，按 headWord 建立索引
Step 3: 对每个目标词，查找对应的例句
Step 4: 合并为最终数据格式
```

### 数据结构设计

```json
{
  "word": "abandon",
  "phonetic": "/əˈbændən/",
  "translation": "v. 放弃；遗弃",
  "definition": "to leave someone or something permanently",
  "pos": "v.",
  "collins": 4,
  "tag": "cet4 cet6 ky",
  "bnc": 1942,
  "frq": 2051,
  "sentences": [
    {
      "en": "They had to abandon their plans.",
      "cn": "他们不得不放弃计划。"
    }
  ],
  "audio": "uk/abandon.mp3"
}
```

### 具体合并步骤

1. **用 ECDICT 做主表**（最完善的词频+考试标签）
2. **用 kajweb/dict 补充例句**：遍历所有 81 个词库的 zip，按 `headWord` 匹配，提取 `sentence.sentences` 数组
3. **用 endict 补充音频路径**：检查 `audio/uk/{word}.mp3` 和 `audio/us/{word}.mp3` 是否存在
4. **去重**：同一个词可能有多个来源的例句，取前 3 条即可

### 实现注意

- kajweb/dict 的 zip 包解压后，每个词条有 `bookId` 和 `wordId` 字段，按 `headWord` 索引
- 合并时以 ECDICT 的词条为准，例句只做补充，不做替换
- 最终输出建议用 JSON Lines 格式（每行一个 JSON 对象），便于程序读取