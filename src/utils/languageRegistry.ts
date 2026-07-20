import { DataLoader } from './dataLoader';
import { DataLoaderConfig } from '../types/word';

export const LANGUAGE_CONFIGS: Record<string, DataLoaderConfig> = {
  en: {
    basePath: '/data/',
    shardSize: 1000,
    totalShards: 17,
    filePattern: 'words-{index}.json',
    lastShardSize: 194,
  },
  ja: {
    basePath: '/data/ja/',
    shardSize: 5000,
    totalShards: 4,
    filePattern: 'words-{index}.json',
    lastShardSize: 4929,
  },
  ko: {
    basePath: '/data/ko/',
    shardSize: 5000,
    totalShards: 4,
    filePattern: 'words-{index}.json',
    lastShardSize: 967,
  },
  de: {
    basePath: '/data/de/',
    shardSize: 5000,
    totalShards: 3,
    filePattern: 'words-{index}.json',
    lastShardSize: 5000,
  },
};

const loaders = new Map<string, DataLoader>();

export function getDataLoader(language: string): DataLoader {
  if (!loaders.has(language)) {
    const config = LANGUAGE_CONFIGS[language];
    if (!config) {
      throw new Error(`Unknown language: ${language}`);
    }
    loaders.set(language, new DataLoader(config));
  }
  return loaders.get(language)!;
}

export function getTotalWords(language: string): number {
  const config = LANGUAGE_CONFIGS[language];
  if (!config) return 0;
  return config.shardSize * (config.totalShards - 1) + config.lastShardSize;
}
