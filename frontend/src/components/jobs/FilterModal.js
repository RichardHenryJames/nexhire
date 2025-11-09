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
  const [expandedSection, setExpandedSection] = useState('workMode'); // Track which section is expanded

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  // Helper to check if any values in a section are selected
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

  // Count total active filters
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

  const FilterSection = ({ title, section, count, children }) => {
    const isExpanded = expandedSection === section;
    const isActive = isSectionActive(section);

    return (
      <View style={styles.filterSection}>
        <TouchableOpacity 
          style={styles.sectionHeader}
    onPress={() => toggleSection(section)}
     >
 <Text style={[styles.sectionTitle, isActive && styles.sectionTitleActive]}>
{title}
 </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
 {count !== undefined && count > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{count}</Text>
     </View>
            )}
  <Ionicons 
           name={isExpanded ? "chevron-up" : "chevron-down"} 
            size={20} 
       color={isActive ? "#0066cc" : "#9ca3af"} 
          />
          </View>
        </TouchableOpacity>
        
        {isExpanded && (
          <View style={styles.sectionContent}>
    {children}
          </View>
        )}
    </View>
  );
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
      <View style={styles.headerRight}>
  {activeFiltersCount() > 0 && (
        <TouchableOpacity onPress={onClear} style={styles.clearAll}>
     <Text style={styles.clearAllText}>Clear All</Text>
      </TouchableOpacity>
            )}
        </View>
    </View>

        {/* Scrollable Filter Sections */}
        <ScrollView 
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
        >
        {/* Work Mode */}
          <FilterSection 
    title="Work mode" 
    section="workMode"
       count={(filters.workplaceTypeIds || []).length}
     >
            <View style={styles.checkboxList}>
              {workplaceTypes.map(wt => {
   const active = (filters.workplaceTypeIds || []).map(String).includes(String(wt.WorkplaceTypeID));
    return (
      <TouchableOpacity 
       key={wt.WorkplaceTypeID}
        style={styles.checkboxItem}
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
        <Text style={styles.checkboxLabel}>{wt.Type}</Text>
  <Text style={styles.checkboxCount}>1217</Text>
      </TouchableOpacity>
         );
   })}
  </View>
          </FilterSection>

     {/* Department */}
          <FilterSection title="Department" section="department">
       <TextInput 
     style={styles.searchInput}
              placeholder="Search department..."
    value={filters.department || ''}
              onChangeText={(t) => onFiltersChange({ ...filters, department: t })}
     placeholderTextColor="#9ca3af"
            />
    </FilterSection>

          {/* Location */}
          <FilterSection title="Location" section="location">
      <TextInput 
              style={styles.searchInput}
            placeholder="City, State or Country"
           value={filters.location || ''}
     onChangeText={(t) => onFiltersChange({ ...filters, location: t })}
  placeholderTextColor="#9ca3af"
      />
     </FilterSection>

          {/* Experience */}
          <FilterSection title="Experience" section="experience">
  <View style={styles.rangeInputContainer}>
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
          </FilterSection>

        {/* Salary */}
   <FilterSection title="Salary" section="salary">
  <View style={styles.rangeInputContainer}>
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
                {currencies.slice(0, 4).map(curr => {
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
          </FilterSection>

        {/* Job Type (Role) */}
          <FilterSection 
            title="Role" 
     section="jobType"
   count={(filters.jobTypeIds || []).length}
          >
            <View style={styles.checkboxList}>
        {jobTypes.map(jt => {
           const active = (filters.jobTypeIds || []).map(String).includes(String(jt.JobTypeID));
             return (
            <TouchableOpacity 
  key={jt.JobTypeID}
          style={styles.checkboxItem}
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
   <Text style={styles.checkboxLabel}>{jt.Type}</Text>
        </TouchableOpacity>
         );
       })}
            </View>
   </FilterSection>

          {/* Freshness (Posted by) */}
          <FilterSection title="Freshness" section="postedBy">
            <View style={styles.checkboxList}>
      {{
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
      style={styles.checkboxItem}
           onPress={() => {
         onFiltersChange({ 
    ...filters, 
               postedWithinDays: active ? null : item.value 
        });
    }}
   >
                    <View style={[styles.checkbox, active && styles.checkboxActive]}>
          {active && <Ionicons name="checkmark" size={16} color="#0066cc" />}
          </View>
             <Text style={styles.checkboxLabel}>{item.label}</Text>
   </TouchableOpacity>
    );
     })}
  </View>
   </FilterSection>

  {/* Spacer for bottom buttons */}
          <View style={{ height: 100 }} />
    </ScrollView>

        {/* Footer Buttons */}
    <View style={styles.footer}>
          <TouchableOpacity 
            style={styles.cancelButton}
     onPress={onClose}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
 <TouchableOpacity 
    style={styles.applyButton}
     onPress={onApply}
       >
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
    backgroundColor: '#ffffff' // Changed from #000000 to white
  },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
