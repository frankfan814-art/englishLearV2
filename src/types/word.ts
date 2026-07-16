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

export interface DataLoaderConfig {
  basePath: string;
  shardSize: number;
  totalShards: number;
  filePattern: string;   // 支持 {index} 占位符
  lastShardSize: number; // 最后一个分片的实际单词数
}

export interface Settings {
  speed: number;
  speechRate?: number;
  readExample?: boolean;
  readDefinition?: boolean;   // 新增：读中文释义
  accent: string;
  autoPlay: boolean;
}