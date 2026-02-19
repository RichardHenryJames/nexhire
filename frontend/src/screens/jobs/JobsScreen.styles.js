import { StyleSheet, Platform } from 'react-native';

export const createStyles = (colors, responsive = {}) => {
  const { isMobile = true, isDesktop = false, isTablet = false, gridColumns = 1 } = responsive;
  
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray100,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginRight: 12,
    minHeight: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    paddingVertical: 8,
  },
  clearButton: {
    padding: 4,
  },
  filterButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: colors.gray100,
  },
  
  // Quick Filters Styles
  quickFiltersContainer: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 8,
  },
  quickFiltersScroll: {
    paddingHorizontal: 16,
  },
  quickFilterItem: {
    marginRight: 16,
    alignItems: 'center',
  },
  quickFilterLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
    fontWeight: '500',
  },
  quickFilterDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray100,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 70,
  },
  quickFilterActive: {
    backgroundColor: colors.primaryLight + '30',
    borderColor: colors.primary,
  },
  quickFilterText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginRight: 4,
    fontWeight: '500',
  },
  quickFilterActiveText: {
    color: colors.primary,
    fontWeight: '600',
  },
  clearAllButton: {
    backgroundColor: colors.warning + '20',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.warning,
    alignSelf: 'center',
    marginHorizontal: 8,
  },
  clearAllText: {
    fontSize: 13,
    color: colors.warning,
    fontWeight: '500',
  },

  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  summaryText: {
    fontSize: 14,
    color: colors.textSecondary,
    flex: 1,
  },
  smartContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  smartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight + '30',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginLeft: 8,
  },
  smartButtonActive: {
    backgroundColor: colors.primary,
  },
  smartButtonText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
    marginLeft: 4,
  },
  smartButtonTextActive: {
    color: colors.white,
  },
  clearFiltersButtonInSummary: {
    backgroundColor: colors.gray100,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginLeft: 8,
  },
  clearFiltersTextInSummary: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  jobList: {
    flex: 1,
    paddingTop: 8,
  },
  jobListContent: {
    paddingBottom: 100,
    alignItems: isDesktop ? 'center' : 'stretch',
  },
  jobListResponsive: {
    width: '100%',
    maxWidth: isDesktop ? 1200 : '100%',
    paddingHorizontal: isMobile ? 4 : 16,
  },
  // Grid layout for desktop
  jobsGrid: {
    ...(Platform.OS === 'web' && !isMobile ? {
      display: 'grid',
      gridTemplateColumns: isTablet ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
      gap: 16,
    } : {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginHorizontal: -8,
    }),
  },
  jobCardWrapper: {
    marginBottom: isMobile ? 12 : 0,
    ...(Platform.OS !== 'web' && !isMobile ? {
      width: isTablet ? '50%' : '33.33%',
      paddingHorizontal: 8,
      marginBottom: 16,
    } : {}),
  },
  loadingContainer: {
    minHeight: 200,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 24,
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 8,
  },
  emptyContainer: {
    minHeight: 260,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  clearFiltersButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  clearFiltersText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },

  // Horizontal slider row for quick multi-select
  sliderRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.gray50,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 10,
    minWidth: 60,
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight + '30',
  },
  chipText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  chipTextActive: {
    color: colors.primary,
  },

  // Next-line container for the expanded quick filter
  sliderBar: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    paddingBottom: 6,
  },
  sectionHeader: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 6,
  },
  sectionHeaderText: {
    fontSize: 11,
    letterSpacing: 0.8,
    color: colors.textMuted,
    fontWeight: '700',
  },

  // Floating Action Buttons
  fabContainer: {
    position: 'absolute',
    right: 16,
    bottom: 100,
    alignItems: 'center',
    gap: 8,
  },
  fabContainerTop: {
    position: 'absolute',
    right: 16,
    top: 12,
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    zIndex: 10,
  },
  fab: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  fabSaved: {
    backgroundColor: colors.primary,
  },
  fabApplications: {
    backgroundColor: colors.primary,
  },
  fabReferralRequests: {
    backgroundColor: colors.primary,
  },
  fabBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  fabBadgeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
});
};

// For backward compatibility
export const styles = createStyles({
  primary: '#3B82F6',
  primaryLight: '#60A5FA',
  surface: '#FFFFFF',
  background: '#F9FAFB',
  text: '#1F2937',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  border: '#E5E7EB',
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  white: '#FFFFFF',
  warning: '#F59E0B',
  error: '#EF4444',
  shadow: '#000000',
});