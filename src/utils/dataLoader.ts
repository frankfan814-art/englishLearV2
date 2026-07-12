import { Word, WordShard } from '../types/word';

const SHARD_SIZE = 1000;
const TOTAL_SHARDS = 17;

class DataLoader {
  private cache: Map<number, Word[]> = new Map();
  private loading: Map<number, Promise<Word[]>> = new Map();

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
      const response = await fetch(`/data/words-${String(index).padStart(3, '0')}.json`);
      if (!response.ok) {
        throw new Error(`Failed to load shard ${index}`);
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
    const shardIndex = Math.floor(globalIndex / SHARD_SIZE) + 1;
    const localIndex = globalIndex % SHARD_SIZE;

    try {
      const words = await this.loadShard(shardIndex);
      return words[localIndex] || null;
    } catch (error) {
      console.error('Failed to get word:', error);
      return null;
    }
  }

  async preloadAdjacent(currentIndex: number): Promise<void> {
    const currentShard = Math.floor(currentIndex / SHARD_SIZE) + 1;

    const toPreload = [
      currentShard - 1,
      currentShard,
      currentShard + 1,
    ].filter(i => i >= 1 && i <= TOTAL_SHARDS);

    await Promise.all(toPreload.map(i => this.loadShard(i).catch(() => {})));
  }

  clearCache(): void {
    this.cache.clear();
    this.loading.clear();
  }
}

export const dataLoader = new DataLoader();