borderBottomWidth: 1, 
    borderBottomColor: '#e5e7eb' // Changed from #1f1f1f to light gray
  },
  headerTitle: { 
    fontSize: 22, 
    fontWeight: '700', 
    color: '#111827' // Changed from #ffffff to dark gray
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  clearAll: {
 paddingHorizontal: 12,
    paddingVertical: 6,
borderRadius: 6,
    backgroundColor: '#fef2f2' // Light red background
  },
  clearAllText: {
    color: '#dc2626', // Red text
    fontSize: 14,
    fontWeight: '600'
  },
  scrollView: {
    flex: 1
  },
  filterSection: {
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6' // Light gray border
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#ffffff' // White background
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280' // Gray text
  },
  sectionTitleActive: {
    color: '#111827' // Dark text when active
  },
  countBadge: {
    backgroundColor: '#3b82f6', // Blue badge
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 8,
    minWidth: 24,
    alignItems: 'center'
  },
  countText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700'
  },
  sectionContent: {
 paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#f9fafb' // Light gray background
  },
  checkboxList: {
    gap: 12
  },
  checkboxItem: {
 flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
 borderColor: '#d1d5db', // Light gray border
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff' // White background
  },
  checkboxActive: {
    borderColor: '#3b82f6', // Blue border
    backgroundColor: '#eff6ff' // Very light blue background
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 15,
    color: '#374151' // Dark gray text
  },
  checkboxCount: {
    fontSize: 13,
    color: '#9ca3af', // Gray text
    fontWeight: '600'
  },
  searchInput: {
    backgroundColor: '#ffffff', // White background
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827', // Dark text
  borderWidth: 1,
    borderColor: '#d1d5db' // Light gray border
  },
  rangeInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  rangeInput: {
    flex: 1
  },
  rangeLabel: {
    fontSize: 13,
    color: '#6b7280', // Gray text
    marginBottom: 6
  },
  rangeTextInput: {
    backgroundColor: '#ffffff', // White background
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827', // Dark text
borderWidth: 1,
    borderColor: '#d1d5db' // Light gray border
  },
  rangeSeparator: {
    color: '#9ca3af', // Gray text
    fontSize: 18,
    marginTop: 20
  },
  currencyPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12
  },
  currencyPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d1d5db', // Light gray border
    backgroundColor: '#ffffff' // White background
  },
  currencyPillActive: {
    borderColor: '#3b82f6', // Blue border
    backgroundColor: '#eff6ff' // Light blue background
  },
  currencyPillText: {
    color: '#6b7280', // Gray text
    fontSize: 14,
    fontWeight: '600'
  },
  currencyPillTextActive: {
    color: '#3b82f6' // Blue text
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb', // Light gray border
    backgroundColor: '#ffffff' // White background
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#3b82f6', // Blue border
    backgroundColor: '#ffffff' // White background
  },
  cancelButtonText: {
    color: '#3b82f6', // Blue text
    fontSize: 16,
    fontWeight: '700'
  },
  applyButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#3b82f6' // Blue background
  },
  applyButtonText: {
    color: '#ffffff', // White text
    fontSize: 16,
  fontWeight: '700'
  }
});

export default FilterModal;
