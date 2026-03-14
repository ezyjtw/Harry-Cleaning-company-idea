import { MemoryCache } from '@/lib/infrastructure/cache';

describe('MemoryCache', () => {
  let cache: MemoryCache;

  beforeEach(() => {
    cache = new MemoryCache(600000); // Long cleanup interval for tests
  });

  afterEach(() => {
    cache.destroy();
  });

  it('should set and get values', () => {
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');
  });

  it('should return null for missing keys', () => {
    expect(cache.get('nonexistent')).toBeNull();
  });

  it('should expire entries after TTL', () => {
    cache.set('key1', 'value1', 1); // 1ms TTL
    // Wait a bit for expiry
    const start = Date.now();
    while (Date.now() - start < 5) {
      /* spin */
    }
    expect(cache.get('key1')).toBeNull();
  });

  it('should delete entries', () => {
    cache.set('key1', 'value1');
    cache.delete('key1');
    expect(cache.get('key1')).toBeNull();
  });

  it('should check if key exists', () => {
    cache.set('key1', 'value1');
    expect(cache.has('key1')).toBe(true);
    expect(cache.has('key2')).toBe(false);
  });

  it('should clear all entries', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.clear();
    expect(cache.size()).toBe(0);
  });

  it('should invalidate by prefix', () => {
    cache.set('user:1', 'data1');
    cache.set('user:2', 'data2');
    cache.set('booking:1', 'data3');
    const count = cache.invalidateByPrefix('user:');
    expect(count).toBe(2);
    expect(cache.get('user:1')).toBeNull();
    expect(cache.get('booking:1')).toBe('data3');
  });

  it('should support getOrSet pattern', async () => {
    let callCount = 0;
    const factory = async () => {
      callCount++;
      return 'computed-value';
    };

    const result1 = await cache.getOrSet('key1', factory);
    const result2 = await cache.getOrSet('key1', factory);

    expect(result1).toBe('computed-value');
    expect(result2).toBe('computed-value');
    expect(callCount).toBe(1); // Factory called only once
  });

  it('should handle various data types', () => {
    cache.set('number', 42);
    cache.set('object', { a: 1, b: 'two' });
    cache.set('array', [1, 2, 3]);
    cache.set('boolean', true);

    expect(cache.get('number')).toBe(42);
    expect(cache.get('object')).toEqual({ a: 1, b: 'two' });
    expect(cache.get('array')).toEqual([1, 2, 3]);
    expect(cache.get('boolean')).toBe(true);
  });
});
