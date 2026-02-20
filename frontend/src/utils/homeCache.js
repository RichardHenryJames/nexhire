/**
 * homeCache.js — LinkedIn-style cache-first data layer for HomeScreen
 *
 * WHY THIS EXISTS:
 * LinkedIn feels instant because it shows CACHED data from the last session
 * immediately, then silently refreshes in the background. Our HomeScreen was
 * doing 8 parallel API calls on mount, each triggering a separate setState,
 * causing 8+ re-renders of a 1837-line component with loading spinners.
 *
 * HOW IT WORKS:
 * 1. On first app launch: normal API fetch (loading spinners show)
 * 2. After first fetch: data is cached to AsyncStorage
 * 3. On subsequent launches: cached data is loaded SYNCHRONOUSLY into state
 *    initializers (no loading spinners!), then API refreshes silently in bg
 * 4. Cache expires after 30 minutes — after that, loading spinners show again
 *
 * RESULT: Tab switch / app reopen → instant content, zero spinners, zero delay.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = 'home_cache_';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes — show cached data without spinners

// Cache keys
export const CACHE_KEYS = {
  // HomeScreen
  DASHBOARD_STATS: 'dashboard_stats',
  RECENT_JOBS: 'recent_jobs',
  F500_JOBS: 'f500_jobs',
  RECENT_APPLICATIONS: 'recent_applications',
  F500_COMPANIES: 'f500_companies',
  SOCIAL_CLAIMS: 'social_claims',
  WALLET_BALANCE: 'wallet_balance',
  REFERRER_REQUESTS: 'referrer_requests',
  // JobsScreen
  JOBS_LIST: 'jobs_list',
  JOBS_JOB_TYPES: 'jobs_job_types',
  JOBS_WORKPLACE_TYPES: 'jobs_workplace_types',
  JOBS_CURRENCIES: 'jobs_currencies',
  JOBS_SAVED_IDS: 'jobs_saved_ids',
  JOBS_COMPANIES: 'jobs_companies',
};

/**
 * In-memory mirror of the cache — accessed synchronously.
 * Populated from AsyncStorage on app startup (see warmCache).
 * This is what makes it feel instant: no async read needed at render time.
 */
const memoryCache = {};

/**
 * Warm the in-memory cache from AsyncStorage.
 * Call this ONCE at app startup (e.g., in App.js or AuthContext after login).
 * After this, getCached() returns data synchronously.
 */
export async function warmHomeCache() {
  try {
    const keys = Object.values(CACHE_KEYS).map(k => CACHE_PREFIX + k);
    const pairs = await AsyncStorage.multiGet(keys);
    for (const [fullKey, value] of pairs) {
      if (value) {
        try {
          const parsed = JSON.parse(value);
          const key = fullKey.replace(CACHE_PREFIX, '');
          // Only load into memory if not expired
          if (parsed.ts && Date.now() - parsed.ts < CACHE_TTL_MS) {
            memoryCache[key] = parsed.data;
          }
        } catch (e) {
          // corrupt cache entry — ignore
        }
      }
    }
  } catch (e) {
    console.warn('Failed to warm home cache:', e);
  }
}

/**
 * Get cached data SYNCHRONOUSLY from memory.
 * Returns undefined if not cached or expired.
 */
export function getCached(key) {
  return memoryCache[key];
}

/**
 * Check if we have valid cached data for a key.
 */
export function hasCached(key) {
  return memoryCache[key] !== undefined;
}

/**
 * Save data to both memory cache and AsyncStorage (fire-and-forget).
 */
export function setCache(key, data) {
  memoryCache[key] = data;
  // Persist to disk in background — don't await
  AsyncStorage.setItem(
    CACHE_PREFIX + key,
    JSON.stringify({ data, ts: Date.now() })
  ).catch(() => {});
}

/**
 * Clear all home cache (e.g., on logout).
 */
export async function clearHomeCache() {
  const keys = Object.values(CACHE_KEYS).map(k => CACHE_PREFIX + k);
  Object.keys(memoryCache).forEach(k => delete memoryCache[k]);
  try {
    await AsyncStorage.multiRemove(keys);
  } catch (e) {
    // ignore
  }
}
