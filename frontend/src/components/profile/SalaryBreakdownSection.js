import React, { useState, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../../styles/theme';
import nexhireAPI from '../../services/api';
import { useEditing } from './ProfileSection';

// Helpers to normalize backend data to a consistent shape
const normalizeSalaryComponents = (data) => {
  if (!Array.isArray(data)) return [];
  return data
    .map((obj) => {
      const id = obj.ComponentID ?? obj.SalaryComponentID ?? obj.Id ?? obj.ID ?? obj.componentId;
      const name = obj.Name ?? obj.ComponentName ?? obj.DisplayName ?? obj.Title ?? obj.name;
      return id != null && name ? { ComponentID: Number(id), Name: String(name) } : null;
    })
    .filter(Boolean);
};

const normalizeCurrencies = (data) => {
  if (!Array.isArray(data)) return [];
  return data
    .map((obj) => {
      const id = obj.CurrencyID ?? obj.CurrencyId ?? obj.Id ?? obj.ID;
      const code = obj.Code ?? obj.CurrencyCode ?? obj.ISOCode ?? obj.code;
      const name = obj.Name ?? obj.CurrencyName ?? obj.name;
      return id != null ? { CurrencyID: Number(id), Code: String(code || ''), Name: String(name || '') } : null;
    })
    .filter(Boolean);
};

const FREQUENCIES = ['Yearly', 'Monthly', 'Weekly', 'Daily', 'Hourly'];

const SalaryBreakdownSection = forwardRef(function SalaryBreakdownSection(
  { profile, setProfile, editing, onUpdate, embedded = false, compact = true },
  ref
) {
  const [showSalaryModal, setShowSalaryModal] = useState(false);
  const [salaryComponents, setSalaryComponents] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingContext, setEditingContext] = useState('current');
  const [displayCurrency, setDisplayCurrency] = useState('INR');
  const [exchangeRatesCache, setExchangeRatesCache] = useState({});
  const [salaryTotals, setSalaryTotals] = useState({ current: 0, expected: 0 });
  const [groupTotals, setGroupTotals] = useState({
    current: { fixed: 0, variable: 0, stock: 0, other: 0 },
    expected: { fixed: 0, variable: 0, stock: 0, other: 0 },
  });
  const [localSalaryBreakdown, setLocalSalaryBreakdown] = useState({ current: [], expected: [] });

  const [pickerState, setPickerState] = useState({ visible: false, type: 'component', context: 'current', index: 0 });

  useImperativeHandle(ref, () => ({
    openEditor: () => setShowSalaryModal(true),
    save: async () => await saveSalaryBreakdown(true),
  }));

  const getDefaultCurrency = (list) => list.find((c) => (c.Code || '').toUpperCase() === 'INR') || list[0];
  const getDefaultCurrencyId = (list) => (getDefaultCurrency(list)?.CurrencyID) || 1;

  useEffect(() => {
    if (profile?.salaryBreakdown) {
      setLocalSalaryBreakdown(profile.salaryBreakdown);
    }
    loadReferenceData();
  }, [profile?.salaryBreakdown]);

  // Sanitize any rows without CurrencyID to default INR once currencies load
  useEffect(() => {
    if (!currencies || currencies.length === 0) return;
    setLocalSalaryBreakdown((prev) => {
      const defId = getDefaultCurrencyId(currencies);
      const sanitizeList = (arr = []) => arr.map((row) => ({ ...row, CurrencyID: row.CurrencyID || defId, Frequency: row.Frequency || 'Yearly' }));
      return { current: sanitizeList(prev.current), expected: sanitizeList(prev.expected) };
    });
  }, [currencies]);

  useEffect(() => {
    if (currencies.length > 0 && (localSalaryBreakdown.current.length > 0 || localSalaryBreakdown.expected.length > 0)) {
      const timeoutId = setTimeout(() => calculateTotals(), 200);
      return () => clearTimeout(timeoutId);
    }
  }, [displayCurrency, localSalaryBreakdown, currencies]);

  const loadReferenceData = async () => {
    try {
      const [componentsRes, currenciesRes] = await Promise.all([
        nexhireAPI.getSalaryComponents(),
        nexhireAPI.getCurrencies(),
      ]);
      if (componentsRes?.success) setSalaryComponents(normalizeSalaryComponents(componentsRes.data));
      if (currenciesRes?.success) {
        const normalized = normalizeCurrencies(currenciesRes.data);
        setCurrencies(normalized);
        const def = getDefaultCurrency(normalized);
        setDisplayCurrency((def?.Code) || 'INR');
      }
    } catch (error) {
      console.error('Error loading reference data:', error);
      setSalaryComponents([]);
      setCurrencies([]);
    }
  };

  const getExchangeRate = async (fromCurrency, toCurrency) => {
    if (!fromCurrency || !toCurrency || fromCurrency === toCurrency) return 1.0;
    const cacheKey = `${fromCurrency}-${toCurrency}`;
    const reverseCacheKey = `${toCurrency}-${fromCurrency}`;
    if (exchangeRatesCache[cacheKey]) return exchangeRatesCache[cacheKey];
    if (exchangeRatesCache[reverseCacheKey]) {
      const reverseRate = 1 / exchangeRatesCache[reverseCacheKey];
      setExchangeRatesCache((prev) => ({ ...prev, [cacheKey]: reverseRate }));
      return reverseRate;
    }
    // Primary provider: frankfurter.app
    try {
      const url = `https://api.frankfurter.app/latest?amount=1&from=${fromCurrency}&to=${toCurrency}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        const rate = data?.rates?.[toCurrency];
        if (rate) {
          setExchangeRatesCache((prev) => ({ ...prev, [cacheKey]: rate, [reverseCacheKey]: 1 / rate }));
          return rate;
        }
      }
    } catch (_) {}
    // Fallback provider: exchangerate.host
    try {
      const url2 = `https://api.exchangerate.host/convert?amount=1&from=${fromCurrency}&to=${toCurrency}`;
      const res2 = await fetch(url2);
      if (res2.ok) {
        const data2 = await res2.json();
        const rate2 = data2?.result;
        if (rate2) {
          setExchangeRatesCache((prev) => ({ ...prev, [cacheKey]: rate2, [reverseCacheKey]: 1 / rate2 }));
          return rate2;
        }
      }
    } catch (_) {}
    return 1.0;
  };

  const toYearly = (amount, freq) => {
    const a = parseFloat(amount || 0) || 0;
    switch (freq || 'Yearly') {
      case 'Monthly':
        return a * 12;
      case 'Weekly':
        return a * 52;
      case 'Daily':
        return a * 365;
      case 'Hourly':
        return a * 2080;
      default:
        return a;
    }
  };

  const getComponentById = (id) => salaryComponents.find((c) => c.ComponentID === id);
  const categorize = (name = '') => {
    const n = String(name).toLowerCase();
    if (n.includes('fixed') || n === 'ctc' || n.includes('base')) return 'fixed';
    if (n.includes('variable') || n.includes('bonus') || n.includes('incent')) return 'variable';
    if (n.includes('stock') || n.includes('esop') || n.includes('rsu') || n.includes('equity')) return 'stock';
    return 'other';
  };

  const tallyContext = async (context) => {
    const components = localSalaryBreakdown[context] || [];
    let total = 0;
    const groups = { fixed: 0, variable: 0, stock: 0, other: 0 };
    for (const row of components) {
      const amount = parseFloat(row.Amount || 0);
      if (!amount || amount <= 0) continue;
      const yearly = toYearly(amount, row.Frequency);
      const curr = currencies.find((c) => c.CurrencyID === row.CurrencyID);
      const rate = await getExchangeRate(curr?.Code, displayCurrency);
      const converted = yearly * rate;
      total += converted;
      const compName = getComponentById(row.ComponentID)?.Name;
      const key = categorize(compName);
      groups[key] += converted;
    }
    return { total, groups };
  };

  const calculateTotals = async () => {
    try {
      const [cur, exp] = await Promise.all([tallyContext('current'), tallyContext('expected')]);
      setSalaryTotals({ current: cur.total, expected: exp.total });
      setGroupTotals({ current: cur.groups, expected: exp.groups });
    } catch (e) {
      console.error('Salary total calc failed', e);
      setSalaryTotals({ current: 0, expected: 0 });
      setGroupTotals({
        current: { fixed: 0, variable: 0, stock: 0, other: 0 },
        expected: { fixed: 0, variable: 0, stock: 0, other: 0 },
      });
    }
  };

  const saveSalaryBreakdown = async (silent = false) => {
    if (!profile?.UserID) {
      Alert.alert('Error', 'User ID not found');
      return false;
    }

    const sanitize = (list) =>
      (list || [])
        .map((comp) => ({
          ComponentID: parseInt(comp.ComponentID) || 1,
          Amount: parseFloat(comp.Amount) || 0,
          CurrencyID: parseInt(comp.CurrencyID) || getDefaultCurrencyId(currencies),
          Frequency: comp.Frequency || 'Yearly',
          Notes: comp.Notes || '',
        }))
        .filter((comp) => comp.Amount > 0);

    const payload = {
      current: sanitize(localSalaryBreakdown.current),
      expected: sanitize(localSalaryBreakdown.expected),
    };

    setLoading(true);
    try {
      const result = await nexhireAPI.updateSalaryBreakdown(profile.UserID, payload);
      if (result?.success) {
        setLocalSalaryBreakdown(payload);
        setProfile && setProfile((prev) => ({ ...prev, salaryBreakdown: payload }));
        onUpdate && onUpdate({ salaryBreakdown: payload });
        if (!silent) setShowSalaryModal(false);
        await calculateTotals();
        if (!silent) Alert.alert('Success', 'Salary breakdown updated');
        return true;
      } else {
        if (!silent) Alert.alert('Error', result?.error || 'Failed to update salary breakdown');
        return false;
      }
    } catch (error) {
      if (!silent) Alert.alert('Error', `Failed to update: ${error?.message || 'Unknown error'}`);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount, code = 'INR') => {
    try {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: code,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount || 0);
    } catch (_) {
      return `${amount?.toLocaleString?.() || 0} ${code}`;
    }
  };

  const renderCompactView = () => {
    const cur = groupTotals.current;
    const exp = groupTotals.expected;

    const block = (label, totals) => (
      <View style={styles.compactBlock}>
        {/* Total row */}
        <View style={styles.kvRow}>
          <Text style={styles.kvLabel}>{label} Total</Text>
          <Text style={styles.kvValue}>{formatCurrency(totals.total, displayCurrency)}/year</Text>
        </View>
        {/* Only render non-zero group rows */}
        {totals.fixed > 0 && (
          <View style={styles.kvRow}>
            <Text style={styles.kvLabel}>Fixed</Text>
            <Text style={styles.kvValue}>{formatCurrency(totals.fixed, displayCurrency)}</Text>
          </View>
        )}
        {totals.variable > 0 && (
          <View style={styles.kvRow}>
            <Text style={styles.kvLabel}>Variable</Text>
            <Text style={styles.kvValue}>{formatCurrency(totals.variable, displayCurrency)}</Text>
          </View>
        )}
        {totals.stock > 0 && (
          <View style={styles.kvRow}>
            <Text style={styles.kvLabel}>Stock</Text>
            <Text style={styles.kvValue}>{formatCurrency(totals.stock, displayCurrency)}</Text>
          </View>
        )}
      </View>
    );

    const curTotals = { total: salaryTotals.current, ...cur };
    const expTotals = { total: salaryTotals.expected, ...exp };

    // Use non-zero components to decide visibility and footer count
    const countNonZero = (list = []) => list.filter((x) => parseFloat(x.Amount || 0) > 0).length;
    const hasCur = countNonZero(localSalaryBreakdown.current) > 0 && curTotals.total > 0;
    const hasExp = countNonZero(localSalaryBreakdown.expected) > 0 && expTotals.total > 0;

    if (!hasCur && !hasExp) {
      return <Text style={styles.noDataText}>No salary information provided</Text>;
    }

    const nonZeroCount = countNonZero(localSalaryBreakdown.current) + countNonZero(localSalaryBreakdown.expected);

    return (
      <View style={styles.compactContainer}>
        {hasCur && block('Current', curTotals)}
        {hasExp && block('Expected', expTotals)}
        <View style={styles.kvRowMuted}>
          <Text style={styles.kvMutedText}>{`${nonZeroCount} component(s) • ${displayCurrency}`}</Text>
        </View>
      </View>
    );
  };

  const setComponentField = (context, index, field, value) => {
    setLocalSalaryBreakdown((prev) => {
      const next = { ...prev, [context]: [...(prev[context] || [])] };
      next[context][index] = { ...(next[context][index] || {}), [field]: value };
      return next;
    });
  };

  const addComponentRow = (context) => {
    setLocalSalaryBreakdown((prev) => ({
      ...prev,
      [context]: [
        ...(prev[context] || []),
        {
          ComponentID: salaryComponents?.[0]?.ComponentID || 1,
          Amount: 0,
          CurrencyID: getDefaultCurrencyId(currencies),
          Frequency: 'Yearly',
          Notes: '',
        },
      ],
    }));
  };

  const removeComponentRow = (context, index) => {
    setLocalSalaryBreakdown((prev) => {
      const arr = [...(prev[context] || [])];
      arr.splice(index, 1);
      return { ...prev, [context]: arr };
    });
  };

  const openPicker = (type, context, index) => setPickerState({ visible: true, type, context, index });
  const closePicker = () => setPickerState((prev) => ({ ...prev, visible: false }));

  const currentList = localSalaryBreakdown[editingContext] || [];

  const isFixedComponentId = (id) => categorize(getComponentById(id)?.Name) === 'fixed';
  const anotherFixedExists = (context, exceptIndex) => {
    const list = localSalaryBreakdown[context] || [];
    return list.some((row, i) => i !== exceptIndex && isFixedComponentId(row.ComponentID));
  };

  const renderInlineEditorBody = () => (
    <View style={{ flex: 1 }}>
      <View style={styles.segmented}>
        {['current', 'expected'].map((ctx) => (
          <TouchableOpacity key={ctx} onPress={() => setEditingContext(ctx)} style={[styles.segmentBtn, editingContext === ctx && styles.segmentBtnActive]}>
            <Text style={[styles.segmentText, editingContext === ctx && styles.segmentTextActive]}>{ctx === 'current' ? 'Current' : 'Expected'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
        {currentList.length === 0 && <Text style={styles.noDataText}>No components. Add one below.</Text>}
        {currentList.map((row, index) => {
          const comp = getComponentById(row.ComponentID);
          const curr = currencies.find((c) => c.CurrencyID === row.CurrencyID);
          return (
            <View key={`${editingContext}-${index}`} style={styles.rowCard}>
              <View style={styles.rowHeader}>
                <Text style={styles.rowTitle}>Component</Text>
                <TouchableOpacity onPress={() => removeComponentRow(editingContext, index)}>
                  <Ionicons name="trash-outline" size={18} color={colors.danger || '#FF3B30'} />
                </TouchableOpacity>
              </View>

              <View style={styles.kvRow}>
                <Text style={styles.kvLabel}>Component</Text>
                <TouchableOpacity style={styles.select} onPress={() => openPicker('component', editingContext, index)}>
                  <Text style={styles.selectText}>{comp?.Name || 'Select'}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.kvRow}>
                <Text style={styles.kvLabel}>Amount</Text>
                <TextInput style={[styles.fieldInput, { minWidth: 120, textAlign: 'right' }]} keyboardType="numeric" value={(row.Amount ?? '').toString()} onChangeText={(t) => setComponentField(editingContext, index, 'Amount', t)} placeholder="0" />
              </View>

              <View style={styles.kvRow}>
                <Text style={styles.kvLabel}>Currency</Text>
                <TouchableOpacity style={styles.select} onPress={() => openPicker('currency', editingContext, index)}>
                  <Text style={styles.selectText}>{curr?.Code || 'INR'}</Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.kvRow, { alignItems: 'flex-start' }]}> 
                <Text style={[styles.kvLabel, { paddingTop: 8 }]}>Frequency</Text>
                <View style={styles.freqContainer}>
                  {FREQUENCIES.map((fr) => (
                    <TouchableOpacity key={fr} style={[styles.freqBtn, row.Frequency === fr && styles.freqBtnActive]} onPress={() => setComponentField(editingContext, index, 'Frequency', fr)}>
                      <Text style={[styles.freqText, row.Frequency === fr && styles.freqTextActive]}>{fr}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.kvRow}>
                <Text style={styles.kvLabel}>Notes</Text>
                <TextInput style={[styles.fieldInput, { minWidth: 220, textAlign: 'right' }]} value={row.Notes || ''} onChangeText={(t) => setComponentField(editingContext, index, 'Notes', t)} placeholder="Optional" />
              </View>
            </View>
          );
        })}

        <TouchableOpacity style={styles.addBtn} onPress={() => addComponentRow(editingContext)}>
          <Ionicons name="add" size={18} color={colors.primary} />
          <Text style={styles.addBtnText}>Add Component</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Simple picker without filtering */}
      <Modal visible={pickerState.visible} transparent animationType="fade" onRequestClose={closePicker}>
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerCard}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>{pickerState.type === 'component' ? 'Select Component' : 'Select Currency'}</Text>
              <TouchableOpacity onPress={closePicker}>
                <Ionicons name="close" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={pickerState.type === 'component' ? salaryComponents : currencies}
              keyExtractor={(item, i) => `${pickerState.type}-${item.ComponentID || item.CurrencyID || i}`}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.pickerItem}
                  onPress={() => {
                    if (pickerState.type === 'component') {
                      if (categorize(item.Name) === 'fixed' && anotherFixedExists(pickerState.context, pickerState.index)) {
                        Alert.alert('Not allowed', 'Only one Fixed component is allowed.');
                        return;
                      }
                      setComponentField(pickerState.context, pickerState.index, 'ComponentID', item.ComponentID);
                    } else {
                      setComponentField(pickerState.context, pickerState.index, 'CurrencyID', item.CurrencyID);
                    }
                    closePicker();
                  }}
                >
                  <Text style={styles.pickerItemText}>{pickerState.type === 'component' ? item.Name : `${item.Code}${item.Name ? ' — ' + item.Name : ''}`}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );

  const renderEditor = () => (
    <View style={styles.modalContainer}>
      <View style={styles.modalHeader}>
        <TouchableOpacity onPress={() => setShowSalaryModal(false)}>
          <Ionicons name="close" size={24} color={colors.text || '#000000'} />
        </TouchableOpacity>
        <Text style={styles.modalTitle}>Edit Salary Breakdown</Text>
        <TouchableOpacity onPress={() => saveSalaryBreakdown(false)}>
          <Text style={[styles.addBtnText, { fontWeight: '600' }]}>Save</Text>
        </TouchableOpacity>
      </View>
      {loading ? (
        <View style={{ padding: 20 }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        renderInlineEditorBody()
      )}
    </View>
  );

  return (
    <View style={embedded ? null : styles.container}>
      {!embedded && (
        <View style={styles.sectionHeader}>
          <View style={styles.headerLeft}>
            <Ionicons name="cash" size={20} color={colors.primary || '#007AFF'} />
            <Text style={styles.sectionTitle}>Salary Breakdown</Text>
          </View>
          <TouchableOpacity style={styles.editButton} onPress={() => setShowSalaryModal(true)}>
            <Ionicons name="create" size={16} color={colors.primary || '#007AFF'} />
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
        </View>
      )}

      {compact ? renderCompactView() : null}

      <Modal visible={showSalaryModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowSalaryModal(false)}>
        {renderEditor()}
      </Modal>
    </View>
  );
});

export default SalaryBreakdownSection;

const styles = StyleSheet.create({
  container: { backgroundColor: colors.surface || '#FFFFFF', margin: 16, marginBottom: 8, padding: 20, borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3.84, elevation: 5 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: typography.sizes?.lg || 18, fontWeight: typography.weights?.bold || 'bold', color: colors.text || '#000' },
  editButton: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 8 },
  editButtonText: { fontSize: typography.sizes?.sm || 14, color: colors.primary || '#007AFF', fontWeight: typography.weights?.medium || '500' },

  compactContainer: { gap: 8 },
  compactBlock: { marginBottom: 6 },
  kvRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: (colors.border || '#E5E7EB') + '70' },
  kvLabel: { fontSize: typography.sizes?.xs || 12, color: colors.gray600 || '#6B7280', fontWeight: typography.weights?.medium || '500' },
  kvValue: { fontSize: typography.sizes?.sm || 14, color: colors.text || '#111827' },
  kvRowMuted: { paddingTop: 6 },
  kvMutedText: { fontSize: typography.sizes?.xs || 12, color: colors.gray500 || '#9CA3AF', fontStyle: 'italic' },

  modalContainer: { flex: 1, backgroundColor: colors.background || '#FFFFFF' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: 60, borderBottomWidth: 1, borderBottomColor: colors.border || '#E0E0E0' },
  modalTitle: { fontSize: typography.sizes?.lg || 18, fontWeight: typography.weights?.bold || 'bold', color: colors.text || '#000000' },

  segmented: { flexDirection: 'row', gap: 8, padding: 16, paddingBottom: 8 },
  segmentBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.border },
  segmentBtnActive: { backgroundColor: colors.primary + '15', borderColor: colors.primary },
  segmentText: { color: colors.text },
  segmentTextActive: { color: colors.primary, fontWeight: '600' },

  rowCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, marginHorizontal: 16, marginBottom: 12, backgroundColor: colors.surface },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  rowTitle: { fontSize: typography.sizes?.md || 16, fontWeight: '600', color: colors.text },

  select: { minWidth: 120, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  selectText: { color: colors.text },

  freqContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end', maxWidth: 240 },
  freqBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  freqBtnActive: { backgroundColor: colors.primary + '15', borderColor: colors.primary },
  freqText: { color: colors.text, fontSize: 12 },
  freqTextActive: { color: colors.primary, fontWeight: '600' },

  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 12, marginHorizontal: 16, marginTop: 4 },
  addBtnText: { color: colors.primary, fontSize: 14 },

  fieldInput: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, color: colors.text },

  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  pickerCard: { width: '100%', maxWidth: 360, backgroundColor: colors.surface, borderRadius: 12, padding: 12, maxHeight: '70%' },
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 8, paddingBottom: 12 },
  pickerTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  pickerItem: { paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  pickerItemText: { color: colors.text },
});