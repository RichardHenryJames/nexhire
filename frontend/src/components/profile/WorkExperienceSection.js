import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Modal, TextInput, Alert, ActivityIndicator, Switch, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import refopenAPI from '../../services/api';
import { colors, typography } from '../../styles/theme';
import { useEditing } from './ProfileSection';
import DatePicker from '../DatePicker';

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
const toNumberOrNull = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isNaN(n) ? null : n;
};
const toIntOrNull = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const n = typeof v === 'number' ? v : parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
};
const normalizeString = (v) => {
  if (v === undefined || v === null) return null;
  if (Array.isArray(v)) {
    // Pick last non-empty string
    const last = [...v].reverse().find(x => typeof x === 'string' && x.trim().length > 0);
    return last ? last.trim() : null;
    }
  return typeof v === 'string' ? v.trim() : String(v);
};

// ? SMART WORK EXPERIENCE VALIDATION - Added validation functions
const shouldHideCurrentToggle = (startDate, existingWorkExperiences, excludeWorkExperienceId = null) => {
  if (!startDate) return false;
  
  // Find existing current work experience (excluding the one being edited)
  const currentExp = existingWorkExperiences.find(exp => {
    const expId = getId(exp);
    const isCurrent = exp.IsCurrent === 1 || exp.IsCurrent === true || (!exp.EndDate && !exp.endDate);
    return isCurrent && (!excludeWorkExperienceId || expId !== excludeWorkExperienceId);
  });
  
  if (!currentExp) return false;
  
  const newStartDate = new Date(startDate);
  const existingStartDate = new Date(currentExp.StartDate || currentExp.startDate);
  
  // Hide toggle if new start date is older than or equal to existing current
  return newStartDate <= existingStartDate;
};

