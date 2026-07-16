import { Word, WordShard, DataLoaderConfig } from '../types/word';

export class DataLoader {
  private config: DataLoaderConfig;
  private cache: Map<number, Word[]> = new Map();
  private loading: Map<number, Promise<Word[]>> = new Map();

  constructor(config: DataLoaderConfig) {
    this.config = config;
  }

  async loadShard(index: number): Promise<Word[]> {
    if (this.cache.has(index)) {
      return this.cache.get(index)!;
    }
    if (this.loading.has(index)) {
      return this.loading.get(index)!;
    }
    const loadPromise = this._fetchShard(index);
    this.loading.set(index, loadPromise);
    return loadPromise;
  }

  private async _fetchShard(index: number): Promise<Word[]> {
    try {
      const { basePath, filePattern } = this.config;
      const filename = filePattern.replace('{index}', String(index).padStart(3, '0'));
      const response = await fetch(`${basePath}${filename}`);
      if (!response.ok) {
        throw new Error(`Failed to load shard ${index} from ${basePath}`);
      }
      const data: WordShard = await response.json();
      this.cache.set(index, data.words);
      this.loading.delete(index);
      return data.words;
    } catch (error) {
      this.loading.delete(index);
      throw error;
    }
  }

  async getWord(globalIndex: number): Promise<Word | null> {
    const { shardSize } = this.config;
    const shardIndex = Math.floor(globalIndex / shardSize) + 1;
    const localIndex = globalIndex % shardSize;

    try {
      const words = await this.loadShard(shardIndex);
      return words[localIndex] || null;
    } catch (error) {
      console.error('Failed to get word:', error);
      return null;
    }
  }

  async preloadAdjacent(currentIndex: number): Promise<void> {
    const { shardSize, totalShards } = this.config;
    const currentShard = Math.floor(currentIndex / shardSize) + 1;

    const toPreload = [
      currentShard - 1,
      currentShard,
      currentShard + 1,
    ].filter(i => i >= 1 && i <= totalShards);

    await Promise.all(toPreload.map(i => this.loadShard(i).catch(() => {})));
  }

  clearCache(): void {
    this.cache.clear();
    this.loading.clear();
  }

  getTotalWords(): number {
    return this.config.shardSize * (this.config.totalShards - 1) + this.config.lastShardSize;
  }
}

// 保留实例以供向后兼容，但标记为废弃
/** @deprecated 使用 languageRegistry.getDataLoader('en') 替代 */
export const dataLoader = new DataLoader({
  basePath: '/data/',
  shardSize: 1000,
  totalShards: 17,
  filePattern: 'words-{index}.json',
  lastShardSize: 194,
});
