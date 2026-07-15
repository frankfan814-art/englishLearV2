export interface Word {
  id: number;
  word: string;
  phonetic: string;
  pos: string;
  definition: string;
  example?: string;
  exampleTranslation?: string;
  tag?: string;
}

export interface WordShard {
  shardIndex: number;
  totalShards: number;
  words: Word[];
}

export interface ProgressData {
  currentRound: number;
  currentIndex: number;
  completedRounds: number;
  lastUpdate: string;
}

export interface Settings {
  speed: number;
  speechRate?: number;
  readExample?: boolean;
  readDefinition?: boolean;   // 新增：读中文释义
  accent: 'us' | 'uk';
  autoPlay: boolean;
}