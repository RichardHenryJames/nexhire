import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, TextInput, StyleSheet, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';

const FilterModal = ({ 
  visible, 
  onClose, 
  filters, 
  onFiltersChange, 
  onApply, 
  onClear, 
  jobTypes = [], 
  workplaceTypes = [], 
  currencies = [],
  companies = [],
  loadingCompanies = false,
  initialSection = null
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const [selectedCategory, setSelectedCategory] = useState('workMode');
  const [companySearchQuery, setCompanySearchQuery] = useState('');
  const [displayLimit, setDisplayLimit] = useState(100); // Show first 100 companies initially

  // Auto-select category when modal opens with initialSection
  useEffect(() => {
    if (visible && initialSection) {
      setSelectedCategory(initialSection);
    }
  }, [visible, initialSection]);

const isSectionActive = (section) => {
   switch (section) {
     case 'workMode':
       return (filters.workplaceTypeIds || []).length > 0;
     case 'department':
       return !!filters.department;
  case 'location':
   return !!filters.location;
     case 'company':
       return (filters.organizationIds || []).length > 0;
     case 'experience':
   return !!filters.experienceMin || !!filters.experienceMax;
     case 'salary':
       return !!filters.salaryMin || !!filters.salaryMax;
     case 'postedBy':
       return !!filters.postedWithinDays;
     case 'jobType':
       return (filters.jobTypeIds || []).length > 0;
     case 'jobSource':
       return filters.postedByType !== undefined && filters.postedByType !== null;
default:
   return false;
   }
 };

  const activeFiltersCount = () => {
    let count = 0;
    if ((filters.workplaceTypeIds || []).length > 0) count += filters.workplaceTypeIds.length;
    if ((filters.jobTypeIds || []).length > 0) count += filters.jobTypeIds.length;
    if ((filters.organizationIds || []).length > 0) count += filters.organizationIds.length;
    if (filters.location) count++;
    if (filters.department) count++;
    if (filters.experienceMin || filters.experienceMax) count++;
    if (filters.salaryMin || filters.salaryMax) count++;
    if (filters.postedWithinDays) count++;
    if (filters.postedByType !== undefined && filters.postedByType !== null) count++;
    return count;
  };

  const categories = [
    { id: 'workMode', label: 'Workplace' },
    { id: 'department', label: 'Department' },
    { id: 'location', label: 'Location' },
    { id: 'company', label: 'Company' },
    { id: 'experience', label: 'Experience' },
    { id: 'salary', label: 'Salary' },
    { id: 'jobType', label: 'JobType' },
    { id: 'postedBy', label: 'Freshness' }
  ];

  const renderRightContent = () => {
    switch (selectedCategory) {
      case 'workMode':
        return (
          <View style={styles.rightContent}>
            <Text style={styles.rightTitle}>Workplace</Text>
          {workplaceTypes.map(wt => {
    const active = (filters.workplaceTypeIds || []).map(String).includes(String(wt.WorkplaceTypeID));
           return (
              <TouchableOpacity
            key={wt.WorkplaceTypeID}
         style={styles.optionItem}
   onPress={() => {
        const has = (filters.workplaceTypeIds || []).some(x => String(x) === String(wt.WorkplaceTypeID));
    const next = has
            ? (filters.workplaceTypeIds || []).filter(x => String(x) !== String(wt.WorkplaceTypeID))
       : [...(filters.workplaceTypeIds || []), wt.WorkplaceTypeID];
      onFiltersChange({ ...filters, workplaceTypeIds: next });
        }}
     >
          <View style={[styles.checkbox, active && styles.checkboxActive]}>
  {active && <Ionicons name="checkmark" size={16} color="#0066cc" />}
                  </View>
       <Text style={styles.optionLabel}>{wt.Type}</Text>
        </TouchableOpacity>
              );
    })}
          </View>
        );

  case 'department':
        return (
          <View style={styles.rightContent}>
     <Text style={styles.rightTitle}>Department</Text>
            <TextInput
    style={styles.searchInput}
  placeholder="Search department..."
     value={filters.department || ''}
      onChangeText={(t) => onFiltersChange({ ...filters, department: t })}
              placeholderTextColor="#9ca3af"
            />
        </View>
        );

  case 'location':
        return (
       <View style={styles.rightContent}>
            <Text style={styles.rightTitle}>Location</Text>
            <TextInput
  style={styles.searchInput}
         placeholder="City, State or Country"
              value={filters.location || ''}
         onChangeText={(t) => onFiltersChange({ ...filters, location: t })}
 placeholderTextColor="#9ca3af"
  />
     </View>
        );

      case 'company':
              const filteredCompanies = companies.filter(org => {
          const matches = companySearchQuery.trim() === '' || 
            org.name.toLowerCase().includes(companySearchQuery.toLowerCase());
          return matches;
        });
        // For search results, show all matches. Otherwise, paginate
        const displayCompanies = companySearchQuery.trim() !== '' 
          ? filteredCompanies 
          : filteredCompanies.slice(0, displayLimit);
        
        return (
          <View style={styles.rightContent}>
            <Text style={styles.rightTitle}>Company</Text>
            {loadingCompanies ? (
              <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color="#0066cc" />
                <Text style={styles.loaderText}>Loading companies...</Text>
              </View>
            ) : (
              <>
            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search companies..."
                value={companySearchQuery}
                onChangeText={setCompanySearchQuery}
                placeholderTextColor="#9ca3af"
              />
              {companySearchQuery.length > 0 ? (
                <TouchableOpacity onPress={() => setCompanySearchQuery('')} style={styles.searchIconContainer}>
                  <Ionicons name="close-circle" size={20} color="#9ca3af" />
                </TouchableOpacity>
              ) : (
                <View style={styles.searchIconContainer}>
                  <Ionicons name="search" size={20} color="#9ca3af" />
                </View>
              )}
            </View>
            <ScrollView 
              style={styles.optionsList} 
              nestedScrollEnabled={true}
              showsVerticalScrollIndicator={true}
            >
              {displayCompanies.map((org, index) => {
                  const active = (filters.organizationIds || []).includes(org.id);
                  return (
                    <TouchableOpacity
                      key={org.id || index}
                      style={styles.optionItem}
                      onPress={() => {
                        const has = (filters.organizationIds || []).includes(org.id);
                        const next = has
                          ? (filters.organizationIds || []).filter(id => id !== org.id)
                          : [...(filters.organizationIds || []), org.id];
                        onFiltersChange({ ...filters, organizationIds: next });
                      }}
                    >
                      <View style={[styles.checkbox, active && styles.checkboxActive]}>
                        {active && <Ionicons name="checkmark" size={16} color="#0066cc" />}
                      </View>
                      {org.logoURL ? (
                        <Image 
                          source={{ uri: org.logoURL }} 
                          style={styles.companyLogo}
                          resizeMode="contain"
                        />
                      ) : (
                        <View style={styles.companyLogoPlaceholder}>
                          <Ionicons name="business" size={16} color="#9ca3af" />
                        </View>
                      )}
                      <Text style={styles.optionLabel} numberOfLines={1}>{org.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              
              {/* Load More button if there are more companies to show */}
              {companySearchQuery.trim() === '' && displayLimit < filteredCompanies.length && (
                <TouchableOpacity 
                  style={styles.loadMoreButton}
                  onPress={() => setDisplayLimit(prev => prev + 100)}
                >
                  <Text style={styles.loadMoreText}>
                    Load More ({filteredCompanies.length - displayLimit} more companies)
                  </Text>
                  <Ionicons name="chevron-down" size={16} color="#0066cc" />
                </TouchableOpacity>
              )}
            </ScrollView>
              </>
            )}
          </View>
        );

  case 'experience':
        return (
  <View style={styles.rightContent}>
            <Text style={styles.rightTitle}>Experience</Text>
      <View style={styles.rangeContainer}>
        <View style={styles.rangeInput}>
     <Text style={styles.rangeLabel}>Min (years)</Text>
  <TextInput
            style={styles.rangeTextInput}
       placeholder="0"
      value={filters.experienceMin?.toString() || ''}
      onChangeText={(t) => onFiltersChange({ ...filters, experienceMin: t ? parseInt(t) : '' })}
      keyboardType="numeric"
      placeholderTextColor="#9ca3af"
       />
      </View>
         <Text style={styles.rangeSeparator}>-</Text>
       <View style={styles.rangeInput}>
     <Text style={styles.rangeLabel}>Max (years)</Text>
         <TextInput
        style={styles.rangeTextInput}
           placeholder="10+"
   value={filters.experienceMax?.toString() || ''}
         onChangeText={(t) => onFiltersChange({ ...filters, experienceMax: t ? parseInt(t) : '' })}
            keyboardType="numeric"
        placeholderTextColor="#9ca3af"
                />
  </View>
            </View>
   </View>
        );

      case 'salary':
        return (
        <View style={styles.rightContent}>
   <Text style={styles.rightTitle}>Salary</Text>
       <View style={styles.rangeContainer}>
     <View style={styles.rangeInput}>
      <Text style={styles.rangeLabel}>Min</Text>
      <TextInput
         style={styles.rangeTextInput}
placeholder="0"
        value={filters.salaryMin?.toString() || ''}
   onChangeText={(t) => onFiltersChange({ ...filters, salaryMin: t ? parseInt(t) : '' })}
       keyboardType="numeric"
     placeholderTextColor="#9ca3af"
  />
     </View>
  <Text style={styles.rangeSeparator}>-</Text>
      <View style={styles.rangeInput}>
 <Text style={styles.rangeLabel}>Max</Text>
    <TextInput
       style={styles.rangeTextInput}
       placeholder="100000+"
        value={filters.salaryMax?.toString() || ''}
          onChangeText={(t) => onFiltersChange({ ...filters, salaryMax: t ? parseInt(t) : '' })}
     keyboardType="numeric"
      placeholderTextColor="#9ca3af"
       />
    </View>
        </View>
            {currencies.length > 0 && (
         <View style={styles.currencyPills}>
       {currencies.map(curr => {
    const active = filters.currencyId === curr.CurrencyID;
     return (
    <TouchableOpacity
  key={curr.CurrencyID}
  style={[styles.currencyPill, active && styles.currencyPillActive]}
  onPress={() => onFiltersChange({ ...filters, currencyId: curr.CurrencyID })}
        >
    <Text style={[styles.currencyPillText, active && styles.currencyPillTextActive]}>
        {curr.Code}
     </Text>
             </TouchableOpacity>
         );
      })}
 </View>
 )}
          </View>
        );

      case 'jobType':
        return (
          <View style={styles.rightContent}>
    <Text style={styles.rightTitle}>JobType</Text>
            {jobTypes.map(jt => {
const active = (filters.jobTypeIds || []).map(String).includes(String(jt.JobTypeID));
          return (
       <TouchableOpacity
           key={jt.JobTypeID}
              style={styles.optionItem}
  onPress={() => {
    const has = (filters.jobTypeIds || []).some(x => String(x) === String(jt.JobTypeID));
         const next = has
           ? (filters.jobTypeIds || []).filter(x => String(x) !== String(jt.JobTypeID))
        : [...(filters.jobTypeIds || []), jt.JobTypeID];
        onFiltersChange({ ...filters, jobTypeIds: next });
       }}
          >
   <View style={[styles.checkbox, active && styles.checkboxActive]}>
            {active && <Ionicons name="checkmark" size={16} color="#0066cc" />}
       </View>
       <Text style={styles.optionLabel}>{jt.Type}</Text>
      </TouchableOpacity>
         );
   })}
       </View>
        );

      case 'postedBy':
     return (
          <View style={styles.rightContent}>
            <Text style={styles.rightTitle}>Freshness</Text>
            {[
  { label: 'Last 24 hours', value: 1 },
          { label: 'Last 3 days', value: 3 },
 { label: 'Last 7 days', value: 7 },
   { label: 'Last 14 days', value: 14 },
   { label: 'Last 30 days', value: 30 }
            ].map(item => {
        const active = filters.postedWithinDays === item.value;
     return (
           <TouchableOpacity
      key={item.value}
        style={styles.optionItem}
      onPress={() => onFiltersChange({ ...filters, postedWithinDays: active ? null : item.value })}
         >
          <View style={[styles.checkbox, active && styles.checkboxActive]}>
     {active && <Ionicons name="checkmark" size={16} color="#0066cc" />}
      </View>
 <Text style={styles.optionLabel}>{item.label}</Text>
           </TouchableOpacity>
              );
            })}
          </View>
        );

 default:
        return null;
    }
  };

  return (
    <Modal
      visible={visible}
    animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Filter Jobs</Text>
          {activeFiltersCount() > 0 && (
            <TouchableOpacity onPress={onClear} style={styles.clearAll}>
      <Text style={styles.clearAllText}>Clear All</Text>
   </TouchableOpacity>
  )}
 </View>

        {/* Two Column Layout */}
        <View style={styles.twoColumnContainer}>
          {/* Left Column - Categories */}
          <View style={styles.leftColumn}>
    <ScrollView showsVerticalScrollIndicator={false}>
              {categories.map(cat => {
      const isActive = selectedCategory === cat.id;
 const hasFilters = isSectionActive(cat.id);
     return (
       <TouchableOpacity
        key={cat.id}
     style={[styles.categoryItem, isActive && styles.categoryItemActive]}
          onPress={() => setSelectedCategory(cat.id)}
      >
            <Text style={[styles.categoryLabel, isActive && styles.categoryLabelActive]}>
        {cat.label}
      </Text>
        {hasFilters && <View style={styles.activeDot} />}
  </TouchableOpacity>
    );
    })}
      </ScrollView>
  </View>

          {/* Right Column - Filter Options */}
          <View style={styles.rightColumn}>
     {selectedCategory === 'company' ? (
       renderRightContent()
     ) : (
       <ScrollView showsVerticalScrollIndicator={false}>
         {renderRightContent()}
       </ScrollView>
     )}
      </View>
        </View>

     {/* Footer */}
        <View style={styles.footer}>
     <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.applyButton} onPress={onApply}>
<Text style={styles.applyButtonText}>Apply</Text>
          </TouchableOpacity>
        </View>
    </View>
    </Modal>
  );
};

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text
  },
  clearAll: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: colors.error + '15'
  },
  clearAllText: {
    color: colors.error,
    fontSize: 14,
    fontWeight: '600'
  },
  twoColumnContainer: {
    flex: 1,
    flexDirection: 'row'
  },
  leftColumn: {
    width: '30%',
    borderRightWidth: 1,
    borderRightColor: colors.border,
    backgroundColor: colors.gray50
  },
  categoryItem: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  categoryItemActive: {
    borderLeftColor: colors.primary,
    backgroundColor: colors.surface
  },
  categoryLabel: {
    fontSize: 15,
    color: colors.textMuted,
    fontWeight: '500'
  },
  categoryLabelActive: {
    color: colors.text,
    fontWeight: '600'
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary
  },
  rightColumn: {
    flex: 1,
    backgroundColor: colors.surface
  },
  rightContent: {
    flex: 1,
    padding: 20
  },
  rightTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16
  },
  optionsList: {
    flex: 1,
    minHeight: 300,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.gray300,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface
  },
  checkboxActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight
  },
  optionLabel: {
    flex: 1,
    fontSize: 15,
    color: colors.textSecondary
  },
  optionCount: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600'
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    fontSize: 15,
    color: colors.text,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray50,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  searchIconContainer: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchInputWithIcon: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
  },
  clearSearchButton: {
    padding: 4,
  },
  rangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  rangeInput: {
    flex: 1
  },
  rangeLabel: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 6
  },
  rangeTextInput: {
    backgroundColor: colors.gray50,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border
  },
  rangeSeparator: {
    color: colors.textMuted,
    fontSize: 18,
    marginTop: 20
  },
  currencyPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16
  },
  currencyPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.gray300,
    backgroundColor: colors.surface
  },
  currencyPillActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight
  },
  currencyPillText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600'
  },
  currencyPillTextActive: {
    color: colors.primary
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.surface
  },
  cancelButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '700'
  },
  applyButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: colors.primary
  },
  applyButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700'
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  chipText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  companyLogo: {
    width: 32,
    height: 32,
    borderRadius: 6,
    marginRight: 12,
    backgroundColor: colors.gray50,
  },
  companyLogoPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 6,
    marginRight: 12,
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: colors.gray50,
    borderRadius: 8,
    marginTop: 8,
    marginHorizontal: 8,
    gap: 8,
  },
  loadMoreText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loaderText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textMuted,
  },
});

export default FilterModal;
