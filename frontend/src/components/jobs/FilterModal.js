import React from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, TextInput, StyleSheet } from 'react-native';

const FilterModal = ({ visible, onClose, filters, onFiltersChange, onApply, onClear, jobTypes = [], workplaceTypes = [], currencies = [] }) => {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}><Text style={styles.link}>Close</Text></TouchableOpacity>
          <Text style={styles.title}>Filters</Text>
          <TouchableOpacity onPress={onClear}><Text style={styles.link}>Reset</Text></TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Text style={styles.label}>Location</Text>
          <TextInput style={styles.input} placeholder="City, State or Country" value={filters.location}
            onChangeText={(t) => onFiltersChange({ ...filters, location: t })}
          />

          <Text style={styles.label}>Job Type</Text>
          <View style={styles.pills}>
            {jobTypes.map(jt => {
              const active = (filters.jobTypeIds || []).map(String).includes(String(jt.JobTypeID));
              return (
                <TouchableOpacity key={jt.JobTypeID} style={[styles.pill, active && styles.pillActive]}
                  onPress={() => {
                    const has = (filters.jobTypeIds || []).some(x => String(x) === String(jt.JobTypeID));
                    const next = has ? (filters.jobTypeIds || []).filter(x => String(x) !== String(jt.JobTypeID)) : [ ...(filters.jobTypeIds || []), jt.JobTypeID ];
                    onFiltersChange({ ...filters, jobTypeIds: next });
                  }}
                >
                  <Text style={[styles.pillText, active && styles.pillTextActive]}>{jt.Type}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.label}>Workplace</Text>
          <View style={styles.pills}>
            {workplaceTypes.map(wt => {
              const active = (filters.workplaceTypeIds || []).map(String).includes(String(wt.WorkplaceTypeID));
              return (
                <TouchableOpacity key={wt.WorkplaceTypeID} style={[styles.pill, active && styles.pillActive]}
                  onPress={() => {
                    const has = (filters.workplaceTypeIds || []).some(x => String(x) === String(wt.WorkplaceTypeID));
                    const next = has ? (filters.workplaceTypeIds || []).filter(x => String(x) !== String(wt.WorkplaceTypeID)) : [ ...(filters.workplaceTypeIds || []), wt.WorkplaceTypeID ];
                    onFiltersChange({ ...filters, workplaceTypeIds: next });
                  }}
                >
                  <Text style={[styles.pillText, active && styles.pillTextActive]}>{wt.Type}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.label}>Department</Text>
          <TextInput style={styles.input} placeholder="e.g., Engineering, Product" value={filters.department || ''}
            onChangeText={(t) => onFiltersChange({ ...filters, department: t })}
          />

          <TouchableOpacity style={styles.apply} onPress={onApply}><Text style={styles.applyText}>Apply Filters</Text></TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  title: { fontSize: 16, fontWeight: '700', color: '#111' },
  link: { color: '#0066cc', fontWeight: '600' },
  label: { marginTop: 16, marginBottom: 8, color: '#333', fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#f9fafb' },
  pills: { flexDirection: 'row', flexWrap: 'wrap' },
  pill: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8, marginBottom: 8, backgroundColor: '#f8fafc' },
  pillActive: { backgroundColor: '#e3f2fd', borderColor: '#0066cc' },
  pillText: { color: '#555', fontSize: 13 },
  pillTextActive: { color: '#0066cc', fontWeight: '700' },
  apply: { marginTop: 20, backgroundColor: '#0066cc', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  applyText: { color: '#fff', fontWeight: '700' }
});

export default FilterModal;
