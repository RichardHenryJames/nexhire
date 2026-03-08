import { useRef, useEffect } from 'react';
import { Platform } from 'react-native';

/**
 * useWebInfiniteScroll — IntersectionObserver-based infinite scroll for web.
 *
 * On mobile web, React Navigation's stack card uses page-overflow mode where a
 * nested DOM element scrolls instead of window/document.body. ScrollView's
 * onScroll and FlatList's onEndReached never fire in that mode.
 *
 * This hook observes a sentinel element (placed at the bottom of the list) via
 * IntersectionObserver. When the sentinel scrolls into view, loadMore() fires.
 * Works regardless of which DOM element is the actual scroll container.
 *
 * Usage:
 *   const sentinelRef = useWebInfiniteScroll({ loading, loadingMore, hasMore, loadMore });
 *   // In render:
 *   {Platform.OS === 'web' && hasMore && <View ref={sentinelRef} style={{ height: 1 }} />}
 *
 * @param {Object} opts
 * @param {boolean} opts.loading      - Initial loading state
 * @param {boolean} opts.loadingMore  - Currently loading next page
 * @param {boolean} opts.hasMore      - Backend has more pages
 * @param {Function} opts.loadMore    - Function to call to fetch next page
 * @param {boolean} [opts.enabled=true] - Toggle on/off (e.g. only for stack screens)
 * @returns {React.RefObject} sentinelRef - Attach to a View at the bottom of the list
 */
export default function useWebInfiniteScroll({ loading, loadingMore, hasMore, loadMore, enabled = true }) {
  const sentinelRef = useRef(null);
  const loadMoreRef = useRef(loadMore);
  const loadingRefLocal = useRef(loading);
  const loadingMoreRefLocal = useRef(loadingMore);
  const hasMoreRef = useRef(hasMore);

  useEffect(() => { loadMoreRef.current = loadMore; }, [loadMore]);
  useEffect(() => { loadingRefLocal.current = loading; }, [loading]);
  useEffect(() => { loadingMoreRefLocal.current = loadingMore; }, [loadingMore]);
  useEffect(() => { hasMoreRef.current = hasMore; }, [hasMore]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!enabled) return;

    let observer = null;
    let retryTimer = null;

    const setup = () => {
      const el = sentinelRef.current;
      if (!el) {
        retryTimer = setTimeout(setup, 500);
        return;
      }
      const node = el._nativeTag || el;

      observer = new IntersectionObserver((entries) => {
        const entry = entries[0];
        if (!entry || !entry.isIntersecting) return;
        if (loadingRefLocal.current || loadingMoreRefLocal.current) return;
        if (!hasMoreRef.current) return;
        loadMoreRef.current();
      }, { threshold: 0, rootMargin: '400px' });

      observer.observe(node);
    };

    setup();

    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      if (observer) observer.disconnect();
    };
  }, [enabled]);

  return sentinelRef;
}
