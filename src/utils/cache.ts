/**
 * In-Memory Cache Utility with TTL (Time-To-Live)
 * 
 * Usage:
 *   import { createCache } from '../utils/cache';
 *   const orgCache = createCache<OrgType[]>(5 * 60 * 1000); // 5 min TTL
 *   const data = await orgCache.getOrFetch('all-orgs', () => fetchFromDb());
 *   orgCache.invalidate('all-orgs');  // Manual invalidation
 */

interface CacheEntry<T> {
    data: T;
    expiresAt: number;
}

export class TTLCache<T = any> {
    private store = new Map<string, CacheEntry<T>>();
    private readonly defaultTTL: number;

    /** @param defaultTTLms Default time-to-live in milliseconds */
    constructor(defaultTTLms: number) {
        this.defaultTTL = defaultTTLms;
    }

    /** Get cached value or null if expired/missing */
    get(key: string): T | null {
        const entry = this.store.get(key);
        if (!entry) return null;
        if (Date.now() > entry.expiresAt) {
            this.store.delete(key);
            return null;
        }
        return entry.data;
    }

    /** Set a value in cache with optional custom TTL */
    set(key: string, data: T, ttlMs?: number): void {
        this.store.set(key, {
            data,
            expiresAt: Date.now() + (ttlMs ?? this.defaultTTL),
        });
    }

    /** Get from cache, or fetch via callback and cache the result */
    async getOrFetch(key: string, fetcher: () => Promise<T>, ttlMs?: number): Promise<T> {
        const cached = this.get(key);
        if (cached !== null) return cached;

        const data = await fetcher();
        this.set(key, data, ttlMs);
        return data;
    }

    /** Remove a specific key */
    invalidate(key: string): void {
        this.store.delete(key);
    }

    /** Clear all cached entries */
    clear(): void {
        this.store.clear();
    }

    /** Number of entries currently stored */
    get size(): number {
        return this.store.size;
    }
}

/**
 * Factory function to create a typed cache instance.
 * @param defaultTTLms  Default TTL in milliseconds (e.g., 5 * 60 * 1000 for 5 min)
 */
export function createCache<T = any>(defaultTTLms: number): TTLCache<T> {
    return new TTLCache<T>(defaultTTLms);
}

// ── Pre-built shared caches for common reference data ──────────────

/** Reference data cache — orgs, colleges, industries, countries (10 min TTL) */
export const referenceDataCache = createCache<any>(10 * 60 * 1000);

/** Metadata cache — job roles, skills, certifications, departments (10 min TTL) */
export const referenceMetadataCache = createCache<any>(10 * 60 * 1000);

/** Small lookup cache — currencies, salary components, referral plans (30 min TTL) */
export const lookupCache = createCache<any>(30 * 60 * 1000);

/** Dashboard / stats cache — short-lived (30 seconds TTL) */
export const statsCache = createCache<any>(30 * 1000);
