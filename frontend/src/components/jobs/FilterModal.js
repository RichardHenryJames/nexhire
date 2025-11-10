import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const FilterModal = ({ 
  visible, 
  onClose, 
  filters, 
  onFiltersChange, 
  onApply, 
  onClear, 
  jobTypes = [], 
  workplaceTypes = [], 
  currencies = [] 
}) => {
  const [selectedCategory, setSelectedCategory] = useState('workMode');

const isSectionActive = (section) => {
    switch (section) {
      case 'workMode':
        return (filters.workplaceTypeIds || []).length > 0;
      case 'department':
        return !!filters.department;
   case 'location':
    return !!filters.location;
      case 'experience':
    return !!filters.experienceMin || !!filters.experienceMax;
      case 'salary':
        return !!filters.salaryMin || !!filters.salaryMax;
      case 'postedBy':
        return !!filters.postedWithinDays;
      case 'jobType':
        return (filters.jobTypeIds || []).length > 0;
 default:
    return false;
    }
  };

  const activeFiltersCount = () => {
    let count = 0;
    if ((filters.workplaceTypeIds || []).length > 0) count += filters.workplaceTypeIds.length;
    if ((filters.jobTypeIds || []).length > 0) count += filters.jobTypeIds.length;
    if (filters.location) count++;
    if (filters.department) count++;
    if (filters.experienceMin || filters.experienceMax) count++;
    if (filters.salaryMin || filters.salaryMax) count++;
    if (filters.postedWithinDays) count++;
    return count;
  };

  const categories = [
    { id: 'workMode', label: 'Work mode' },
    { id: 'department', label: 'Department' },
    { id: 'location', label: 'Location' },
    { id: 'experience', label: 'Experience' },
    { id: 'salary', label: 'Salary' },
    { id: 'jobType', label: 'Role' },
    { id: 'postedBy', label: 'Freshness' }
  ];

  const renderRightContent = () => {
    switch (selectedCategory) {
      case 'workMode':
        return (
          <View style={styles.rightContent}>
            <Text style={styles.rightTitle}>Work mode</Text>
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
    <Text style={styles.rightTitle}>Role</Text>
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
     <ScrollView showsVerticalScrollIndicator={false}>
       {renderRightContent()}
            </ScrollView>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb'
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827'
  },
  clearAll: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#fef2f2'
  },
  clearAllText: {
    color: '#dc2626',
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
 borderRightColor: '#e5e7eb',
    backgroundColor: '#f9fafb'
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
    borderLeftColor: '#0066cc',
    backgroundColor: '#ffffff'
  },
  categoryLabel: {
    fontSize: 15,
    color: '#6b7280',
 fontWeight: '500'
  },
  categoryLabelActive: {
    color: '#111827',
    fontWeight: '600'
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0066cc'
  },
  rightColumn: {
 flex: 1,
    backgroundColor: '#ffffff'
  },
  rightContent: {
    padding: 20
  },
  rightTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6'
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#d1d5db',
    marginRight: 12,
alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff'
  },
  checkboxActive: {
    borderColor: '#0066cc',
    backgroundColor: '#e3f2fd'
  },
  optionLabel: {
    flex: 1,
    fontSize: 15,
    color: '#374151'
  },
  optionCount: {
    fontSize: 13,
    color: '#9ca3af',
    fontWeight: '600'
  },
  searchInput: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#e5e7eb'
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
    color: '#6b7280',
    marginBottom: 6
  },
  rangeTextInput: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  rangeSeparator: {
    color: '#9ca3af',
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
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff'
  },
  currencyPillActive: {
    borderColor: '#0066cc',
    backgroundColor: '#e3f2fd'
  },
  currencyPillText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '600'
  },
  currencyPillTextActive: {
    color: '#0066cc'
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#ffffff'
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#0066cc',
    backgroundColor: '#ffffff'
  },
  cancelButtonText: {
    color: '#0066cc',
    fontSize: 16,
    fontWeight: '700'
  },
  applyButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#0066cc'
  },
  applyButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700'
  }
});

export default FilterModal;
