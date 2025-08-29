import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Modal, TextInput, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import nexhireAPI from '../../services/api';
import { colors, typography } from '../../styles/theme';
import { useEditing } from './ProfileSection';

const useDebounce = (value, delay = 300) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const h = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(h);
  }, [value, delay]);
  return debounced;
};

const getId = (item) => item?.WorkExperienceID || item?.WorkExperienceId || item?.id || item?.ID;
const getCompanyText = (item) => item?.CompanyName || item?.OrganizationName || '';

const ExperienceItem = ({ item, onEdit, onDelete, editable }) => {
  const start = item.StartDate || item.startDate;
  const end = item.EndDate || item.endDate;
  const startStr = start ? new Date(start).toISOString().split('T')[0] : '';
  const endStr = end ? new Date(end).toISOString().split('T')[0] : 'Present';

  return (
    <View style={styles.itemContainer}>
      <View style={{ flex: 1 }}>
        <Text style={styles.itemTitle}>{item.JobTitle || item.jobTitle || 'Untitled role'}</Text>
        <Text style={styles.itemCompany}>{getCompanyText(item) || 'Company not set'}</Text>
        <Text style={styles.itemDates}>{startStr} - {endStr}</Text>
      </View>
      {editable && (
        <View style={styles.itemActions}>
          <TouchableOpacity onPress={() => onEdit(item)} style={styles.iconButton}>
            <Ionicons name="create-outline" size={18} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onDelete(item)} style={styles.iconButton}>
            <Ionicons name="trash-outline" size={18} color={colors.danger || '#FF3B30'} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

export default function WorkExperienceSection({ editing, showHeader = false }) {
  // Prefer editing state from ProfileSection when available
  const ctxEditing = useEditing();
  const isEditing = typeof editing === 'boolean' ? editing : ctxEditing;

  const [experiences, setExperiences] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState({ jobTitle: '', organizationId: null, companyName: '', startDate: '', endDate: '' });

  // Organization search state
  const [orgQuery, setOrgQuery] = useState('');
  const debouncedOrgQuery = useDebounce(orgQuery, 300);
  const [orgResults, setOrgResults] = useState([]);
  const [orgLoading, setOrgLoading] = useState(false);
  const [showOrgPicker, setShowOrgPicker] = useState(false);

  const applyOrgFilter = (list, q) => {
    if (!Array.isArray(list)) return [];
    if (!q || !q.trim()) return list;
    const s = q.toLowerCase();
    return list.filter(o =>
      (o.name && o.name.toLowerCase().includes(s)) ||
      (o.website && o.website.toLowerCase().includes(s)) ||
      (o.industry && o.industry.toLowerCase().includes(s))
    );
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await nexhireAPI.getMyWorkExperiences();
      if (res && res.success) {
        setExperiences(Array.isArray(res.data) ? res.data : []);
      } else {
        setExperiences([]);
      }
    } catch (e) {
      console.warn('Failed to load work experiences', e?.message);
      setExperiences([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Debounced org search effect with local filtering fallback
  useEffect(() => {
    const search = async () => {
      try {
        setOrgLoading(true);
        const res = await nexhireAPI.getOrganizations(debouncedOrgQuery || '');
        const raw = (res && res.success && Array.isArray(res.data)) ? res.data : [];
        setOrgResults(applyOrgFilter(raw, debouncedOrgQuery));
      } catch (e) {
        setOrgResults([]);
      } finally {
        setOrgLoading(false);
      }
    };
    if (showOrgPicker) search();
  }, [debouncedOrgQuery, showOrgPicker]);

  const openAdd = () => {
    setEditingItem(null);
    setForm({ jobTitle: '', organizationId: null, companyName: '', startDate: '', endDate: '' });
    setOrgQuery('');
    setOrgResults([]);
    setShowOrgPicker(false);
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setForm({
      jobTitle: item.JobTitle || item.jobTitle || '',
      organizationId: item.OrganizationID || item.organizationId || null,
      companyName: getCompanyText(item) || '',
      startDate: (item.StartDate || item.startDate) ? new Date(item.StartDate || item.startDate).toISOString().split('T')[0] : '',
      endDate: (item.EndDate || item.endDate) ? new Date(item.EndDate || item.endDate).toISOString().split('T')[0] : ''
    });
    setOrgQuery('');
    setOrgResults([]);
    setShowOrgPicker(false);
    setShowModal(true);
  };

  const handleDelete = async (item) => {
    const id = getId(item);
    if (!id) {
      Alert.alert('Error', 'Invalid experience id');
      return;
    }
    Alert.alert(
      'Delete Work Experience',
      'Are you sure you want to remove this experience?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
            try {
              const res = await nexhireAPI.deleteWorkExperience(id);
              if (!res?.success) throw new Error(res?.error || 'Delete failed');
              await loadData();
              Alert.alert('Deleted', 'Work experience removed');
            } catch (e) {
              Alert.alert('Error', e?.message || 'Failed to delete');
            }
          } 
        }
      ]
    );
  };

  const pickOrg = (org) => {
    if (org.id === 999999) {
      setForm((prev) => ({ ...prev, organizationId: null }));
    } else {
      setForm((prev) => ({ ...prev, organizationId: org.id, companyName: org.name }));
    }
    setShowOrgPicker(false);
  };

  const saveForm = async () => {
    if (!form.jobTitle?.trim() || !form.startDate?.trim()) {
      Alert.alert('Validation', 'Job title and start date are required');
      return;
    }
    try {
      const payload = {
        jobTitle: form.jobTitle.trim(),
        companyName: form.companyName?.trim() || null,
        organizationId: form.organizationId || null,
        startDate: form.startDate,
        endDate: form.endDate || null,
      };
      if (editingItem) {
        const id = getId(editingItem);
        if (!id) throw new Error('Invalid experience id');
        const res = await nexhireAPI.updateWorkExperienceById(id, payload);
        if (!res?.success) throw new Error(res?.error || 'Update failed');
      } else {
        const res = await nexhireAPI.createWorkExperience(payload);
        if (!res?.success) throw new Error(res?.error || 'Create failed');
      }
      setShowModal(false);
      await loadData();
      Alert.alert('Success', `Work experience ${editingItem ? 'updated' : 'added'} successfully`);
    } catch (e) {
      Alert.alert('Error', e?.message || 'Failed to save work experience');
    }
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>No work experiences added yet</Text>
      {isEditing && (
        <TouchableOpacity style={styles.addButton} onPress={openAdd}>
          <Ionicons name="add" size={16} color={colors.white} />
          <Text style={styles.addButtonText}>Add Work Experience</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={[styles.sectionContainer, showHeader && { marginBottom: 24 }]}>
      {/* Inline Add button when editing */}
      {isEditing && (
        <View style={styles.inlineHeader}>
          <TouchableOpacity style={styles.inlineAddButton} onPress={openAdd}>
            <Ionicons name="add" size={16} color={colors.primary} />
            <Text style={styles.inlineAddText}>Add Work Experience</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={experiences}
        keyExtractor={(item) => String(getId(item))}
        renderItem={({ item }) => (
          <ExperienceItem
            item={item}
            editable={isEditing}
            onEdit={openEdit}
            onDelete={handleDelete}
          />
        )}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={experiences.length === 0 ? { flexGrow: 1 } : null}
      />

      {/* Add/Edit Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{editingItem ? 'Edit Work Experience' : 'Add Work Experience'}</Text>
            <TouchableOpacity onPress={saveForm}>
              <Text style={styles.saveButton}>Save</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.formContainer}>
            <Text style={styles.label}>Job Title *</Text>
            <TextInput
              style={styles.input}
              value={form.jobTitle}
              onChangeText={(t) => setForm({ ...form, jobTitle: t })}
              placeholder="e.g., Software Engineer"
              autoCapitalize="words"
            />

            <Text style={styles.label}>Company</Text>
            <TouchableOpacity
              style={styles.orgPicker}
              onPress={() => {
                setShowOrgPicker(true);
                if (orgResults.length === 0) setOrgQuery('');
              }}
            >
              <Text style={styles.orgPickerText}>
                {form.companyName ? `${form.companyName}${form.organizationId ? '' : ' (manual)'}` : 'Select or search company'}
              </Text>
              <Ionicons name={showOrgPicker ? 'chevron-up' : 'chevron-down'} size={18} color={colors.gray600} />
            </TouchableOpacity>

            {showOrgPicker && (
              <View style={styles.orgPickerModal}>
                <View style={styles.orgSearchRow}>
                  <Ionicons name="search" size={16} color={colors.gray600} />
                  <TextInput
                    style={styles.orgSearchInput}
                    value={orgQuery}
                    onChangeText={setOrgQuery}
                    placeholder="Search organizations..."
                    autoCapitalize="words"
                  />
                  {orgLoading ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <TouchableOpacity onPress={() => setOrgQuery(orgQuery)}>
                      <Ionicons name="refresh" size={18} color={colors.primary} />
                    </TouchableOpacity>
                  )}
                </View>
                <FlatList
                  data={orgResults}
                  keyExtractor={(o) => String(o.id)}
                  style={styles.orgList}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => (
                    <TouchableOpacity style={styles.orgItem} onPress={() => pickOrg(item)}>
                      <Text style={styles.orgName}>{item.name}</Text>
                      {item.website ? <Text style={styles.orgMeta}>{item.website}</Text> : null}
                    </TouchableOpacity>
                  )}
                  ListFooterComponent={() => (
                    <TouchableOpacity
                      style={styles.manualEntry}
                      onPress={() => {
                        setForm((prev) => ({ ...prev, organizationId: null }));
                        setShowOrgPicker(false);
                      }}
                    >
                      <Ionicons name="create-outline" size={16} color={colors.primary} />
                      <Text style={styles.manualEntryText}>Enter company name manually</Text>
                    </TouchableOpacity>
                  )}
                />
              </View>
            )}

            <TextInput
              style={styles.input}
              value={form.companyName}
              onChangeText={(t) => setForm({ ...form, companyName: t })}
              placeholder="Company name (if not listed)"
              autoCapitalize="words"
            />

            <Text style={styles.label}>Start Date (YYYY-MM-DD) *</Text>
            <TextInput
              style={styles.input}
              value={form.startDate}
              onChangeText={(t) => setForm({ ...form, startDate: t })}
              placeholder="YYYY-MM-DD"
              keyboardType="numbers-and-punctuation"
              autoCapitalize="none"
            />

            <Text style={styles.label}>End Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              value={form.endDate}
              onChangeText={(t) => setForm({ ...form, endDate: t })}
              placeholder="Leave empty if current"
              keyboardType="numbers-and-punctuation"
              autoCapitalize="none"
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionContainer: {
    marginHorizontal: 4,
  },
  inlineHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  inlineAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.background,
  },
  inlineAddText: {
    color: colors.primary,
    fontSize: typography.sizes?.sm || 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: typography.sizes?.lg || 18,
    fontWeight: typography.weights?.bold || 'bold',
    color: colors.text,
  },
  headerAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  headerAddText: {
    color: colors.primary,
    marginLeft: 4,
    fontSize: typography.sizes?.sm || 14,
  },
  itemContainer: {
    flexDirection: 'row',
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
    marginBottom: 8,
  },
  itemTitle: {
    fontSize: typography.sizes?.md || 16,
    fontWeight: typography.weights?.medium || '500',
    color: colors.text,
  },
  itemCompany: {
    fontSize: typography.sizes?.sm || 14,
    color: colors.gray700 || '#374151',
    marginTop: 2,
  },
  itemDates: {
    fontSize: typography.sizes?.sm || 14,
    color: colors.gray500 || '#6B7280',
    marginTop: 2,
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  iconButton: {
    padding: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  emptyText: {
    color: colors.gray600,
    marginBottom: 8,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: colors.white,
    marginLeft: 6,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: typography.sizes?.lg || 18,
    fontWeight: typography.weights?.bold || 'bold',
    color: colors.text,
  },
  saveButton: {
    fontSize: typography.sizes?.md || 16,
    color: colors.primary,
    fontWeight: typography.weights?.medium || '500',
  },
  formContainer: {
    padding: 20,
  },
  label: {
    fontSize: typography.sizes?.sm || 14,
    color: colors.gray700 || '#374151',
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: typography.sizes?.md || 16,
    color: colors.text,
    marginBottom: 12,
  },
  orgPicker: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  orgPickerText: {
    color: colors.text,
    fontSize: typography.sizes?.md || 16,
  },
  orgPickerModal: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    marginBottom: 12,
    overflow: 'hidden',
  },
  orgSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.background,
    gap: 8,
  },
  orgSearchInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 8,
    fontSize: typography.sizes?.sm || 14,
  },
  orgList: {
    maxHeight: 220,
  },
  orgItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  orgName: {
    color: colors.text,
    fontSize: typography.sizes?.md || 16,
  },
  orgMeta: {
    color: colors.gray600,
    fontSize: typography.sizes?.sm || 14,
  },
  manualEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  manualEntryText: {
    color: colors.primary,
    fontSize: typography.sizes?.sm || 14,
  },
});
