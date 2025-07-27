import { logger } from './logger';

interface CacheItem<T> {
  data: T;
  timestamp: number;
}

class Cache {
  private static instance: Cache;
  private cache: Map<string, CacheItem<any>>;
  private defaultTTL: number = 5; // 5 minutes default

  // Common TTL presets in minutes
  static readonly TTL = {
    SHORT: 5, // 5 minutes
    MEDIUM: 15, // 15 minutes
    LONG: 60, // 1 hour
    VERY_LONG: 1440, // 24 hours
  };

  private constructor() {
    this.cache = new Map();
  }

  public static getInstance(): Cache {
    if (!Cache.instance) {
      Cache.instance = new Cache();
    }
    return Cache.instance;
  }

  /**
   * Set a value in the cache
   * @param key The cache key
   * @param data The data to cache
   * @param ttlMinutes Time to live in minutes (defaults to 5 minutes)
   */
  public set<T>(key: string, data: T, ttlMinutes: number = this.defaultTTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now() + ttlMinutes * 60 * 1000, // Convert minutes to milliseconds
    });
  }

  /**
   * Get a value from the cache
   * @param key The cache key
   * @returns The cached data or null if expired/not found
   */
  public get<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) {
      logger.debug('cache', 'get', `Cache miss for key: ${key}`);
      return null;
    }

    if (Date.now() > item.timestamp) {
      logger.debug('cache', 'get', `Cache expired for key: ${key}`);
      this.cache.delete(key);
      return null;
    }

    logger.debug('cache', 'get', `Cache hit for key: ${key}`);
    return item.data as T;
  }

  /**
   * Clear all cached items
   */
  public clear(): void {
    this.cache.clear();
  }

  /**
   * Remove a specific item from the cache
   * @param key The cache key to remove
   */
  public delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Check if a key exists in the cache and is not expired
   * @param key The cache key to check
   * @returns boolean indicating if the key exists and is valid
   */
  public has(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) return false;

    if (Date.now() > item.timestamp) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Set the default TTL for new cache entries
   * @param minutes The default TTL in minutes
   */
  public setDefaultTTL(minutes: number): void {
    this.defaultTTL = minutes;
  }
}

export const cache = Cache.getInstance();
