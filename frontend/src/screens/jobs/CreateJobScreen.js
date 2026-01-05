import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, StyleSheet, Platform, Modal, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import useResponsive from '../../hooks/useResponsive';
import refopenAPI from '../../services/api';
import DatePicker from '../../components/DatePicker';
import { showToast } from '../../components/Toast';
import { typography } from '../../styles/theme';

export default function CreateJobScreen({ navigation }) {
  const { colors } = useTheme();
  const responsive = useResponsive();
  const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);
  
  const [loading, setLoading] = useState(false);
  const [jobTypes, setJobTypes] = useState([]);
  const [workplaceTypes, setWorkplaceTypes] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [departmentOptions, setDepartmentOptions] = useState([]);
  const [countries, setCountries] = useState([]);
  const [loadingCountries, setLoadingCountries] = useState(true);
  const [errors, setErrors] = useState({});
  const [applicationDeadline, setApplicationDeadline] = useState('');
  const [targetHiringDate, setTargetHiringDate] = useState('');
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState('');
  const [selectedDateKey, setSelectedDateKey] = useState('');

  const [showDepartmentModal, setShowDepartmentModal] = useState(false);
  const [departmentSearch, setDepartmentSearch] = useState('');
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');

  const [jobData, setJobData] = useState({
    title: '',
    jobTypeID: null,
    department: '',
    description: '',
    responsibilities: '',
    benefitsOffered: '',
    location: '',
    country: '',
    state: '',
    city: '',
    postalCode: '',
    workplaceType: '',
    remoteRestrictions: '',
    salaryRangeMin: '',
    salaryRangeMax: '',
    currencyID: null,
    salaryPeriod: 'Annual',
    compensationType: 'Salary',
    bonusDetails: '',
    equityOffered: '',
    experienceMin: '',
    experienceMax: '',
    requiredCertifications: '',
    requiredEducation: '',
    priority: 'Normal',
    visibility: 'Public',
    applicationDeadline: '',
    targetHiringDate: '',
    maxApplications: '',
    assessmentRequired: false,
    assessmentDetails: '',
    tags: '',
    internalNotes: ''
  });

  useEffect(() => { loadReferenceData(); }, []);

  const loadReferenceData = async () => {
    try {
      // ✅ OPTIMIZED: Use bulk endpoint to fetch multiple types in one call
      const [refData, cur, countriesRes] = await Promise.all([
        refopenAPI.getBulkReferenceMetadata(['JobType', 'WorkplaceType', 'Department']),
        refopenAPI.getCurrencies(),
        refopenAPI.getCountries(),
      ]);

      // Handle JobType data
      if (refData?.success && refData.data?.JobType) {
        const transformedJobTypes = refData.data.JobType.map(item => ({
          JobTypeID: item.ReferenceID,
          Type: item.Value
        }));
        setJobTypes(transformedJobTypes);
        if (!jobData.jobTypeID && transformedJobTypes.length) {
          setJobData(prev => ({ ...prev, jobTypeID: transformedJobTypes[0].JobTypeID }));
        }
      }

      // Handle WorkplaceType data
      if (refData?.success && refData.data?.WorkplaceType) {
        const transformedWorkplaceTypes = refData.data.WorkplaceType.map(item => ({
          WorkplaceTypeID: item.ReferenceID,
          Type: item.Value,
          Normalized: item.Value.trim()
        }));
        setWorkplaceTypes(transformedWorkplaceTypes);
        if (!jobData.workplaceType && transformedWorkplaceTypes.length) {
          setJobData(prev => ({ ...prev, workplaceType: transformedWorkplaceTypes[0].Normalized }));
        }
      }

      // Handle Department reference data
      if (refData?.success && refData.data?.Department) {
        const departmentItems = Array.isArray(refData.data.Department) ? refData.data.Department : [];
        const values = departmentItems
          .map(item => item?.Value)
          .filter(Boolean)
          .map(v => String(v));
        const uniqueSorted = Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
        setDepartmentOptions(uniqueSorted);
      }

      // Handle currencies
      if (cur?.success) {
        const sorted = [...cur.data].sort((a,b)=>a.Code.localeCompare(b.Code));
        setCurrencies(sorted);
        const inr = sorted.find(c => c.Code === 'INR');
        setJobData(prev => ({ ...prev, currencyID: (inr || sorted[0])?.CurrencyID || null }));
      }

      // Handle countries (third-party/ref endpoint)
      if (countriesRes?.success && countriesRes.data?.countries) {
        const transformedCountries = countriesRes.data.countries
          .map(c => ({
            name: c.name,
            flag: c.flag,
            region: c.region,
            id: c.id,
          }))
          .filter(c => c.name);
        setCountries(transformedCountries);
      } else {
        setCountries([]);
      }
    } catch (e) {
      console.error('Reference load failed', e);
      setCountries([]);
    }
    finally {
      setLoadingCountries(false);
    }
  };

  const validateForm = () => {
    const v = {};
    if (!jobData.title.trim()) v.title = 'Title required';
    else if (jobData.title.length < 5) v.title = 'Min 5 chars';
    if (!jobData.jobTypeID) v.jobTypeID = 'Job type required';
    if (!jobData.department?.trim()) v.department = 'Department required';
    if (!jobData.description.trim()) v.description = 'Description required';
    else if (jobData.description.trim().length < 20) v.description = 'Min 20 chars';
    if (jobData.salaryRangeMin && jobData.salaryRangeMax) {
      const min = parseFloat(jobData.salaryRangeMin); const max = parseFloat(jobData.salaryRangeMax);
      if (!isNaN(min) && !isNaN(max) && min >= max) v.salaryRange = 'Max must be > Min';
    }
    setErrors(v);
    return Object.keys(v).length === 0;
  };

  const handleCreateJob = async () => {
    if (!validateForm()) { Alert.alert('Validation', 'Fix errors before submitting'); return; }
    setLoading(true);
    try {
      const isRemote = jobData.workplaceType?.toLowerCase() === 'remote';
      const payload = {
        title: jobData.title.trim(),
        jobTypeID: parseInt(jobData.jobTypeID),
        department: jobData.department.trim(),
        description: jobData.description.trim(),
        responsibilities: jobData.responsibilities?.trim() || undefined,
        benefitsOffered: jobData.benefitsOffered?.trim() || undefined,
        location: jobData.location?.trim() || undefined,
        country: jobData.country?.trim() || undefined,
        state: jobData.state?.trim() || undefined,
        city: jobData.city?.trim() || undefined,
        postalCode: jobData.postalCode?.trim() || undefined,
        workplaceType: jobData.workplaceType,
        isRemote,
        remoteRestrictions: isRemote ? (jobData.remoteRestrictions?.trim() || undefined) : undefined,
        salaryRangeMin: jobData.salaryRangeMin ? parseFloat(jobData.salaryRangeMin) : undefined,
        salaryRangeMax: jobData.salaryRangeMax ? parseFloat(jobData.salaryRangeMax) : undefined,
        currencyID: jobData.currencyID ? parseInt(jobData.currencyID) : undefined,
        salaryPeriod: jobData.salaryPeriod,
        compensationType: jobData.compensationType,
        bonusDetails: jobData.bonusDetails?.trim() || undefined,
        equityOffered: jobData.equityOffered?.trim() || undefined,
        experienceMin: jobData.experienceMin ? parseInt(jobData.experienceMin) : undefined,
        experienceMax: jobData.experienceMax ? parseInt(jobData.experienceMax) : undefined,
        requiredCertifications: jobData.requiredCertifications?.trim() || undefined,
        requiredEducation: jobData.requiredEducation?.trim() || undefined,
        priority: jobData.priority,
        visibility: jobData.visibility,
        applicationDeadline: jobData.applicationDeadline ? new Date(jobData.applicationDeadline) : undefined,
        targetHiringDate: jobData.targetHiringDate ? new Date(jobData.targetHiringDate) : undefined,
        maxApplications: jobData.maxApplications ? parseInt(jobData.maxApplications) : undefined,
        assessmentRequired: jobData.assessmentRequired,
        assessmentDetails: jobData.assessmentRequired ? (jobData.assessmentDetails?.trim() || undefined) : undefined,
        tags: jobData.tags?.trim() || undefined,
        internalNotes: jobData.internalNotes?.trim() || undefined
      };


      const result = await refopenAPI.createJob(payload);
      if (result.success) {
        showToast('Job created successfully!', 'success');
        // ✅ FIXED: Redirect to Jobs (employer jobs screen) instead of Home
        try { 
          navigation.reset({ index: 0, routes: [{ name: 'Jobs' }] }); 
        }
        catch { 
          navigation.navigate('Jobs'); 
        }
        return;
      } else {
        Alert.alert('Error', result.error || result.message || 'Creation failed');
      }
    } catch (e) {
      console.error('Create job error:', e);
      const details = e?.data?.details;
      if (Array.isArray(details) && details.length) {
        const mapped = {};
        for (const d of details) {
          const field = (d?.field || '').toString();
          const message = (d?.message || '').toString();
          if (!field) continue;
          mapped[field] = message || 'Invalid value';
        }
        if (Object.keys(mapped).length) {
          setErrors(prev => ({ ...prev, ...mapped }));
        }
        Alert.alert('Validation', 'Please fix highlighted fields and try again.');
      } else {
        Alert.alert('Error', e?.message || 'Failed to create job');
      }
    } finally { setLoading(false); }
  };

  const onDateSelect = (date) => {
    setDatePickerVisible(false);
    const formattedDate = date ? date.toISOString().split('T')[0] : '';
    if (selectedDateKey === 'applicationDeadline') {
      setApplicationDeadline(formattedDate);
      setJobData(prev => ({ ...prev, applicationDeadline: formattedDate }));
    } else if (selectedDateKey === 'targetHiringDate') {
      setTargetHiringDate(formattedDate);
      setJobData(prev => ({ ...prev, targetHiringDate: formattedDate }));
    }
  };

  const renderInput = (key, label, placeholder, opts = {}) => {
    const { required=false, multiline=false, keyboardType='default', maxLength } = opts;
    return (
      <View style={styles.fieldContainer}>
        <Text style={styles.fieldLabel}>{label} {required && <Text style={styles.required}>*</Text>}</Text>
        <TextInput
          style={[styles.input, multiline && styles.textArea, errors[key] && styles.inputError]}
          value={jobData[key] ? String(jobData[key]) : ''}
          placeholder={placeholder}
          placeholderTextColor={colors.gray400}
          onChangeText={t => { setJobData(prev => ({ ...prev, [key]: t })); if (errors[key]) setErrors(prev => ({ ...prev, [key]: null })); }}
          multiline={multiline}
          numberOfLines={multiline ? 4 : 1}
          keyboardType={keyboardType}
          maxLength={maxLength}
          textAlignVertical={multiline ? 'top' : 'center'}
        />
        {errors[key] && <Text style={styles.errorText}>{errors[key]}</Text>}
      </View>
    );
  };

  const renderSelect = (key, label, placeholder, onPress, opts = {}) => {
    const { required = false } = opts;
    const value = jobData[key] ? String(jobData[key]) : '';
    const hasError = Boolean(errors[key]);
    return (
      <View style={styles.fieldContainer}>
        <Text style={styles.fieldLabel}>{label} {required && <Text style={styles.required}>*</Text>}</Text>
        <TouchableOpacity
          style={[styles.selectInput, hasError && styles.inputError]}
          onPress={onPress}
          activeOpacity={0.8}
        >
          <Text style={[styles.selectInputText, !value && styles.selectPlaceholder]}>
            {value || placeholder}
          </Text>
          <Ionicons name="chevron-down" size={18} color={colors.gray500} />
        </TouchableOpacity>
        {hasError && <Text style={styles.errorText}>{errors[key]}</Text>}
      </View>
    );
  };

  const filteredDepartments = departmentSearch.trim()
    ? departmentOptions.filter(d => d.toLowerCase().includes(departmentSearch.trim().toLowerCase()))
    : departmentOptions;

  const filteredCountries = countrySearch.trim()
    ? countries.filter(c => (c?.name || '').toLowerCase().includes(countrySearch.trim().toLowerCase()))
    : countries;

  const renderChips = (key, label, data, valueProp, labelProp) => (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.pickerContainer}>
        {data.map(item => {
          const selected = jobData[key] === item[labelProp] || jobData[key] === item.Normalized;
          return (
            <TouchableOpacity key={item[valueProp]} style={[styles.pickerButton, selected && styles.pickerButtonActive]} onPress={() => setJobData(prev => ({ ...prev, [key]: item[labelProp] || item.Normalized }))}>
              <Text style={[styles.pickerButtonText, selected && styles.pickerButtonTextActive]}>{item[labelProp] || item.Normalized}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const renderSimpleChips = (key, label, values) => (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.pickerContainer}>
        {values.map(v => {
          const selected = jobData[key] === v;
          return (
            <TouchableOpacity key={v} style={[styles.pickerButton, selected && styles.pickerButtonActive]} onPress={() => setJobData(prev => ({ ...prev, [key]: v }))}>
              <Text style={[styles.pickerButtonText, selected && styles.pickerButtonTextActive]}>{v}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.innerContainer}>
      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Text style={styles.title}>Post a New Job</Text>
          <Text style={styles.subtitle}>Provide core details only – simplified form</Text>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Basic Information</Text>
            {renderInput('title','Job Title','e.g. Senior React Native Developer',{required:true,maxLength:200})}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Job Type *</Text>
              <View style={styles.pickerContainer}>
                {jobTypes.map(t => {
                  const selected = jobData.jobTypeID === t.JobTypeID;
                  return (
                    <TouchableOpacity key={t.JobTypeID} style={[styles.pickerButton, selected && styles.pickerButtonActive]} onPress={() => setJobData(prev => ({ ...prev, jobTypeID: t.JobTypeID }))}>
                      <Text style={[styles.pickerButtonText, selected && styles.pickerButtonTextActive]}>{t.Type}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {errors.jobTypeID && <Text style={styles.errorText}>{errors.jobTypeID}</Text>}
            </View>
            {renderSelect(
              'department',
              'Department',
              'Select department',
              () => setShowDepartmentModal(true),
              { required: true }
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            {renderInput('description','Job Description','Describe the role...',{required:true,multiline:true})}
            {renderInput('responsibilities','Responsibilities','List responsibilities...',{multiline:true})}
            {renderInput('benefitsOffered','Benefits Offered','Perks, benefits...',{multiline:true})}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Location & Work Type</Text>
            {renderInput('location','Location','e.g. Bengaluru, KA',{maxLength:200})}
            {renderSelect(
              'country',
              'Country',
              (loadingCountries ? 'Loading countries...' : 'Select country'),
              () => setShowCountryModal(true)
            )}
            {renderInput('state','State / Province','Karnataka',{maxLength:100})}
            {renderInput('city','City','Bengaluru',{maxLength:100})}
            {renderInput('postalCode','Postal Code','560001',{maxLength:20})}
            {renderChips('workplaceType','Workplace Type',workplaceTypes,'WorkplaceTypeID','Type')}
            {jobData.workplaceType?.toLowerCase()==='remote' && renderInput('remoteRestrictions','Remote Restrictions','e.g. India only',{maxLength:200})}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Compensation</Text>
            <View style={styles.salaryContainer}>
              {renderInput('salaryRangeMin','Min Salary','800000',{keyboardType:'numeric'})}
              {renderInput('salaryRangeMax','Max Salary','1200000',{keyboardType:'numeric'})}
            </View>
            {errors.salaryRange && <Text style={styles.errorText}>{errors.salaryRange}</Text>}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Currency (Default INR)</Text>
              <View style={styles.pickerContainer}>
                {currencies.map(c => {
                  const selected = jobData.currencyID === c.CurrencyID;
                  return (
                    <TouchableOpacity key={c.CurrencyID} style={[styles.pickerButton, selected && styles.pickerButtonActive]} onPress={() => setJobData(prev => ({ ...prev, currencyID: c.CurrencyID }))}>
                      <Text style={[styles.pickerButtonText, selected && styles.pickerButtonTextActive]}>{c.Code}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
            {renderSimpleChips('salaryPeriod','Salary Period',['Annual','Monthly','Hourly'])}
            {renderSimpleChips('compensationType','Compensation Type',['Salary','Contract','Commission'])}
            {renderInput('bonusDetails','Bonus Details','Performance bonus',{maxLength:300})}
            {renderInput('equityOffered','Equity Offered','Stock options',{maxLength:100})}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Experience & Requirements</Text>
            <View style={styles.experienceContainer}>
              {renderInput('experienceMin','Min Exp (Yrs)','3',{keyboardType:'numeric'})}
              {renderInput('experienceMax','Max Exp (Yrs)','8',{keyboardType:'numeric'})}
            </View>
            {renderInput('requiredCertifications','Certifications','AWS, Azure',{maxLength:100})}
            {renderInput('requiredEducation','Required Education','Bachelors CS',{maxLength:200})}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Settings</Text>
            {renderSimpleChips('priority','Priority',['Normal','High','Urgent'])}
            {renderSimpleChips('visibility','Visibility',['Public','Private','Internal'])}
            
            {/* ✅ REPLACED: Use DatePicker component instead of manual input */}
            <DatePicker
              label="Application Deadline"
              value={jobData.applicationDeadline}
              onChange={(date) => setJobData(prev => ({ ...prev, applicationDeadline: date }))}
              placeholder="Select deadline date"
              minimumDate={new Date()} // Can't set deadline in the past
            />
            
            <DatePicker
              label="Target Hiring Date"
              value={jobData.targetHiringDate}
              onChange={(date) => setJobData(prev => ({ ...prev, targetHiringDate: date }))}
              placeholder="Select target date"
              minimumDate={new Date()} // Can't set target date in the past
            />
            
            {renderInput('maxApplications','Max Applications','100',{keyboardType:'numeric'})}
            <TouchableOpacity style={styles.toggleContainer} onPress={() => setJobData(prev => ({ ...prev, assessmentRequired: !prev.assessmentRequired }))}>
              <View style={styles.toggleLeft}>
                <Ionicons name={jobData.assessmentRequired ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={jobData.assessmentRequired ? colors.primary : colors.gray400} />
                <Text style={styles.toggleText}>Assessment Required</Text>
              </View>
            </TouchableOpacity>
            {jobData.assessmentRequired && renderInput('assessmentDetails','Assessment Details','Describe assessment',{multiline:true})}
            {renderInput('tags','Tags','react, javascript',{maxLength:100})}
            {renderInput('internalNotes','Internal Notes','Private notes',{multiline:true,maxLength:100})}
          </View>

          <View style={styles.actionContainer}>
            <TouchableOpacity style={styles.draftButton} onPress={() => navigation.goBack()}>
              <Text style={styles.draftButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.publishButton, loading && styles.buttonDisabled]} onPress={handleCreateJob} disabled={loading}>
              <Text style={styles.publishButtonText}>{loading ? 'Creating...' : 'Create Job'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
      </View>
      {datePickerVisible && (
        <DatePicker
          mode={datePickerMode}
          date={datePickerMode === 'date' ? new Date(selectedDateKey) : new Date()}
          onConfirm={onDateSelect}
          onCancel={() => setDatePickerVisible(false)}
        />
      )}

      {/* Department Picker */}
      <Modal
        visible={showDepartmentModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDepartmentModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowDepartmentModal(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Department</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.modalSearchRow}>
            <Ionicons name="search" size={18} color={colors.gray600} />
            <TextInput
              style={[styles.input, styles.modalSearchInput]}
              placeholder="Search departments..."
              placeholderTextColor={colors.gray400}
              value={departmentSearch}
              onChangeText={setDepartmentSearch}
            />
          </View>

          <FlatList
            data={filteredDepartments}
            keyExtractor={(item) => String(item)}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const selected = item === jobData.department;
              return (
                <TouchableOpacity
                  style={[styles.modalItem, selected && styles.modalItemSelected]}
                  onPress={() => {
                    setJobData(prev => ({ ...prev, department: item }));
                    setDepartmentSearch('');
                    setShowDepartmentModal(false);
                    if (errors.department) setErrors(prev => ({ ...prev, department: null }));
                  }}
                >
                  <Text style={[styles.modalItemText, selected && styles.modalItemTextSelected]}>{item}</Text>
                  {selected && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={() => (
              <View style={styles.emptyContainer}>
                <Ionicons name="layers" size={48} color={colors.gray400} />
                <Text style={styles.emptyText}>No departments found</Text>
              </View>
            )}
          />
        </View>
      </Modal>

      {/* Country Picker */}
      <Modal
        visible={showCountryModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCountryModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCountryModal(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Country</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.modalSearchRow}>
            <Ionicons name="search" size={18} color={colors.gray600} />
            <TextInput
              style={[styles.input, styles.modalSearchInput]}
              placeholder="Search countries..."
              placeholderTextColor={colors.gray400}
              value={countrySearch}
              onChangeText={setCountrySearch}
            />
          </View>

          <FlatList
            data={filteredCountries}
            keyExtractor={(item) => String(item.id ?? item.name)}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const display = `${item.flag ? item.flag + ' ' : ''}${item.name}`;
              const selected = item.name === jobData.country;
              return (
                <TouchableOpacity
                  style={[styles.modalItem, selected && styles.modalItemSelected]}
                  onPress={() => {
                    setJobData(prev => ({ ...prev, country: item.name }));
                    setCountrySearch('');
                    setShowCountryModal(false);
                  }}
                >
                  <Text style={[styles.modalItemText, selected && styles.modalItemTextSelected]}>{display}</Text>
                  {selected && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={() => (
              <View style={styles.emptyContainer}>
                <Ionicons name="flag" size={48} color={colors.gray400} />
                <Text style={styles.emptyText}>No countries found</Text>
              </View>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors, responsive = {}) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    ...(Platform.OS === 'web' && responsive.isDesktop ? {
      alignItems: 'center',
    } : {}),
  },
  innerContainer: {
    width: '100%',
    maxWidth: Platform.OS === 'web' && responsive.isDesktop ? 900 : '100%',
    flex: 1,
  },
  scrollContainer:{flex:1},
  scrollContent:{paddingBottom:100},
  content:{padding:20},
  title:{fontSize:typography.sizes.xxl,fontWeight:typography.weights.bold,color:colors.text,marginBottom:8},
  subtitle:{fontSize:typography.sizes.md,color:colors.gray600,marginBottom:32},
  section:{backgroundColor:colors.surface,padding:20,borderRadius:12,marginBottom:16},
  sectionTitle:{fontSize:typography.sizes.lg,fontWeight:typography.weights.bold,color:colors.text,marginBottom:20},
  fieldContainer:{marginBottom:20},
  fieldLabel:{fontSize:typography.sizes.md,fontWeight:typography.weights.medium,color:colors.text,marginBottom:8},
  required:{color:colors.danger},
  input:{backgroundColor:colors.inputBackground || colors.background,borderWidth:1,borderColor:colors.border,borderRadius:8,padding:16,fontSize:typography.sizes.md,color:colors.text},
  inputError:{borderColor:colors.danger},
  textArea:{height:100,textAlignVertical:'top'},
  errorText:{color:colors.danger,fontSize:typography.sizes.sm,marginTop:4},
  selectInput:{backgroundColor:colors.background,borderWidth:1,borderColor:colors.border,borderRadius:8,padding:16,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},
  selectInputText:{flex:1,fontSize:typography.sizes.md,color:colors.text},
  selectPlaceholder:{color:colors.gray400},
  pickerContainer:{flexDirection:'row',flexWrap:'wrap',gap:8},
  pickerButton:{paddingHorizontal:16,paddingVertical:8,borderRadius:20,borderWidth:1,borderColor:colors.border,backgroundColor:colors.background},
  pickerButtonActive:{backgroundColor:colors.primary,borderColor:colors.primary},
  pickerButtonText:{fontSize:typography.sizes.sm,fontWeight:typography.weights.medium,color:colors.text},
  pickerButtonTextActive:{color:colors.white},
  toggleContainer:{backgroundColor:colors.background,borderWidth:1,borderColor:colors.border,borderRadius:8,padding:16,marginBottom:12},
  toggleLeft:{flexDirection:'row',alignItems:'center'},
  toggleText:{fontSize:typography.sizes.md,color:colors.text,marginLeft:12},
  salaryContainer:{flexDirection:'row',gap:12},
  experienceContainer:{flexDirection:'row',gap:12},
  actionContainer:{flexDirection:'row',gap:12,marginTop:20},
  draftButton:{flex:1,padding:16,borderRadius:8,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface,alignItems:'center'},
  draftButtonText:{fontSize:typography.sizes.md,fontWeight:typography.weights.medium,color:colors.text},
  publishButton:{flex:1,backgroundColor:colors.primary,padding:16,borderRadius:8,alignItems:'center'},
  publishButtonText:{fontSize:typography.sizes.md,fontWeight:typography.weights.bold,color:colors.white},
  buttonDisabled:{backgroundColor:colors.gray400},
  datePickerContainer:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',padding:16,borderWidth:1,borderColor:colors.border,borderRadius:8,marginBottom:12,backgroundColor:colors.background},
  datePickerLabel:{fontSize:typography.sizes.md,color:colors.text},
  datePickerText:{fontSize:typography.sizes.md,color:colors.text},
  datePickerIcon:{marginLeft:8},
  modalContainer:{flex:1,backgroundColor:colors.background},
  modalHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:20,paddingBottom:12,paddingTop:Platform.OS==='ios'?60:20,borderBottomWidth:1,borderBottomColor:colors.border,backgroundColor:colors.background},
  modalTitle:{fontSize:typography.sizes.lg,fontWeight:typography.weights.bold,color:colors.text},
  modalSearchRow:{padding:16,flexDirection:'row',alignItems:'center',gap:10},
  modalSearchInput:{flex:1,paddingVertical:12},
  modalItem:{paddingHorizontal:20,paddingVertical:16,borderBottomWidth:1,borderBottomColor:colors.border,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  modalItemSelected:{backgroundColor:colors.primaryLight},
  modalItemText:{fontSize:typography.sizes.md,color:colors.text},
  modalItemTextSelected:{color:colors.primary,fontWeight:typography.weights.bold},
  emptyContainer:{flex:1,justifyContent:'center',alignItems:'center',padding:40,marginTop:40},
  emptyText:{fontSize:typography.sizes.md,color:colors.gray600,textAlign:'center',marginTop:16},
});