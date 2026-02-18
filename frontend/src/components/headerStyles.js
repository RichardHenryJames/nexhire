/**
 * headerStyles — Shared style constants for TabHeader & SubScreenHeader
 *
 * Single source of truth for padding, sticky, zIndex, elevation, title font, etc.
 * Both header components import from here to stay in sync.
 */

import { Platform } from 'react-native';

export const HEADER_PADDING = {
  paddingHorizontal: 12,
  paddingTop: Platform.OS === 'ios' ? 44 : 12,
  paddingBottom: 12,
};

export const HEADER_ELEVATION = {
  zIndex: 10000,
  elevation: 10,
};

export const HEADER_STICKY = Platform.OS === 'web'
  ? { position: 'sticky', top: 0 }
  : {};

export const HEADER_TITLE = {
  fontSize: 18,
  fontWeight: '700',
};

export const HEADER_BACK_BUTTON = {
  width: 40,
  height: 40,
  borderRadius: 20,
  justifyContent: 'center',
  alignItems: 'center',
};

/**
 * Base container style — spread into each header's `container` StyleSheet entry.
 */
export const HEADER_CONTAINER_BASE = {
  ...HEADER_PADDING,
  ...HEADER_ELEVATION,
  ...HEADER_STICKY,
  gap: 8,
};
