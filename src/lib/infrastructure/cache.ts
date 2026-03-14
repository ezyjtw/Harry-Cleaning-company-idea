/**
 * Simple in-memory cache with TTL support.
 * For production, replace with Redis-backed implementation.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class MemoryCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(cleanupIntervalMs: number = 60000) {
    if (typeof setInterval !== 'undefined') {
      this.cleanupInterval = setInterval(() => this.cleanup(), cleanupIntervalMs);
    }
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  set<T>(key: string, value: T, ttlMs: number = 300000): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  delete(key: string): boolean {
    return this.store.delete(key);
  }

  has(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  clear(): void {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }

  /**
   * Get or set pattern — fetches from cache or computes and caches
   */
  async getOrSet<T>(key: string, factory: () => Promise<T>, ttlMs: number = 300000): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) return cached;

    const value = await factory();
    this.set(key, value, ttlMs);
    return value;
  }

  /**
   * Invalidate all keys matching a prefix
   */
  invalidateByPrefix(prefix: string): number {
    let count = 0;
    const keysToDelete: string[] = [];
    this.store.forEach((_entry, key) => {
      if (key.startsWith(prefix)) {
        keysToDelete.push(key);
      }
    });
    for (const key of keysToDelete) {
      this.store.delete(key);
      count++;
    }
    return count;
  }

  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    this.store.forEach((entry, key) => {
      if (now > entry.expiresAt) {
        keysToDelete.push(key);
      }
    });
    for (const key of keysToDelete) {
      this.store.delete(key);
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.store.clear();
  }
}

// Singleton cache instances
export const queryCache = new MemoryCache(60000); // Cleanup every minute
export const apiCache = new MemoryCache(30000); // Cleanup every 30 seconds

// Cache key helpers
export const CacheKeys = {
  cleanerProfile: (id: string) => `cleaner:profile:${id}`,
  cleanerList: (filters: string) => `cleaner:list:${filters}`,
  bookingDetails: (id: string) => `booking:${id}`,
  dashboardStats: () => 'admin:dashboard:stats',
  pricingZone: (postcode: string) => `pricing:zone:${postcode}`,
  surgeInfo: (date: string) => `pricing:surge:${date}`,
  userNotifications: (userId: string) => `user:notifications:${userId}`,
};
