/**
 * CachedImage — Drop-in replacement for React Native's <Image> with aggressive caching.
 *
 * Uses expo-image which provides:
 *   • Memory + disk caching (images load instantly after first view)
 *   • Placeholder support (blurhash, color, or shimmer)
 *   • Progressive loading
 *   • Animated transitions
 *
 * Usage:
 *   import CachedImage from '../components/CachedImage';
 *   <CachedImage source={{ uri: 'https://...' }} style={styles.avatar} />
 *
 * API is compatible with RN Image — just swap the import.
 * For local assets (require('./image.png')), you can still use RN Image
 * since they don't benefit from caching.
 */

import React from 'react';
import { Platform, Image as RNImage } from 'react-native';

// expo-image for native (disk+memory cache), RN Image for web (browser caches natively)
let ExpoImage;
if (Platform.OS !== 'web') {
  try { ExpoImage = require('expo-image').Image; } catch (e) { ExpoImage = null; }
}

// Default placeholder color while loading
const PLACEHOLDER_COLOR = '#E5E7EB';

const CachedImage = React.memo(({
  source,
  style,
  contentFit,
  resizeMode,
  placeholder,
  transition,
  cachePolicy,
  ...rest
}) => {
  // Normalize source: RN Image uses { uri } or require(), expo-image accepts both
  // Also handle string source (just a URI)
  let normalizedSource = source;
  if (typeof source === 'string') {
    normalizedSource = { uri: source };
  }

  // Map RN's resizeMode to expo-image's contentFit if not explicitly set
  const fit = contentFit || resizeMode || 'cover';

  // Web fallback: use regular RN Image (browser handles caching)
  if (Platform.OS === 'web' || !ExpoImage) {
    return (
      <RNImage
        source={normalizedSource}
        style={style}
        resizeMode={resizeMode || 'cover'}
        {...rest}
      />
    );
  }

  return (
    <ExpoImage
      source={normalizedSource}
      style={style}
      contentFit={fit}
      placeholder={placeholder || { color: PLACEHOLDER_COLOR }}
      transition={transition ?? 200}
      cachePolicy={cachePolicy || 'memory-disk'}
      recyclingKey={normalizedSource?.uri}
      {...rest}
    />
  );
});

CachedImage.displayName = 'CachedImage';

export default CachedImage;
