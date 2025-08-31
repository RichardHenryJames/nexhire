import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
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
    color: '#333',
    paddingVertical: 8,
  },
  clearButton: {
    padding: 4,
  },
  filterButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
  },
  
  // Quick Filters Styles
  quickFiltersContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
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
    color: '#666',
    marginBottom: 4,
    textTransform: 'uppercase',
    fontWeight: '500',
  },
  quickFilterDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#e9ecef',
    minWidth: 70,
  },
  quickFilterActive: {
    backgroundColor: '#e3f2fd',
    borderColor: '#0066cc',
  },
  quickFilterText: {
    fontSize: 13,
    color: '#666',
    marginRight: 4,
    fontWeight: '500',
  },
  quickFilterActiveText: {
    color: '#0066cc',
    fontWeight: '600',
  },
  clearAllButton: {
    backgroundColor: '#fff3cd',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#ffc107',
    alignSelf: 'center',
    marginHorizontal: 8,
  },
  clearAllText: {
    fontSize: 13,
    color: '#856404',
    fontWeight: '500',
  },

  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  summaryText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  smartContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  smartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginLeft: 8,
  },
  smartButtonActive: {
    backgroundColor: '#0066cc',
  },
  smartButtonText: {
    fontSize: 12,
    color: '#0066cc',
    fontWeight: '600',
    marginLeft: 4,
  },
  smartButtonTextActive: {
    color: '#fff',
  },
  clearFiltersButtonInSummary: {
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginLeft: 8,
  },
  clearFiltersTextInSummary: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  jobList: {
    flex: 1,
    paddingTop: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  clearFiltersButton: {
    backgroundColor: '#0066cc',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  clearFiltersText: {
    color: '#fff',
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
    borderColor: '#e5e7eb',
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 10,
    minWidth: 60,
  },
  chipActive: {
    borderColor: '#0066cc',
    backgroundColor: '#e3f2fd',
  },
  chipText: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  chipTextActive: {
    color: '#0066cc',
  },

  // Next-line container for the expanded quick filter
  sliderBar: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
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
    color: '#6b7280',
    fontWeight: '700',
  },
});