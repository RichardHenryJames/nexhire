import React, { useState, useEffect, useMemo } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../../styles/theme';
import nexhireAPI from '../../services/api';
// Removed ProfileSection import as we're not using it
import { useEditing } from './ProfileSection';

export default function SalaryBreakdownSection({ 
  profile, 
  setProfile, 
  editing, 
  onUpdate 
}) {
  const isEditing = useEditing(); // ? Use the same editing context as other sections
  const [showSalaryModal, setShowSalaryModal] = useState(false);
  const [salaryComponents, setSalaryComponents] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingContext, setEditingContext] = useState('current'); // 'current' or 'expected'
  const [displayCurrency, setDisplayCurrency] = useState('INR'); // ? User's preferred display currency
  const [exchangeRatesCache, setExchangeRatesCache] = useState({}); // ? Cache for exchange rates
  const [salaryTotals, setSalaryTotals] = useState({ current: 0, expected: 0 }); // ? Cache for calculated totals
  
  // ? FIX: Add local editing state for Salary Breakdown
  const [localEditing, setLocalEditing] = useState(false);
  
  // ? NEW: State for managing dropdown visibility
  const [showDropdowns, setShowDropdowns] = useState({});
  
  // ? FIX: Optimize local state for better text input performance
  const [localSalaryBreakdown, setLocalSalaryBreakdown] = useState({
    current: [],
    expected: []
  });

  // ? FIX: Memoize component amounts to prevent unnecessary recalculations
  const componentAmounts = useMemo(() => {
    const amounts = {};
    const components = [...(localSalaryBreakdown.current || []), ...(localSalaryBreakdown.expected || [])];
    
    components.forEach((component, index) => {
      const currency = currencies.find(c => c.CurrencyID === component.CurrencyID);
      const originalAmount = component.Amount || 0;
      const yearlyAmount = component.Frequency === 'Monthly' ? originalAmount * 12 : originalAmount;
      amounts[index] = yearlyAmount;
    });
    
    return amounts;
  }, [localSalaryBreakdown, currencies]);

  useEffect(() => {
    if (profile?.salaryBreakdown) {
      setLocalSalaryBreakdown(profile.salaryBreakdown);
    }
    loadReferenceData();
  }, [profile?.salaryBreakdown]);

  // ? FIX: Debounced calculation of totals to improve performance
  useEffect(() => {
    if (currencies.length > 0 && (localSalaryBreakdown.current.length > 0 || localSalaryBreakdown.expected.length > 0)) {
      const timeoutId = setTimeout(() => {
        calculateTotals();
      }, 300); // Debounce for 300ms
      
      return () => clearTimeout(timeoutId);
    }
  }, [displayCurrency, localSalaryBreakdown, currencies]);

  // ? NEW: Close all dropdowns when modal state changes
  useEffect(() => {
    if (!showSalaryModal) {
      setShowDropdowns({});
    }
  }, [showSalaryModal]);

  const loadReferenceData = async () => {
    try {
      const [componentsRes, currenciesRes] = await Promise.all([
        nexhireAPI.getSalaryComponents(),
        nexhireAPI.getCurrencies()
      ]);
      
      if (componentsRes.success) {
        setSalaryComponents(componentsRes.data);
      }
      
      if (currenciesRes.success) {
        setCurrencies(currenciesRes.data);
        
        // Set default display currency to INR if available
        const inrCurrency = currenciesRes.data.find(c => c.Code === 'INR');
        if (inrCurrency) {
          setDisplayCurrency('INR');
        } else {
          setDisplayCurrency(currenciesRes.data[0]?.Code || 'USD');
        }
      }
    } catch (error) {
      console.error('Error loading reference data:', error);
    }
  };

  // ? FIX: Use database exchange rates instead of public API
  const getExchangeRate = (fromCurrency, toCurrency) => {
    if (fromCurrency === toCurrency) return 1.0;
    
    const cacheKey = `${fromCurrency}-${toCurrency}`;
    const reverseCacheKey = `${toCurrency}-${fromCurrency}`;
    
    // Check if we have cached rate
    if (exchangeRatesCache[cacheKey]) {
      return exchangeRatesCache[cacheKey];
    }
    
    // Check if we have reverse rate (and can calculate)
    if (exchangeRatesCache[reverseCacheKey]) {
      const reverseRate = 1 / exchangeRatesCache[reverseCacheKey];
      setExchangeRatesCache(prev => ({
        ...prev,
        [cacheKey]: reverseRate
      }));
      return reverseRate;
    }
    
    // ? FIX: Use database exchange rates from currencies data
    const fromCurrencyData = currencies.find(c => c.Code === fromCurrency);
    const toCurrencyData = currencies.find(c => c.Code === toCurrency);
    
    if (fromCurrencyData && toCurrencyData) {
      // Convert through USD using database ExchangeRate
      // ExchangeRate column represents: 1 USD = X units of currency
      const fromRate = fromCurrencyData.ExchangeRate || 1.0;
      const toRate = toCurrencyData.ExchangeRate || 1.0;
      
      // Convert: amount in fromCurrency ? USD ? toCurrency
      const rate = fromRate / toRate;
      
      console.log(`?? Using database rate: ${fromCurrency} ? ${toCurrency} = ${rate} (via USD: ${fromRate}/${toRate})`);
      
      // Cache the calculated rate
      setExchangeRatesCache(prev => ({
        ...prev,
        [cacheKey]: rate,
        [reverseCacheKey]: 1 / rate
      }));
      
      return rate;
    }
    
    console.warn(`?? No database rate available for ${fromCurrency} ? ${toCurrency}, using fallback`);
    
    // ? Keep fallback rates as backup only
    const fallbackRates = {
      'USD-EUR': 0.92, 'EUR-USD': 1.09,
      'USD-GBP': 0.79, 'GBP-USD': 1.27,
      'USD-INR': 83.12, 'INR-USD': 0.012,
      'USD-CAD': 1.36, 'CAD-USD': 0.74,
      'USD-AUD': 1.52, 'AUD-USD': 0.66,
      'EUR-INR': 90.13, 'INR-EUR': 0.011,
      'GBP-INR': 105.21, 'INR-GBP': 0.0095,
      'EUR-GBP': 0.86, 'GBP-EUR': 1.16,
      'CAD-INR': 61.25, 'INR-CAD': 0.016,
      'AUD-INR': 54.68, 'INR-AUD': 0.018,
    };
    
    const fallbackRate = fallbackRates[cacheKey];
    if (fallbackRate) {
      console.log(`?? Using fallback rate: ${fromCurrency} ? ${toCurrency} = ${fallbackRate}`);
      setExchangeRatesCache(prev => ({
        ...prev,
        [cacheKey]: fallbackRate,
        [reverseCacheKey]: 1 / fallbackRate
      }));
      return fallbackRate;
    }
    
    // Return 1:1 as last resort
    console.warn(`?? No rate available for ${fromCurrency} ? ${toCurrency}, using 1:1`);
    return 1.0;
  };

  const convertCurrency = async (amount, fromCurrency, toCurrency) => {
    if (fromCurrency === toCurrency) return amount;
    const rate = await getExchangeRate(fromCurrency, toCurrency);
    return amount * rate;
  };

  const getTotalSalary = async (context) => {
    const components = localSalaryBreakdown[context] || [];
    let total = 0;
    
    for (const component of components) {
      const amount = component.Amount || 0;
      if (amount <= 0) continue;
      
      // Convert frequency to yearly
      let yearlyAmount = amount;
      if (component.Frequency === 'Monthly') {
        yearlyAmount = amount * 12;
      }
      
      // Convert currency to display currency
      const componentCurrency = currencies.find(c => c.CurrencyID === component.CurrencyID);
      let convertedAmount = yearlyAmount;
      
      if (componentCurrency && componentCurrency.Code !== displayCurrency) {
        convertedAmount = await convertCurrency(yearlyAmount, componentCurrency.Code, displayCurrency);
      }
      
      total += convertedAmount;
    }
    
    return total;
  };

  // ? FIX: Optimize text input updates with useCallback to prevent re-renders
  const updateSalaryComponent = React.useCallback((index, field, value) => {
    setLocalSalaryBreakdown(prev => ({
      ...prev,
      [editingContext]: prev[editingContext].map((component, i) => 
        i === index ? { ...component, [field]: value } : component
      )
    }));
  }, [editingContext]);

  const addSalaryComponent = () => {
    const existingComponents = localSalaryBreakdown[editingContext] || [];
    
    // ? PREVENT DUPLICATES: Find first available component type
    const availableComponent = salaryComponents.find(comp => {
      const usedComponentIDs = existingComponents.map(c => c.ComponentID);
      return !usedComponentIDs.includes(comp.ComponentID);
    });
    
    // If no available component types, don't add (all types already used)
    if (!availableComponent) {
      Alert.alert(
        'Component Limit Reached', 
        'You have already added all available component types (Fixed, Variable, Bonus, Stock).'
      );
      return;
    }
    
    // ? FIX: Set INR as default currency instead of USD
    const defaultCurrency = currencies.find(c => c.Code === 'INR') || currencies.find(c => c.Code === 'USD') || currencies[0];
    const newComponent = {
      ComponentID: availableComponent.ComponentID,
      Amount: 0,
      CurrencyID: defaultCurrency?.CurrencyID || 1,
      Frequency: 'Yearly',
      Notes: ''
    };

    setLocalSalaryBreakdown(prev => ({
      ...prev,
      [editingContext]: [...prev[editingContext], newComponent]
    }));
  };

  const removeSalaryComponent = (index) => {
    setLocalSalaryBreakdown(prev => ({
      ...prev,
      [editingContext]: prev[editingContext].filter((_, i) => i !== index)
    }));
  };

  const saveSalaryBreakdown = async () => {
    if (!profile?.UserID) {
      Alert.alert('Error', 'User ID not found');
      return;
    }

    const sanitizedBreakdown = {
      current: (localSalaryBreakdown.current || []).map(comp => ({
        ComponentID: parseInt(comp.ComponentID) || 1,
        Amount: parseFloat(comp.Amount) || 0,
        CurrencyID: parseInt(comp.CurrencyID) || 1,
        Frequency: comp.Frequency || 'Yearly',
        Notes: comp.Notes || ''
      })).filter(comp => comp.Amount > 0),
      
      expected: (localSalaryBreakdown.expected || []).map(comp => ({
        ComponentID: parseInt(comp.ComponentID) || 1,
        Amount: parseFloat(comp.Amount) || 0,
        CurrencyID: parseInt(comp.CurrencyID) || 1,
        Frequency: comp.Frequency || 'Yearly',
        Notes: comp.Notes || ''
      })).filter(comp => comp.Amount > 0)
    };

    setLoading(true);
    try {
      const result = await nexhireAPI.updateSalaryBreakdown(profile.UserID, sanitizedBreakdown);
      
      if (result.success) {
        setLocalSalaryBreakdown(sanitizedBreakdown);
        
        if (setProfile) {
          setProfile(prev => ({
            ...prev,
            salaryBreakdown: sanitizedBreakdown
          }));
        }
        
        if (onUpdate) {
          onUpdate({ salaryBreakdown: sanitizedBreakdown });
        }
        
        setShowSalaryModal(false);
        calculateTotals();
        
        const totalComponents = sanitizedBreakdown.current.length + sanitizedBreakdown.expected.length;
        Alert.alert(
          'Success', 
          `Salary breakdown updated successfully! ${totalComponents} component${totalComponents !== 1 ? 's' : ''} saved.`
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to update salary breakdown. Please try again.');
      }
    } catch (error) {
      Alert.alert('Error', `Failed to update salary breakdown: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const formatAmountWithCurrency = (amount, currencyCode = 'INR') => {
    const currency = currencies.find(c => c.Code === currencyCode);
    
    if (!currency) {
      return `${amount.toLocaleString()} ${currencyCode}`;
    }
    
    try {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount || 0);
    } catch (error) {
      return `${currency.Symbol || ''}${(amount || 0).toLocaleString()} ${currencyCode}`;
    }
  };

  const getComponentName = (componentId) => {
    const component = salaryComponents.find(c => c.ComponentID === componentId);
    return component?.ComponentName || 'Unknown';
  };

  // ? FIX: Simple text input component for salary modal - no complex debouncing
  const OptimizedTextInput = React.memo(({ value, onChangeText, placeholder, keyboardType, style }) => {
    const [localValue, setLocalValue] = useState(value?.toString() || '');
    const [isFocused, setIsFocused] = useState(false);

    // Sync with parent value when not focused
    useEffect(() => {
      if (!isFocused) {
        setLocalValue(value?.toString() || '');
      }
    }, [value, isFocused]);

    // Update parent only on blur (like ProfileField)
    const handleBlur = () => {
      setIsFocused(false);
      if (keyboardType === 'numeric') {
        const numericValue = localValue.replace(/[^0-9.]/g, '');
        onChangeText(parseFloat(numericValue) || 0);
      } else {
        onChangeText(localValue);
      }
    };

    const handleFocus = () => {
      setIsFocused(true);
    };

    return (
      <TextInput
        style={style}
        value={localValue}
        onChangeText={setLocalValue}  // ? Only updates local state
        onFocus={handleFocus}
        onBlur={handleBlur}          // ? Updates parent on blur
        placeholder={placeholder}
        keyboardType={keyboardType}
      />
    );
  });

  const renderSalaryDisplay = () => {
    const hasCurrentSalary = localSalaryBreakdown.current?.length > 0;
    const hasExpectedSalary = localSalaryBreakdown.expected?.length > 0;

    if (!hasCurrentSalary && !hasExpectedSalary) {
      return (
        <Text style={styles.noDataText}>
          No salary information provided
        </Text>
      );
    }

    return (
      <View style={styles.salaryDisplayContainer}>
        {/* Currency Display Toggle */}
        <View style={styles.currencyToggleContainer}>
          <Text style={styles.currencyToggleLabel}>View totals in:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.currencyToggleScroll}>
            <View style={styles.currencyToggleOptions}>
              {currencies.map((currency) => (
                <TouchableOpacity
                  key={currency.CurrencyID}
                  style={[
                    styles.currencyToggleOption,
                    displayCurrency === currency.Code && styles.currencyToggleOptionActive
                  ]}
                  onPress={() => setDisplayCurrency(currency.Code)}
                >
                  <Text style={[
                    styles.currencyToggleOptionText,
                    displayCurrency === currency.Code && styles.currencyToggleOptionTextActive
                  ]}>
                    {currency.Symbol} {currency.Code}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {hasCurrentSalary && (
          <View style={styles.salarySection}>
            <Text style={styles.salarySectionTitle}>Current Salary</Text>
            <Text style={styles.totalAmount}>
              {formatAmountWithCurrency(salaryTotals.current, displayCurrency)}/year
            </Text>
            
            <View style={styles.componentsContainer}>
              {localSalaryBreakdown.current.map((component, index) => {
                const currency = currencies.find(c => c.CurrencyID === component.CurrencyID);
                const originalAmount = component.Amount || 0;
                
                return (
                  <View key={index} style={styles.componentItem}>
                    <View style={styles.componentInfo}>
                      <Text style={styles.componentName}>
                        {getComponentName(component.ComponentID)}
                      </Text>
                      <Text style={styles.componentFrequency}>
                        {component.Frequency || 'Yearly'}
                      </Text>
                    </View>
                    <View style={styles.componentAmountContainer}>
                      <Text style={styles.componentAmount}>
                        {currency?.Symbol || '$'}{originalAmount.toLocaleString()}
                      </Text>
                      <Text style={styles.componentCurrency}>
                        {currency?.Code || 'USD'}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {hasExpectedSalary && (
          <View style={styles.salarySection}>
            <Text style={styles.salarySectionTitle}>Expected Salary</Text>
            <Text style={styles.totalAmount}>
              {formatAmountWithCurrency(salaryTotals.expected, displayCurrency)}/year
            </Text>
            
            <View style={styles.componentsContainer}>
              {localSalaryBreakdown.expected.map((component, index) => {
                const currency = currencies.find(c => c.CurrencyID === component.CurrencyID);
                const originalAmount = component.Amount || 0;
                
                return (
                  <View key={index} style={styles.componentItem}>
                    <View style={styles.componentInfo}>
                      <Text style={styles.componentName}>
                        {getComponentName(component.ComponentID)}
                      </Text>
                      <Text style={styles.componentFrequency}>
                        {component.Frequency || 'Yearly'}
                      </Text>
                    </View>
                    <View style={styles.componentAmountContainer}>
                      <Text style={styles.componentAmount}>
                        {currency?.Symbol || '$'}{originalAmount.toLocaleString()}
                      </Text>
                      <Text style={styles.componentCurrency}>
                        {currency?.Code || 'USD'}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </View>
    );
  };

  const renderSalaryEditor = () => {
    const components = localSalaryBreakdown[editingContext] || [];

    return (
      <View style={styles.editorContainer}>
        <View style={styles.contextSwitcher}>
          <TouchableOpacity
            style={[
              styles.contextButton,
              editingContext === 'current' && styles.contextButtonActive
            ]}
            onPress={() => setEditingContext('current')}
          >
            <Text style={[
              styles.contextButtonText,
              editingContext === 'current' && styles.contextButtonTextActive
            ]}>
              Current Salary
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.contextButton,
              editingContext === 'expected' && styles.contextButtonActive
            ]}
            onPress={() => setEditingContext('expected')}
          >
            <Text style={[
              styles.contextButtonText,
              editingContext === 'expected' && styles.contextButtonTextActive
            ]}>
              Expected Salary
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.componentsEditor}>
          {components.map((component, index) => (
            <View key={index} style={styles.componentEditor}>
              <View style={styles.componentHeader}>
                <Text style={styles.componentIndex}>Component {index + 1}</Text>
                <TouchableOpacity
                  onPress={() => removeSalaryComponent(index)}
                  style={styles.removeButton}
                >
                  <Ionicons name="close" size={16} color={colors.danger || '#FF3B30'} />
                </TouchableOpacity>
              </View>

              <View style={styles.componentFields}>
                {/* Component Type Dropdown */}
                <View style={styles.fieldContainer}>
                  <Text style={styles.fieldLabel}>Component Type *</Text>
                  {/* ? COMPACT: Horizontal pills instead of vertical list */}
                  <View style={styles.componentTypeContainer}>
                    {salaryComponents
                      .filter(comp => {
                        // ? PREVENT DUPLICATES: Filter out already used component types
                        const existingComponents = localSalaryBreakdown[editingContext] || [];
                        const usedComponentIDs = existingComponents
                          .filter((_, i) => i !== index) // Exclude current component
                          .map(c => c.ComponentID);
                        return !usedComponentIDs.includes(comp.ComponentID);
                      })
                      .map((comp) => (
                      <TouchableOpacity
                        key={comp.ComponentID}
                        style={[
                          styles.componentTypePill,
                          component.ComponentID === comp.ComponentID && styles.componentTypePillActive
                        ]}
                        onPress={() => updateSalaryComponent(index, 'ComponentID', comp.ComponentID)}
                      >
                        <Text style={[
                          styles.componentTypePillText,
                          component.ComponentID === comp.ComponentID && styles.componentTypePillTextActive
                        ]}>
                          {comp.ComponentName}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* ? NEW: Improved Amount with inline Currency and Frequency */}
                <View style={styles.fieldContainer}>
                  <Text style={styles.fieldLabel}>Amount *</Text>
                  <View style={styles.amountRowContainer}>
                    {/* Currency Prefix Dropdown */}
                    <View style={styles.currencyPrefixContainer}>
                      <TouchableOpacity
                        style={styles.currencyPrefixButton}
                        onPress={() => {
                          const dropdownKey = `currency_${index}`;
                          setShowDropdowns(prev => ({
                            ...prev,
                            [dropdownKey]: !prev[dropdownKey]
                          }));
                        }}
                      >
                        <Text style={styles.currencyPrefixText}>
                          {currencies.find(c => c.CurrencyID === component.CurrencyID)?.Symbol || '?'}
                          {currencies.find(c => c.CurrencyID === component.CurrencyID)?.Code || 'INR'}
                        </Text>
                        <Ionicons name="chevron-down" size={12} color={colors.gray600} />
                      </TouchableOpacity>
                      
                      {/* Currency Dropdown - positioned right where user clicks */}
                      {showDropdowns[`currency_${index}`] && (
                        <View style={styles.inlineDropdownMenu}>
                          <ScrollView style={styles.currencyDropdownScroll} nestedScrollEnabled>
                            {currencies.map((currency) => (
                              <TouchableOpacity
                                key={currency.CurrencyID}
                                style={[
                                  styles.currencyDropdownItem,
                                  component.CurrencyID === currency.CurrencyID && styles.currencyDropdownItemActive
                                ]}
                                onPress={() => {
                                  updateSalaryComponent(index, 'CurrencyID', currency.CurrencyID);
                                  setShowDropdowns(prev => ({
                                    ...prev,
                                    [`currency_${index}`]: false
                                  }));
                                }}
                              >
                                <Text style={[
                                  styles.currencyDropdownItemText,
                                  component.CurrencyID === currency.CurrencyID && styles.currencyDropdownItemTextActive
                                ]}>
                                  {currency.Symbol} {currency.Code}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </View>
                      )}
                    </View>

                    {/* Amount Input */}
                    <View style={styles.amountInputWrapper}>
                      <OptimizedTextInput
                        style={[
                          styles.inlineAmountInput,
                          (!component.Amount || component.Amount <= 0) && styles.amountInputError
                        ]}
                        value={component.Amount}
                        onChangeText={(value) => updateSalaryComponent(index, 'Amount', value)}
                        placeholder="0"
                        keyboardType="numeric"
                      />
                    </View>

                    {/* Frequency Dropdown - inline with amount */}
                    <View style={styles.frequencyPrefixContainer}>
                      <TouchableOpacity
                        style={styles.frequencyPrefixButton}
                        onPress={() => {
                          const dropdownKey = `frequency_${index}`;
                          setShowDropdowns(prev => ({
                            ...prev,
                            [dropdownKey]: !prev[dropdownKey]
                          }));
                        }}
                      >
                        <Text style={styles.frequencyPrefixText}>
                          /{(component.Frequency || 'Yearly') === 'Monthly' ? 'month' : 'year'}
                        </Text>
                        <Ionicons name="chevron-down" size={12} color={colors.gray600} />
                      </TouchableOpacity>
                      
                      {/* Frequency Dropdown */}
                      {showDropdowns[`frequency_${index}`] && (
                        <View style={styles.inlineDropdownMenu}>
                          {['Monthly', 'Yearly'].map((freq) => (
                            <TouchableOpacity
                              key={freq}
                              style={[
                                styles.frequencyDropdownItem,
                                (component.Frequency || 'Yearly') === freq && styles.frequencyDropdownItemActive
                              ]}
                              onPress={() => {
                                updateSalaryComponent(index, 'Frequency', freq);
                                setShowDropdowns(prev => ({
                                  ...prev,
                                  [`frequency_${index}`]: false
                                }));
                              }}
                            >
                              <Text style={[
                                styles.frequencyDropdownItemText,
                                (component.Frequency || 'Yearly') === freq && styles.frequencyDropdownItemTextActive
                              ]}>
                                /{freq === 'Monthly' ? 'month' : 'year'}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>
                  </View>
                  {(!component.Amount || component.Amount <= 0) && (
                    <Text style={styles.validationError}>Amount must be greater than 0</Text>
                  )}
                </View>
              </View>
            </View>
          ))}

          <TouchableOpacity
            style={styles.addComponentButton}
            onPress={addSalaryComponent}
          >
            <Ionicons name="add" size={20} color={colors.primary || '#007AFF'} />
            <Text style={styles.addComponentText}>Add Component</Text>
          </TouchableOpacity>
        </ScrollView>

        <View style={styles.editorActions}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => setShowSalaryModal(false)}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.saveButton, loading && styles.saveButtonDisabled]}
            onPress={saveSalaryBreakdown}
            disabled={loading}
          >
            <Text style={styles.saveButtonText}>
              {loading ? 'Saving...' : 'Save Breakdown'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // ? FIX: Use custom header with direct modal control instead of ProfileSection
  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <View style={styles.headerLeft}>
          <Ionicons name="cash" size={20} color={colors.primary || '#007AFF'} />
          <Text style={styles.sectionTitle}>Salary Breakdown</Text>
        </View>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => {
            console.log('?? Salary Breakdown Edit clicked - opening modal');
            setShowSalaryModal(true);
          }}
        >
          <Ionicons name="create" size={16} color={colors.primary || '#007AFF'} />
          <Text style={styles.editButtonText}>Edit</Text>
        </TouchableOpacity>
      </View>

      {renderSalaryDisplay()}

      <Modal
        visible={showSalaryModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSalaryModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowSalaryModal(false)}>
              <Ionicons name="close" size={24} color={colors.text || '#000000'} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Edit Salary Breakdown</Text>
            <View style={styles.modalHeaderSpacer} />
          </View>
          {renderSalaryEditor()}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  // ? FIX: Add container and header styles for custom header
  container: {
    backgroundColor: colors.surface || '#FFFFFF',
    margin: 16,
    marginBottom: 8,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: typography.sizes?.lg || 18,
    fontWeight: typography.weights?.bold || 'bold',
    color: colors.text || '#000000',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 8,
  },
  editButtonText: {
    fontSize: typography.sizes?.sm || 14,
    color: colors.primary || '#007AFF',
    fontWeight: typography.weights?.medium || '500',
  },
  // ? FIX: Remove custom container styles since we're using ProfileSection
  editModalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: colors.surface || '#F5F5F5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border || '#E0E0E0',
    marginBottom: 16,
  },
  editModalButtonText: {
    fontSize: typography.sizes?.sm || 14,
    color: colors.primary || '#007AFF',
    fontWeight: typography.weights?.medium || '500',
  },
  noDataText: {
    fontSize: typography.sizes?.sm || 14,
    color: colors.gray600 || colors.gray || '#666666',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 20,
  },
  salaryDisplayContainer: {
    gap: 16,
  },
  
  // Currency Toggle Styles
  currencyToggleContainer: {
    backgroundColor: colors.surface || '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border || '#E0E0E0',
  },
  currencyToggleLabel: {
    fontSize: typography.sizes?.sm || 14,
    fontWeight: typography.weights?.medium || '500',
    color: colors.gray600 || '#666666',
    marginBottom: 8,
  },
  currencyToggleScroll: {
    maxHeight: 40,
  },
  currencyToggleOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  currencyToggleOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border || '#E0E0E0',
    backgroundColor: colors.background || '#FFFFFF',
    minWidth: 70,
    alignItems: 'center',
  },
  currencyToggleOptionActive: {
    backgroundColor: colors.primary || '#007AFF',
    borderColor: colors.primary || '#007AFF',
  },
  currencyToggleOptionText: {
    fontSize: typography.sizes?.xs || 12,
    color: colors.text || '#000000',
    fontWeight: typography.weights?.medium || '500',
  },
  currencyToggleOptionTextActive: {
    color: colors.white || '#FFFFFF',
  },
  salarySection: {
    backgroundColor: colors.surface || '#F5F5F5',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border || '#E0E0E0',
  },
  salarySectionTitle: {
    fontSize: typography.sizes?.md || 16,
    fontWeight: typography.weights?.bold || 'bold',
    color: colors.text || '#000000',
    marginBottom: 8,
  },
  totalAmount: {
    fontSize: typography.sizes?.xl || 24,
    fontWeight: typography.weights?.bold || 'bold',
    color: colors.primary || '#007AFF',
    marginBottom: 8,
  },
  totalNote: {
    fontSize: typography.sizes?.xs || 12,
    color: colors.gray500 || '#999999',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  componentsContainer: {
    gap: 8,
  },
  componentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: (colors.border || '#E0E0E0') + '30',
  },
  componentInfo: {
    flex: 1,
  },
  componentName: {
    fontSize: typography.sizes?.sm || 14,
    color: colors.gray600 || colors.gray || '#666666',
    fontWeight: typography.weights?.medium || '500',
  },
  componentFrequency: {
    fontSize: typography.sizes?.xs || 12,
    color: colors.gray600 || colors.gray || '#666666',
    marginTop: 2,
  },
  componentAmountContainer: {
    alignItems: 'flex-end',
  },
  componentAmount: {
    fontSize: typography.sizes?.sm || 14,
    fontWeight: typography.weights?.bold || 'bold',
    color: colors.text || '#000000',
  },
  componentCurrency: {
    fontSize: typography.sizes?.xs || 12,
    color: colors.gray600 || colors.gray || '#666666',
    marginTop: 2,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background || '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: colors.border || '#E0E0E0',
  },
  modalTitle: {
    fontSize: typography.sizes?.lg || 18,
    fontWeight: typography.weights?.bold || 'bold',
    color: colors.text || '#000000',
  },
  modalHeaderSpacer: {
    width: 24,
  },
  editorContainer: {
    flex: 1,
    padding: 20,
  },
  contextSwitcher: {
    flexDirection: 'row',
    backgroundColor: colors.surface || '#F5F5F5',
    borderRadius: 8,
    padding: 4,
    marginBottom: 20,
  },
  contextButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
    alignItems: 'center',
  },
  contextButtonActive: {
    backgroundColor: colors.primary || '#007AFF',
  },
  contextButtonText: {
    fontSize: typography.sizes?.sm || 14,
    color: colors.gray600 || colors.gray || '#666666',
    fontWeight: typography.weights?.medium || '500',
  },
  contextButtonTextActive: {
    color: colors.white || '#FFFFFF',
  },
  componentsEditor: {
    flex: 1,
    zIndex: 1, // ? FIX: Lower z-index for scroll container so dropdowns appear above
  },
  componentEditor: {
    backgroundColor: colors.surface || '#F5F5F5',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border || '#E0E0E0',
    position: 'relative', // ? FIX: Ensure proper stacking context
    zIndex: 1,
  },
  componentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  componentIndex: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text || '#000',
  },
  removeButton: {
    padding: 8,
  },
  componentFields: {
    gap: 16,
  },
  fieldContainer: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: typography.sizes?.sm || 14,
    fontWeight: typography.weights?.medium || '500',
    color: colors.text || '#000000',
  },
  
  // ? NEW: Compact Component Type Styles
  componentTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  componentTypePill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border || '#E0E0E0',
    backgroundColor: colors.background || '#FFFFFF',
  },
  componentTypePillActive: {
    backgroundColor: colors.primary || '#007AFF',
    borderColor: colors.primary || '#007AFF',
  },
  componentTypePillText: {
    fontSize: typography.sizes?.sm || 14,
    color: colors.text || '#000000',
    fontWeight: typography.weights?.medium || '500',
  },
  componentTypePillTextActive: {
    color: colors.white || '#FFFFFF',
  },
  
  // ? NEW: Inline Amount Layout Styles  
  amountRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  currencyPrefixContainer: {
    position: 'relative',
    zIndex: 10000,
  },
  currencyPrefixButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border || '#E0E0E0',
    borderRadius: 6,
    backgroundColor: colors.surface || '#F5F5F5',
    minWidth: 75,
  },
  currencyPrefixText: {
    fontSize: typography.sizes?.sm || 14,
    color: colors.text || '#000000',
    fontWeight: typography.weights?.medium || '500',
  },
  inlineDropdownMenu: {
    position: 'absolute',
    top: 36,
    left: 0,
    right: 0,
    backgroundColor: colors.white || '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border || '#E0E0E0',
    borderRadius: 8,
    maxHeight: 150,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 20,
    zIndex: 10001,
  },
  amountInputWrapper: {
    flex: 1,
  },
  inlineAmountInput: {
    borderWidth: 1,
    borderColor: colors.border || '#E0E0E0',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: typography.sizes?.md || 16,
    color: colors.text || '#000000',
    backgroundColor: colors.white || '#FFFFFF',
    textAlign: 'center',
  },
  frequencyPrefixContainer: {
    position: 'relative',
    zIndex: 10000,
  },
  frequencyPrefixButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border || '#E0E0E0',
    borderRadius: 6,
    backgroundColor: colors.surface || '#F5F5F5',
    minWidth: 70,
  },
  frequencyPrefixText: {
    fontSize: typography.sizes?.sm || 14,
    color: colors.text || '#000000',
    fontWeight: typography.weights?.medium || '500',
  },
  frequencyDropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border || '#E0E0E0',
  },
  frequencyDropdownItemActive: {
    backgroundColor: colors.primary || '#007AFF',
  },
  frequencyDropdownItemText: {
    fontSize: typography.sizes?.sm || 14,
    color: colors.text || '#000000',
  },
  frequencyDropdownItemTextActive: {
    color: colors.white || '#FFFFFF',
  },
  
  // Keep existing styles but remove unused overlay styles
  compactAmountContainer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  compactAmountInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border || '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: typography.sizes?.md || 16,
    color: colors.text || '#000000',
    backgroundColor: colors.white || '#FFFFFF',
  },
  currencyDropdownScroll: {
    maxHeight: 150,
  },
  dropdownContainer: {
    borderWidth: 1,
    borderColor: colors.border || '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  dropdownOption: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  dropdownOptionActive: {
    backgroundColor: colors.primary + '10',
  },
  dropdownOptionText: {
    fontSize: typography.sizes?.sm || 14,
    color: colors.text || '#000000',
    fontWeight: typography.weights?.normal || '400',
  },
  dropdownOptionTextActive: {
    color: colors.primary || '#007AFF',
    fontWeight: typography.weights?.medium || '500',
  },
  addComponentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary || '#007AFF',
    backgroundColor: (colors.primary || '#007AFF') + '10',
    marginTop: 16,
  },
  addComponentText: {
    fontSize: typography.sizes?.sm || 14,
    color: colors.primary || '#007AFF',
    fontWeight: typography.weights?.medium || '500',
  },
  editorActions: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border || '#E0E0E0',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border || '#E0E0E0',
    backgroundColor: colors.background || '#FFFFFF',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: typography.sizes?.sm || 14,
    color: colors.text || '#000000',
    fontWeight: typography.weights?.medium || '500',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.primary || '#007AFF',
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: colors.gray300 || '#CCCCCC',
  },
  saveButtonText: {
    fontSize: typography.sizes?.sm || 14,
    color: colors.white || '#FFFFFF',
    fontWeight: typography.weights?.bold || 'bold',
  },
  validationError: {
    fontSize: typography.sizes?.xs || 12,
    color: colors.danger || '#FF3B30',
    marginTop: 4,
  },
  amountInputError: {
    borderColor: colors.danger || '#FF3B30',
  },
});