const isEndDateRequired = (formData, existingWorkExperiences, excludeWorkExperienceId = null) => {
  // End date required if:
  // 1. Not marked as current, OR
  // 2. Currently Working toggle is hidden (older date)
  return !formData.isCurrent || shouldHideCurrentToggle(formData.startDate, existingWorkExperiences, excludeWorkExperienceId);
};

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
  const ctxEditing = useEditing();
  const isEditing = typeof editing === 'boolean' ? editing : ctxEditing;

  const [experiences, setExperiences] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [saving, setSaving] = useState(false);
  // validation state
  const [validationErrors, setValidationErrors] = useState({});

  // Extended form fields
  const [form, setForm] = useState({
    jobTitle: '',
    organizationId: null,
    companyName: '',
    department: '',
    employmentType: '',
    startDate: '',
    endDate: '',
    isCurrent: false,
    location: '',
    country: '',
    description: '',
    skills: '',
    achievements: '',
    reasonForLeaving: '',
    salary: '',
    currencyId: null,
    salaryFrequency: '',
    managerName: '',
    managerContact: '',
    canContact: false,
  });

  // Delete confirmation modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Organization search state
  const [orgQuery, setOrgQuery] = useState('');
  const debouncedOrgQuery = useDebounce(orgQuery, 300);
  const [orgResults, setOrgResults] = useState([]);
  const [orgLoading, setOrgLoading] = useState(false);
  const [showOrgPicker, setShowOrgPicker] = useState(false);
  const [manualOrgMode, setManualOrgMode] = useState(false);

  // Currencies
  const [currencies, setCurrencies] = useState([]);

  const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Contract', 'Freelance', 'Internship', 'Temporary'];
  const SALARY_FREQUENCIES = ['Annual', 'Monthly', 'Weekly', 'Daily', 'Hourly'];

  // ? SMART START DATE HANDLER - Auto-uncheck current if toggle should be hidden
  const handleStartDateChange = (date) => {
    const excludeId = editingItem ? getId(editingItem) : null;
    setForm(prev => ({
      ...prev,
      startDate: date,
      // Auto-uncheck "Currently Working" if it should be hidden
      isCurrent: shouldHideCurrentToggle(date, experiences, excludeId) ? false : prev.isCurrent
    }));
  };

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
      const [expRes, curRes] = await Promise.all([
        refopenAPI.getMyWorkExperiences(),
        refopenAPI.getCurrencies().catch(() => ({ success: false }))
      ]);
      if (expRes && expRes.success) {
        setExperiences(Array.isArray(expRes.data) ? expRes.data : []);
      } else {
        setExperiences([]);
      }
      if (curRes && curRes.success) {
        setCurrencies(curRes.data);
      } else {
        setCurrencies([]);
      }
    } catch (e) {
      console.warn('Failed to load work experiences', e?.message);
      setExperiences([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Set INR as default currency when currencies load and none selected
  useEffect(() => {
    if ((currencies || []).length > 0 && (form.currencyId === null || form.currencyId === undefined)) {
      const inr = currencies.find(c => c.Code === 'INR');
      if (inr) {
        setForm(prev => ({ ...prev, currencyId: inr.CurrencyID }));
      } else {
        setForm(prev => ({ ...prev, currencyId: currencies[0].CurrencyID }));
      }
    }
  }, [currencies]);

  // Debounced org search effect with local filtering fallback
  useEffect(() => {
    const search = async () => {
      try {
        setOrgLoading(true);
        const res = await refopenAPI.getOrganizations(debouncedOrgQuery || '', null); // No limit
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

  const resetForm = () => setForm({
    jobTitle: '', organizationId: null, companyName: '', department: '', employmentType: '', startDate: '', endDate: '', isCurrent: false, location: '', country: '', description: '', skills: '', achievements: '', reasonForLeaving: '', salary: '', currencyId: null, salaryFrequency: '', managerName: '', managerContact: '', canContact: false,
  });

  const openAdd = () => {
    setEditingItem(null);
    resetForm();
    setOrgQuery('');
    setOrgResults([]);
    setManualOrgMode(false);
    setShowOrgPicker(false);
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setForm({
      jobTitle: item.JobTitle || item.jobTitle || '',
      organizationId: item.OrganizationID || item.organizationId || null,
      companyName: getCompanyText(item) || '',
      department: item.Department || '',
      employmentType: item.EmploymentType || '',
      startDate: (item.StartDate || item.startDate) ? new Date(item.StartDate || item.startDate).toISOString().split('T')[0] : '',
      endDate: (item.EndDate || item.endDate) ? new Date(item.EndDate || item.endDate).toISOString().split('T')[0] : '',
      isCurrent: item.IsCurrent === 1 || item.IsCurrent === true || (!item.EndDate),
      location: item.Location || '',
      country: item.Country || '',
      description: item.Description || '',
      skills: item.Skills || '',
      achievements: item.Achievements || '',
      reasonForLeaving: item.ReasonForLeaving || '',
      salary: item.Salary?.toString?.() || '',
      currencyId: item.CurrencyID || null,
      salaryFrequency: item.SalaryFrequency || '',
      managerName: item.ManagerName || '',
      managerContact: item.ManagerContact || '',
      canContact: item.CanContact === 1 || item.CanContact === true,
    });
    setOrgQuery('');
    setOrgResults([]);
    setManualOrgMode(false);
    setShowOrgPicker(false);
    setShowModal(true);
  };

  const handleDeletePress = (item) => { setPendingDelete(item); setShowDeleteModal(true); };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const id = getId(pendingDelete);
    if (!id) { setShowDeleteModal(false); setPendingDelete(null); Alert.alert('Error', 'Invalid experience id'); return; }
    try {
      setDeleting(true);
      const res = await refopenAPI.deleteWorkExperience(id);
      if (!res?.success) throw new Error(res?.error || 'Delete failed');
      setShowDeleteModal(false); setPendingDelete(null);
      await loadData();
    } catch (e) {
      setShowDeleteModal(false); setPendingDelete(null);
      Alert.alert('Error', e?.message || 'Failed to delete');
    } finally { setDeleting(false); }
  };

  const pickOrg = (org) => {
    if (org.id === 999999) {
      setForm((prev) => ({ ...prev, organizationId: null }));
    } else {
      setForm((prev) => ({ ...prev, organizationId: org.id, companyName: org.name }));
    }
    setShowOrgPicker(false);
  };

  const coerceOrgId = (val) => {
    if (val === null || val === undefined) return null;
    if (typeof val === 'number') return Number.isNaN(val) ? null : val;
    const n = parseInt(val, 10);
    return Number.isNaN(n) ? null : n;
  };

  const saveForm = async () => {
    console.log('[WorkExp] Save pressed. Editing item:', editingItem && getId(editingItem));
    console.log('[WorkExp] Current form:', JSON.stringify(form));
    const errors = {};
    if (!form.jobTitle || !normalizeString(form.jobTitle)) {
      errors.jobTitle = 'Job title is required';
    }
    if (!form.startDate || !normalizeString(form.startDate)) {
      errors.startDate = 'Start date is required';
    }
    
    // ? SMART VALIDATION - Check if end date is required
    const excludeId = editingItem ? getId(editingItem) : null;
    if (isEndDateRequired(form, experiences, excludeId) && !form.endDate) {
      errors.endDate = 'End date required for non-current position';
    }
    
    setValidationErrors(errors);
    if (Object.keys(errors).length) {
      // Web Alert fallback (RN Web Alert sometimes silent)
      const firstMsg = errors.jobTitle || errors.startDate || errors.endDate;
      if (firstMsg) {
        try { Alert.alert('Validation', firstMsg); } catch(_) { /* noop */ }
      }
      return;
    }
    
    try {
      setSaving(true);
      const payload = {
        jobTitle: normalizeString(form.jobTitle),
        companyName: normalizeString(form.companyName),
        organizationId: coerceOrgId(form.organizationId),
        department: normalizeString(form.department),
        employmentType: normalizeString(form.employmentType),
        startDate: normalizeString(form.startDate),
        endDate: form.isCurrent ? null : normalizeString(form.endDate),
        isCurrent: !!form.isCurrent,
        location: normalizeString(form.location),
        country: normalizeString(form.country),
        description: normalizeString(form.description),
        skills: normalizeString(form.skills),
        achievements: normalizeString(form.achievements),
        reasonForLeaving: normalizeString(form.reasonForLeaving),
        salary: toNumberOrNull(form.salary),
        currencyId: toIntOrNull(form.currencyId),
        salaryFrequency: normalizeString(form.salaryFrequency),
        managerName: normalizeString(form.managerName),
        managerContact: normalizeString(form.managerContact),
        canContact: !!form.canContact,
      };
      console.log('[WorkExp] Payload:', payload);
      if (editingItem) {
        const id = getId(editingItem);
        if (!id) throw new Error('Invalid experience id');
        const res = await refopenAPI.updateWorkExperienceById(id, payload);
        console.log('[WorkExp] Update response:', res);
        if (!res?.success) throw new Error(res?.error || 'Update failed');
      } else {
        const res = await refopenAPI.createWorkExperience(payload);
        console.log('[WorkExp] Create response:', res);
        if (!res?.success) throw new Error(res?.error || 'Create failed');
      }
      await loadData();
      Alert.alert('Success', `Work experience ${editingItem ? 'updated' : 'added'} successfully`);
      setShowModal(false);
    } catch (e) {
      console.error('[WorkExp] Save error:', e);
      Alert.alert('Error', e?.message || 'Failed to save work experience');
    } finally { setSaving(false); }
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

  const renderPickerRow = (label, value, options, onSelect) => (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inlineChoices}>
        {options.map(opt => (
          <TouchableOpacity key={opt} style={[styles.choicePill, value === opt && styles.choicePillActive]} onPress={() => onSelect(opt)}>
            <Text style={[styles.choicePillText, value === opt && styles.choicePillTextActive]}>{opt}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  // derive a safe, valid list and flag
  const validExperiences = Array.isArray(experiences) ? experiences.filter((e) => !!getId(e)) : [];
  const hasExperiences = validExperiences.length > 0;

  // ? CHECK IF TOGGLE SHOULD BE HIDDEN
  const excludeId = editingItem ? getId(editingItem) : null;
  const hideCurrentToggle = shouldHideCurrentToggle(form.startDate, experiences, excludeId);
  const endDateRequired = isEndDateRequired(form, experiences, excludeId);

  return (
    <View style={[styles.sectionContainer, showHeader && { marginBottom: 24 }]}>
      {isEditing && hasExperiences && (
        <View style={styles.inlineHeader}>
          <TouchableOpacity style={styles.inlineAddButton} onPress={openAdd}>
            <Ionicons name="add" size={16} color={colors.primary} />
            <Text style={styles.inlineAddText}>Add Work Experience</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={validExperiences}
        keyExtractor={(item, index) => String(getId(item) ?? `idx-${index}`)}
        renderItem={({ item }) => (
          <ExperienceItem
            item={item}
            editable={isEditing}
            onEdit={openEdit}
            onDelete={handleDeletePress}
          />
        )}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={!hasExperiences ? { flexGrow: 1 } : null}
      />

      {/* Add/Edit Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{editingItem ? 'Edit Work Experience' : 'Add Work Experience'}</Text>
            {/* Removed Save button from header */}
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.formScroll} contentContainerStyle={styles.formContainer} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Job Title *</Text>
            <TextInput
              style={[styles.input, validationErrors.jobTitle && styles.errorInput]}
              value={form.jobTitle}
              onChangeText={(t) => { setForm({ ...form, jobTitle: t }); if (validationErrors.jobTitle) setValidationErrors(v => ({ ...v, jobTitle: undefined })); }}
              placeholder="e.g., Software Engineer"
              placeholderTextColor={colors.gray400}
              autoCapitalize="words"
            />
            {validationErrors.jobTitle ? <Text style={styles.validationText}>{validationErrors.jobTitle}</Text> : null}

            {/* Company picker with inline manual entry */}
            <Text style={styles.label}>Company</Text>
            <TouchableOpacity
              style={styles.orgPicker}
              onPress={() => { setShowOrgPicker(true); if (orgResults.length === 0) setOrgQuery(''); }}
            >
              <Text style={styles.orgPickerText}>
                {form.companyName ? `${form.companyName}${form.organizationId ? '' : ' (manual)'}` : 'Select or search company'}
              </Text>
              <Ionicons name={showOrgPicker ? 'chevron-up' : 'chevron-down'} size={18} color={colors.gray600} />
            </TouchableOpacity>

            {showOrgPicker ? (
              <View style={styles.orgPickerModal}>
                <View style={styles.orgSearchRow}>
                  <Ionicons name="search" size={16} color={colors.gray600} />
                  <TextInput
                    style={styles.orgSearchInput}
                    value={orgQuery}
                    onChangeText={setOrgQuery}
                    placeholder={manualOrgMode ? 'Enter company name' : 'Search organizations...'}
                    placeholderTextColor={colors.gray400}
                    autoCapitalize="words"
                  />
                  {manualOrgMode ? (
                    <TouchableOpacity
                      onPress={() => {
                        const name = (orgQuery || '').trim();
                        if (!name) { Alert.alert('Enter company name', 'Type your company name above'); return; }
                        setForm((prev) => ({ ...prev, organizationId: null, companyName: name }));
                        setShowOrgPicker(false);
                      }}
                    >
                      <Ionicons name="checkmark" size={18} color={colors.primary} />
                    </TouchableOpacity>
                  ) : (
                    orgLoading ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <TouchableOpacity onPress={() => setOrgQuery(orgQuery)}>
                        <Ionicons name="refresh" size={18} color={colors.primary} />
                      </TouchableOpacity>
                    )
                  )}
                </View>

                <TouchableOpacity style={styles.manualToggleRow} onPress={() => setManualOrgMode(v => !v)}>
                  <Ionicons name={manualOrgMode ? 'checkbox-outline' : 'square-outline'} size={18} color={colors.primary} />
                  <Text style={styles.manualEntryText}> My company is not listed</Text>
                </TouchableOpacity>

                {!manualOrgMode && (
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
                  />
                )}
              </View>
            ) : null}

            {/* Extended fields follow... */}
            <Text style={styles.label}>Department</Text>
            <TextInput 
              style={styles.input} 
              value={form.department} 
              onChangeText={(t) => setForm({ ...form, department: t })} 
              placeholder="e.g., Engineering" 
              placeholderTextColor={colors.gray400}
            />

            {renderPickerRow('Employment Type', form.employmentType, EMPLOYMENT_TYPES, (val) => setForm({ ...form, employmentType: val }))}

            {/* ? REPLACED: DatePicker for Start Date */}
            <DatePicker
              label="Start Date"
              value={form.startDate}
              onChange={(date) => {
                handleStartDateChange(date);
                if (validationErrors.startDate) setValidationErrors(v => ({ ...v, startDate: undefined }));
              }}
              placeholder="Select start date"
              required
              maximumDate={new Date()} // Can't start in the future
              error={validationErrors.startDate}
            />

            {/* ? SMART CURRENTLY WORKING TOGGLE - Hide when start date is older */}
            {!hideCurrentToggle && (
              <View style={styles.rowBetween}>
                <Text style={styles.label}>Currently Working</Text>
                <Switch value={!!form.isCurrent} onValueChange={(v) => setForm({ ...form, isCurrent: v, endDate: v ? '' : form.endDate })} />
              </View>
            )}

            {/* ? SHOW INFO MESSAGE WHEN TOGGLE IS HIDDEN */}
            {hideCurrentToggle && (
              <View style={styles.infoContainer}>
                <Ionicons name="information-circle" size={16} color={colors.warning || '#F59E0B'} />
                <Text style={styles.infoText}>
                  Cannot mark as current - you have a newer current position
                </Text>
              </View>
            )}

            {/* FIXED: Only show End Date field when NOT currently working */}
            {!form.isCurrent && (
              <>
                {/* ? REPLACED: DatePicker for End Date */}
                <DatePicker
                  label="End Date"
                  value={form.endDate}
                  onChange={(date) => {
                    setForm({ ...form, endDate: date }); 
                    if (validationErrors.endDate) setValidationErrors(v => ({ ...v, endDate: undefined })); 
                  }}
                  placeholder="Select end date"
                  required={endDateRequired}
                  minimumDate={form.startDate ? new Date(form.startDate) : undefined} // End must be after start
                  maximumDate={new Date()} // Can't end in the future
                  error={validationErrors.endDate}
                />
              </>
            )}

            <Text style={styles.label}>Location</Text>
            <TextInput 
              style={styles.input} 
              value={form.location} 
              onChangeText={(t) => setForm({ ...form, location: t })} 
              placeholder="City, State" 
              placeholderTextColor={colors.gray400}
            />
            
            <Text style={styles.label}>Country</Text>
            <TextInput 
              style={styles.input} 
              value={form.country} 
              onChangeText={(t) => setForm({ ...form, country: t })} 
              placeholder="Country" 
              placeholderTextColor={colors.gray400}
            />

            <Text style={styles.label}>Description</Text>
            <TextInput 
              style={[styles.input, styles.multiline]} 
              value={form.description} 
              onChangeText={(t) => setForm({ ...form, description: t })} 
              placeholder="Role responsibilities, tech stack, etc." 
              placeholderTextColor={colors.gray400}
              multiline 
              numberOfLines={4} 
            />

            <Text style={styles.label}>Skills</Text>
            <TextInput 
              style={[styles.input, styles.multiline]} 
              value={form.skills} 
              onChangeText={(t) => setForm({ ...form, skills: t })} 
              placeholder="Comma separated e.g., React, Node.js, SQL" 
              placeholderTextColor={colors.gray400}
              multiline 
              numberOfLines={3} 
            />

            <Text style={styles.label}>Achievements</Text>
            <TextInput 
              style={[styles.input, styles.multiline]} 
              value={form.achievements} 
              onChangeText={(t) => setForm({ ...form, achievements: t })} 
              placeholder="Key accomplishments" 
              placeholderTextColor={colors.gray400}
              multiline 
              numberOfLines={3} 
            />

            <Text style={styles.label}>Reason for Leaving</Text>
            <TextInput 
              style={styles.input} 
              value={form.reasonForLeaving} 
              onChangeText={(t) => setForm({ ...form, reasonForLeaving: t })} 
              placeholder="Optional" 
              placeholderTextColor={colors.gray400}
            />

            <Text style={styles.label}>Salary</Text>
            <TextInput 
              style={styles.input} 
              value={form.salary} 
              onChangeText={(t) => setForm({ ...form, salary: t })} 
              placeholder="e.g., 120000" 
              placeholderTextColor={colors.gray400}
              keyboardType="numeric" 
            />

            <Text style={styles.label}>Currency</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              <View style={styles.inlineChoices}>
                {(currencies || []).map((c) => (
                  <TouchableOpacity key={c.CurrencyID} style={[styles.choicePill, form.currencyId === c.CurrencyID && styles.choicePillActive]} onPress={() => setForm({ ...form, currencyId: c.CurrencyID })}>
                    <Text style={[styles.choicePillText, form.currencyId === c.CurrencyID && styles.choicePillTextActive]}>
                      {c.Code}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {renderPickerRow('Salary Frequency', form.salaryFrequency, SALARY_FREQUENCIES, (val) => setForm({ ...form, salaryFrequency: val }))}

            <Text style={styles.label}>Manager Name</Text>
            <TextInput 
              style={styles.input} 
              value={form.managerName} 
              onChangeText={(t) => setForm({ ...form, managerName: t })} 
              placeholder="Optional" 
              placeholderTextColor={colors.gray400}
            />
            
            <Text style={styles.label}>Manager Contact</Text>
            <TextInput 
              style={styles.input} 
              value={form.managerContact} 
              onChangeText={(t) => setForm({ ...form, managerContact: t })} 
              placeholder="Email/Phone" 
              placeholderTextColor={colors.gray400}
            />

            <View style={styles.rowBetween}>
              <Text style={styles.label}>Recruiter can contact manager</Text>
              <Switch value={!!form.canContact} onValueChange={(v) => setForm({ ...form, canContact: v })} />
            </View>

            {/* Add footer actions at the end of ScrollView content */}
            <View style={styles.modalFooterActions}>
              <TouchableOpacity 
                style={styles.modalCancelButton}
                onPress={() => setShowModal(false)}
                disabled={saving}
              >
                <Ionicons name="close" size={16} color={colors.gray600} />
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalSaveButton}
                onPress={saving ? undefined : saveForm} 
                disabled={saving}
              >
                <Ionicons name={saving ? 'hourglass' : 'save-outline'} size={16} color={colors.white} />
                <Text style={styles.modalSaveButtonText}>{saving ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal visible={showDeleteModal} transparent animationType="fade" onRequestClose={() => setShowDeleteModal(false)}>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <Ionicons name="trash-outline" size={36} color={colors.danger} />
            <Text style={styles.confirmTitle}>Delete Work Experience</Text>
            <Text style={styles.confirmMessage}>This action cannot be undone.</Text>
            <View style={styles.confirmButtons}>
              <TouchableOpacity style={styles.confirmCancel} onPress={() => setShowDeleteModal(false)} disabled={deleting}>
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmDelete} onPress={confirmDelete} disabled={deleting}>
                <Text style={styles.confirmDeleteText}>{deleting ? 'Deleting...' : 'Delete'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionContainer: { marginHorizontal: 4 },
  inlineHeader: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 8 },
  inlineAddButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: colors.border, borderRadius: 8, backgroundColor: colors.background },
  inlineAddText: { color: colors.primary, fontSize: typography.sizes?.sm || 14 },
  itemContainer: { flexDirection: 'row', padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.surface, marginBottom: 8 },
  itemTitle: { fontSize: typography.sizes?.md || 16, fontWeight: typography.weights?.medium || '500', color: colors.text },
  itemCompany: { fontSize: typography.sizes?.sm || 14, color: colors.gray700 || '#374151', marginTop: 2 },
  itemDates: { fontSize: typography.sizes?.sm || 14, color: colors.gray500 || '#6B7280', marginTop: 2 },
  itemActions: { flexDirection: 'row', alignItems: 'center', marginLeft: 8 },
  iconButton: { padding: 8 },
  emptyContainer: { alignItems: 'center', paddingVertical: 16 },
  emptyText: { color: colors.gray600, marginBottom: 8 },
  addButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  addButtonText: { color: colors.white, marginLeft: 6 },
  modalContainer: { flex: 1, backgroundColor: colors.background },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: 20, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { fontSize: typography.sizes?.lg || 18, fontWeight: typography.weights?.bold || 'bold', color: colors.text },
  // Removed saveButton style as it's now in footer
  formContainer: { padding: 20, paddingBottom: 40 },
  formScroll: { flex: 1 },
  label: { fontSize: typography.sizes?.sm || 14, color: colors.gray700 || '#374151', marginBottom: 6 },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, fontSize: typography.sizes?.md || 16, color: colors.text, marginBottom: 12 },
  inputDisabled: { opacity: 0.6 },
  // ? ADDED STYLES FOR SMART VALIDATION
  errorInput: { 
    borderColor: colors.danger || '#E53E3E', 
    borderWidth: 2 
  },
  validationText: { color: colors.danger || '#E53E3E', marginTop: -8, marginBottom: 8, fontSize: 12 },
  infoContainer: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    color: '#92400E',
    fontSize: typography.sizes?.sm || 14,
    flex: 1,
  },
  orgPicker: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  orgPickerText: { color: colors.text, fontSize: typography.sizes?.md || 16 },
  orgPickerModal: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, marginBottom: 12, overflow: 'hidden' },
  orgSearchRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.background, gap: 8 },
  orgSearchInput: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 8, fontSize: typography.sizes?.sm || 14 },
  orgList: { maxHeight: 220 },
  orgItem: { paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  orgName: { color: colors.text, fontSize: typography.sizes?.md || 16 },
  orgMeta: { color: colors.gray600, fontSize: typography.sizes?.sm || 14 },
  manualEntry: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background },
  manualEntryText: { color: colors.primary, fontSize: typography.sizes?.sm || 14 },
  // Simple pill choices
  inlineChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choicePill: { borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.background },
  choicePillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  choicePillText: { color: colors.text },
  choicePillTextActive: { color: colors.white },
  // Confirm modal styles
  confirmOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  confirmCard: { width: '100%', maxWidth: 360, backgroundColor: colors.surface, borderRadius: 16, padding: 20, alignItems: 'center' },
  confirmTitle: { fontSize: typography.sizes?.lg || 18, fontWeight: typography.weights?.bold || 'bold', color: colors.text, marginTop: 8, marginBottom: 6, textAlign: 'center' },
  confirmMessage: { fontSize: typography.sizes?.sm || 14, color: colors.gray600, textAlign: 'center', marginBottom: 16 },
  confirmButtons: { flexDirection: 'row', gap: 10, width: '100%' },
  confirmCancel: { flex: 1, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  confirmCancelText: { color: colors.text, fontSize: typography.sizes?.md || 16 },
  confirmDelete: { flex: 1, backgroundColor: colors.danger || '#FF3B30', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  confirmDeleteText: { color: colors.white, fontSize: typography.sizes?.md || 16, fontWeight: typography.weights?.bold || 'bold' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  multiline: { height: 100, textAlignVertical: 'top' },
  manualToggleRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border },
  // New footer styles
  modalFooterActions: { 
    flexDirection: 'row', 
    justifyContent: 'flex-end', 
    alignItems: 'center',
    gap: 12,
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1, 
    borderTopColor: colors.border || '#E5E7EB',
  },
  modalCancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border || '#E5E7EB',
    backgroundColor: colors.surface || '#FFFFFF',
  },
  modalCancelButtonText: {
    fontSize: typography.sizes?.sm || 14,
    color: colors.gray600 || '#6B7280',
    fontWeight: typography.weights?.medium || '500',
  },
  modalSaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: colors.primary || '#007AFF',
    minWidth: 100,
    justifyContent: 'center',
  },
  modalSaveButtonText: {
    fontSize: typography.sizes?.sm || 14,
    color: colors.white || '#FFFFFF',
    fontWeight: typography.weights?.bold || 'bold',
  },
});
