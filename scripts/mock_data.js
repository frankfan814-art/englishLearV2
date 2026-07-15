import fs from 'fs/promises';
import path from 'path';

const basePath = path.join(process.cwd(), 'public', 'data');

const mockData = {
  ja: [
    { id: 1, word: "私", phonetic: "watashi", pos: "pron.", definition: "我", tag: "N5", example: "私は学生です。", exampleTranslation: "我是学生。" },
    { id: 2, word: "する", phonetic: "suru", pos: "v.", definition: "做", tag: "N5", example: "宿題をする。", exampleTranslation: "做作业。" },
    { id: 3, word: "行く", phonetic: "iku", pos: "v.", definition: "去", tag: "N5", example: "学校に行く。", exampleTranslation: "去学校。" },
    { id: 4, word: "これ", phonetic: "kore", pos: "pron.", definition: "这个", tag: "N5", example: "これは本です。", exampleTranslation: "这是书。" },
    { id: 5, word: "良い", phonetic: "yoi", pos: "adj.", definition: "好的", tag: "N5", example: "天気が良い。", exampleTranslation: "天气很好。" },
    { id: 6, word: "人", phonetic: "hito", pos: "n.", definition: "人", tag: "N5", example: "あの人は誰ですか。", exampleTranslation: "那个人是谁？" },
    { id: 7, word: "食べる", phonetic: "taberu", pos: "v.", definition: "吃", tag: "N5", example: "りんごを食べる。", exampleTranslation: "吃苹果。" },
    { id: 8, word: "見る", phonetic: "miru", pos: "v.", definition: "看", tag: "N5", example: "映画を見る。", exampleTranslation: "看电影。" },
    { id: 9, word: "大きい", phonetic: "ookii", pos: "adj.", definition: "大的", tag: "N5", example: "大きい家。", exampleTranslation: "大房子。" },
    { id: 10, word: "水", phonetic: "mizu", pos: "n.", definition: "水", tag: "N5", example: "水を飲む。", exampleTranslation: "喝水。" }
  ],
  ko: [
    { id: 1, word: "나", phonetic: "na", pos: "pron.", definition: "我", tag: "TOPIK 1", example: "나는 학생이다.", exampleTranslation: "我是学生。" },
    { id: 2, word: "하다", phonetic: "hada", pos: "v.", definition: "做", tag: "TOPIK 1", example: "공부를 하다.", exampleTranslation: "学习。" },
    { id: 3, word: "가다", phonetic: "gada", pos: "v.", definition: "去", tag: "TOPIK 1", example: "학교에 가다.", exampleTranslation: "去学校。" },
    { id: 4, word: "이것", phonetic: "igeot", pos: "pron.", definition: "这个", tag: "TOPIK 1", example: "이것은 책입니다.", exampleTranslation: "这是书。" },
    { id: 5, word: "좋다", phonetic: "jota", pos: "adj.", definition: "好的", tag: "TOPIK 1", example: "날씨가 좋다.", exampleTranslation: "天气很好。" },
    { id: 6, word: "사람", phonetic: "saram", pos: "n.", definition: "人", tag: "TOPIK 1", example: "저 사람은 누구입니까?", exampleTranslation: "那个人是谁？" },
    { id: 7, word: "먹다", phonetic: "meokda", pos: "v.", definition: "吃", tag: "TOPIK 1", example: "밥을 먹다.", exampleTranslation: "吃饭。" },
    { id: 8, word: "보다", phonetic: "boda", pos: "v.", definition: "看", tag: "TOPIK 1", example: "영화를 보다.", exampleTranslation: "看电影。" },
    { id: 9, word: "크다", phonetic: "keuda", pos: "adj.", definition: "大的", tag: "TOPIK 1", example: "집이 크다.", exampleTranslation: "房子很大。" },
    { id: 10, word: "물", phonetic: "mul", pos: "n.", definition: "水", tag: "TOPIK 1", example: "물을 마시다.", exampleTranslation: "喝水。" }
  ],
  de: [
    { id: 1, word: "ich", phonetic: "ɪç", pos: "pron.", definition: "我", tag: "A1", example: "Ich bin ein Student.", exampleTranslation: "我是一名学生。" },
    { id: 2, word: "machen", phonetic: "ˈmaxn̩", pos: "v.", definition: "做", tag: "A1", example: "Ich mache meine Hausaufgaben.", exampleTranslation: "我在做作业。" },
    { id: 3, word: "gehen", phonetic: "ˈɡeːən", pos: "v.", definition: "去", tag: "A1", example: "Wir gehen zur Schule.", exampleTranslation: "我们去学校。" },
    { id: 4, word: "das", phonetic: "das", pos: "pron.", definition: "这个", tag: "A1", example: "Das ist ein Buch.", exampleTranslation: "这是一本书。" },
    { id: 5, word: "gut", phonetic: "ɡuːt", pos: "adj.", definition: "好的", tag: "A1", example: "Das Wetter ist gut.", exampleTranslation: "天气很好。" },
    { id: 6, word: "Mensch", phonetic: "mɛnʃ", pos: "n.", definition: "人", tag: "A1", example: "Jeder Mensch ist anders.", exampleTranslation: "每个人都是不同的。" },
    { id: 7, word: "essen", phonetic: "ˈɛsn̩", pos: "v.", definition: "吃", tag: "A1", example: "Ich esse einen Apfel.", exampleTranslation: "我吃一个苹果。" },
    { id: 8, word: "sehen", phonetic: "ˈzeːən", pos: "v.", definition: "看", tag: "A1", example: "Ich sehe einen Film.", exampleTranslation: "我看一部电影。" },
    { id: 9, word: "groß", phonetic: "ɡʁoːs", pos: "adj.", definition: "大的", tag: "A1", example: "Ein großes Haus.", exampleTranslation: "一座大房子。" },
    { id: 10, word: "Wasser", phonetic: "ˈvasɐ", pos: "n.", definition: "水", tag: "A1", example: "Ich trinke Wasser.", exampleTranslation: "我喝水。" }
  ],
  es: [
    { id: 1, word: "yo", phonetic: "ʝo", pos: "pron.", definition: "我", tag: "A1", example: "Yo soy estudiante.", exampleTranslation: "我是学生。" },
    { id: 2, word: "hacer", phonetic: "aˈθeɾ", pos: "v.", definition: "做", tag: "A1", example: "Hago mis deberes.", exampleTranslation: "我在做作业。" },
    { id: 3, word: "ir", phonetic: "iɾ", pos: "v.", definition: "去", tag: "A1", example: "Voy a la escuela.", exampleTranslation: "我去学校。" },
    { id: 4, word: "esto", phonetic: "ˈesto", pos: "pron.", definition: "这个", tag: "A1", example: "Esto es un libro.", exampleTranslation: "这是一本书。" },
    { id: 5, word: "bueno", phonetic: "ˈbweno", pos: "adj.", definition: "好的", tag: "A1", example: "El clima es bueno.", exampleTranslation: "天气很好。" },
    { id: 6, word: "persona", phonetic: "peɾˈsona", pos: "n.", definition: "人", tag: "A1", example: "¿Quién es esa persona?", exampleTranslation: "那个人是谁？" },
    { id: 7, word: "comer", phonetic: "koˈmeɾ", pos: "v.", definition: "吃", tag: "A1", example: "Como una manzana.", exampleTranslation: "我吃一个苹果。" },
    { id: 8, word: "ver", phonetic: "beɾ", pos: "v.", definition: "看", tag: "A1", example: "Veo una película.", exampleTranslation: "我看一部电影。" },
    { id: 9, word: "grande", phonetic: "ˈɡɾande", pos: "adj.", definition: "大的", tag: "A1", example: "Una casa grande.", exampleTranslation: "一座大房子。" },
    { id: 10, word: "agua", phonetic: "ˈaɣwa", pos: "n.", definition: "水", tag: "A1", example: "Bebo agua.", exampleTranslation: "我喝水。" }
  ],
  fr: [
    { id: 1, word: "je", phonetic: "ʒə", pos: "pron.", definition: "我", tag: "A1", example: "Je suis étudiant.", exampleTranslation: "我是学生。" },
    { id: 2, word: "faire", phonetic: "fɛʁ", pos: "v.", definition: "做", tag: "A1", example: "Je fais mes devoirs.", exampleTranslation: "我在做作业。" },
    { id: 3, word: "aller", phonetic: "a.le", pos: "v.", definition: "去", tag: "A1", example: "Je vais à l'école.", exampleTranslation: "我去学校。" },
    { id: 4, word: "ça", phonetic: "sa", pos: "pron.", definition: "这个", tag: "A1", example: "C'est un livre.", exampleTranslation: "这是一本书。" },
    { id: 5, word: "bon", phonetic: "bɔ̃", pos: "adj.", definition: "好的", tag: "A1", example: "Le temps est bon.", exampleTranslation: "天气很好。" },
    { id: 6, word: "personne", phonetic: "pɛʁ.sɔn", pos: "n.", definition: "人", tag: "A1", example: "Qui est cette personne?", exampleTranslation: "那个人是谁？" },
    { id: 7, word: "manger", phonetic: "mɑ̃.ʒe", pos: "v.", definition: "吃", tag: "A1", example: "Je mange une pomme.", exampleTranslation: "我吃一个苹果。" },
    { id: 8, word: "voir", phonetic: "vwaʁ", pos: "v.", definition: "看", tag: "A1", example: "Je vois un film.", exampleTranslation: "我看一部电影。" },
    { id: 9, word: "grand", phonetic: "ɡʁɑ̃", pos: "adj.", definition: "大的", tag: "A1", example: "Une grande maison.", exampleTranslation: "一座大房子。" },
    { id: 10, word: "eau", phonetic: "o", pos: "n.", definition: "水", tag: "A1", example: "Je bois de l'eau.", exampleTranslation: "我喝水。" }
  ]
};

async function createMockData() {
  for (const [lang, words] of Object.entries(mockData)) {
    const langDir = path.join(basePath, lang);
    await fs.mkdir(langDir, { recursive: true });
    
    const fileContent = {
      shardIndex: 1,
      totalShards: 1,
      words: words
    };
    
    await fs.writeFile(
      path.join(langDir, 'words-001.json'),
      JSON.stringify(fileContent, null, 2),
      'utf-8'
    );
    console.log(`Created mock data for ${lang}`);
  }
}

createMockData().catch(console.error);
