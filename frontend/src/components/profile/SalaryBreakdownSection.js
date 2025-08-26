import React, { useState, useEffect } from 'react';
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

export default function SalaryBreakdownSection({ 
  profile, 
  setProfile, 
  editing, 
  onUpdate 
}) {
  const [showSalaryModal, setShowSalaryModal] = useState(false);
  const [salaryComponents, setSalaryComponents] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingContext, setEditingContext] = useState('current'); // 'current' or 'expected'
  const [displayCurrency, setDisplayCurrency] = useState('INR'); // ? NEW: User's preferred display currency (default INR)
  const [exchangeRatesCache, setExchangeRatesCache] = useState({}); // ? Cache for exchange rates
  const [salaryTotals, setSalaryTotals] = useState({ current: 0, expected: 0 }); // ? Cache for calculated totals
  const [localEditing, setLocalEditing] = useState(false); // ? NEW: Local editing state
  
  // Local state for salary breakdown
  const [localSalaryBreakdown, setLocalSalaryBreakdown] = useState({
    current: [],
    expected: []
  });

  useEffect(() => {
    if (profile?.salaryBreakdown) {
      setLocalSalaryBreakdown(profile.salaryBreakdown);
    }
    loadReferenceData();
  }, [profile?.salaryBreakdown]);

  // ? NEW: Recalculate totals when currency changes or salary data changes
  useEffect(() => {
    if (currencies.length > 0 && (localSalaryBreakdown.current.length > 0 || localSalaryBreakdown.expected.length > 0)) {
      calculateTotals();
    }
  }, [displayCurrency, localSalaryBreakdown, currencies]);

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
        console.log('?? Loaded currencies from database:', currenciesRes.data);
        
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

  // ? SMART: Get exchange rate for specific currency pair using Frankfurter API
  const getExchangeRate = async (fromCurrency, toCurrency) => {
    if (fromCurrency === toCurrency) return 1.0;
    
    const cacheKey = `${fromCurrency}-${toCurrency}`;
    const reverseCacheKey = `${toCurrency}-${fromCurrency}`;
    
    // Check if we have cached rate
    if (exchangeRatesCache[cacheKey]) {
      console.log(`?? Using cached rate: ${fromCurrency} ? ${toCurrency} = ${exchangeRatesCache[cacheKey]}`);
      return exchangeRatesCache[cacheKey];
    }
    
    // Check if we have reverse rate (and can calculate)
    if (exchangeRatesCache[reverseCacheKey]) {
      const reverseRate = 1 / exchangeRatesCache[reverseCacheKey];
      console.log(`?? Using reverse cached rate: ${fromCurrency} ? ${toCurrency} = ${reverseRate}`);
      
      // Cache the calculated rate
      setExchangeRatesCache(prev => ({
        ...prev,
        [cacheKey]: reverseRate
      }));
      
      return reverseRate;
    }
    
    try {
      console.log(`?? Fetching live rate: ${fromCurrency} ? ${toCurrency}`);
      
      // Use Frankfurter API with smart from/to params
      const response = await fetch(`https://api.frankfurter.app/latest?from=${fromCurrency}&to=${toCurrency}`);
      
      if (response.ok) {
        const data = await response.json();
        const rate = data.rates[toCurrency];
        
        if (rate) {
          console.log(`?? Live rate fetched: ${fromCurrency} ? ${toCurrency} = ${rate}`);
          
          // Cache both directions
          setExchangeRatesCache(prev => ({
            ...prev,
            [cacheKey]: rate,
            [reverseCacheKey]: 1 / rate
          }));
          
          return rate;
        } else {
          throw new Error(`Rate not found in response for ${toCurrency}`);
        }
      } else {
        throw new Error(`Frankfurter API responded with ${response.status}`);
      }
    } catch (error) {
      console.warn(`?? Failed to fetch rate ${fromCurrency} ? ${toCurrency}:`, error.message);
      
      // Fallback rates for common conversions
      const fallbackRates = {
        'USD-EUR': 0.92, 'EUR-USD': 1.09,
        'USD-GBP': 0.79, 'GBP-USD': 1.27,
        'USD-INR': 83.12, 'INR-USD': 0.012,
        'USD-CAD': 1.36, 'CAD-USD': 0.74,
        'USD-AUD': 1.52, 'AUD-USD': 0.66,
        'EUR-INR': 90.13, 'INR-EUR': 0.011,
        'GBP-INR': 105.21, 'INR-GBP': 0.0095,
      };
      
      const fallbackRate = fallbackRates[cacheKey];
      if (fallbackRate) {
        console.log(`?? Using fallback rate: ${fromCurrency} ? ${toCurrency} = ${fallbackRate}`);
        
        // Cache the fallback rate
        setExchangeRatesCache(prev => ({
          ...prev,
          [cacheKey]: fallbackRate
        }));
        
        return fallbackRate;
      }
      
      // Return 1:1 as last resort
      console.warn(`?? No fallback rate available, using 1:1 for ${fromCurrency} ? ${toCurrency}`);
      return 1.0;
    }
  };

  // ? SMART: Currency conversion using on-demand exchange rates
  const convertCurrency = async (amount, fromCurrency, toCurrency) => {
    if (fromCurrency === toCurrency) return amount;
    
    const rate = await getExchangeRate(fromCurrency, toCurrency);
    const convertedAmount = amount * rate;
    
    console.log(`?? Converted ${amount} ${fromCurrency} ? ${convertedAmount.toFixed(2)} ${toCurrency} (rate: ${rate})`);
    
    return convertedAmount;
  };

  // ? ENHANCED: Get total salary with smart async currency conversion
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
      
      // Convert currency to display currency using smart API
      const componentCurrency = currencies.find(c => c.CurrencyID === component.CurrencyID);
      let convertedAmount = yearlyAmount;
      
      if (componentCurrency && componentCurrency.Code !== displayCurrency) {
        convertedAmount = await convertCurrency(yearlyAmount, componentCurrency.Code, displayCurrency);
      }
      
      total += convertedAmount;
    }
    
    return total;
  };

  // ? NEW: Calculate totals for both current and expected salary
  const calculateTotals = async () => {
    try {
      const [currentTotal, expectedTotal] = await Promise.all([
        getTotalSalary('current'),
        getTotalSalary('expected')
      ]);
      
      setSalaryTotals({
        current: currentTotal,
        expected: expectedTotal
      });
    } catch (error) {
      console.error('Error calculating salary totals:', error);
      setSalaryTotals({ current: 0, expected: 0 });
    }
  };

  const addSalaryComponent = () => {
    const defaultCurrency = currencies.find(c => c.Code === 'USD') || currencies[0];
    const newComponent = {
      ComponentID: salaryComponents[0]?.ComponentID || 1,
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

  const updateSalaryComponent = (index, field, value) => {
    setLocalSalaryBreakdown(prev => ({
      ...prev,
      [editingContext]: prev[editingContext].map((component, i) => 
        i === index ? { ...component, [field]: value } : component
      )
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

    // Enhanced validation with better user feedback
    const validateComponents = (components, context) => {
      for (let i = 0; i < components.length; i++) {
        const comp = components[i];
        
        // Check ComponentID
        if (!comp.ComponentID) {
          Alert.alert(
            'Validation Error', 
            `${context} salary component ${i + 1}: Please select a component type (Fixed, Variable, Bonus, or Stock).`
          );
          return false;
        }
        
        // Check Amount - must be greater than 0
        if (!comp.Amount || comp.Amount <= 0) {
          Alert.alert(
            'Validation Error', 
            `${context} salary component ${i + 1}: Amount must be greater than 0. Please enter a valid amount.`
          );
          return false;
        }
        
        // Check CurrencyID
        if (!comp.CurrencyID) {
          Alert.alert(
            'Validation Error', 
            `${context} salary component ${i + 1}: Please select a currency.`
          );
          return false;
        }
      }
      return true;
    };

    // Skip validation if no components (allow empty salary breakdown)
    const hasCurrentComponents = localSalaryBreakdown.current && localSalaryBreakdown.current.length > 0;
    const hasExpectedComponents = localSalaryBreakdown.expected && localSalaryBreakdown.expected.length > 0;

    // Validate only if components exist
    if (hasCurrentComponents && !validateComponents(localSalaryBreakdown.current, 'Current')) return;
    if (hasExpectedComponents && !validateComponents(localSalaryBreakdown.expected, 'Expected')) return;

    // Enhanced data sanitization with better type handling
    const sanitizedBreakdown = {
      current: (localSalaryBreakdown.current || []).map(comp => {
        const sanitized = {
          ComponentID: parseInt(comp.ComponentID) || 1,
          Amount: parseFloat(comp.Amount) || 0,
          CurrencyID: parseInt(comp.CurrencyID) || 1,
          Frequency: comp.Frequency || 'Yearly',
          Notes: comp.Notes || ''
        };
        
        console.log('?? Sanitizing current component:', comp, '?', sanitized);
        return sanitized;
      }).filter(comp => comp.Amount > 0), // Filter out zero amounts
      
      expected: (localSalaryBreakdown.expected || []).map(comp => {
        const sanitized = {
          ComponentID: parseInt(comp.ComponentID) || 1,
          Amount: parseFloat(comp.Amount) || 0,
          CurrencyID: parseInt(comp.CurrencyID) || 1,
          Frequency: comp.Frequency || 'Yearly',
          Notes: comp.Notes || ''
        };
        
        console.log('?? Sanitizing expected component:', comp, '?', sanitized);
        return sanitized;
      }).filter(comp => comp.Amount > 0) // Filter out zero amounts
    };

    setLoading(true);
    try {
      console.log('?? Saving salary breakdown:', JSON.stringify(sanitizedBreakdown, null, 2));
      
      const result = await nexhireAPI.updateSalaryBreakdown(profile.UserID, sanitizedBreakdown);
      
      console.log('?? Save result:', result);
      
      if (result.success) {
        // Update local state with sanitized data
        setLocalSalaryBreakdown(sanitizedBreakdown);
        
        // Update parent profile state
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
        
        // Recalculate totals after save
        calculateTotals();
        
        // Show success message with details
        const totalComponents = sanitizedBreakdown.current.length + sanitizedBreakdown.expected.length;
        Alert.alert(
          'Success', 
          `Salary breakdown updated successfully! ${totalComponents} component${totalComponents !== 1 ? 's' : ''} saved.`
        );
      } else {
        console.error('?? Save failed:', result.error);
        Alert.alert('Error', result.error || 'Failed to update salary breakdown. Please try again.');
      }
    } catch (error) {
      console.error('?? Save exception:', error);
      Alert.alert('Error', `Failed to update salary breakdown: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  // ? NEW: Format amount with proper currency symbol
  const formatAmountWithCurrency = (amount, currencyCode = 'INR') => {
    const currency = currencies.find(c => c.Code === currencyCode);
    
    if (!currency) {
      return `${amount.toLocaleString()} ${currencyCode}`;
    }
    
    const currencyConfig = {
      'USD': { locale: 'en-US' },
      'EUR': { locale: 'de-DE' },
      'GBP': { locale: 'en-GB' },
      'INR': { locale: 'en-IN' },
      'CAD': { locale: 'en-CA' },
      'AUD': { locale: 'en-AU' },
    };
    
    const config = currencyConfig[currencyCode] || { locale: 'en-US' };
    
    try {
      return new Intl.NumberFormat(config.locale, {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount || 0);
    } catch (error) {
      // Fallback if currency formatting fails
      return `${currency.Symbol || ''}${(amount || 0).toLocaleString()} ${currencyCode}`;
    }
  };

  const formatAmount = (amount) => {
    // Use the user's preferred display currency
    return formatAmountWithCurrency(amount, displayCurrency);
  };

  const getComponentName = (componentId) => {
    const component = salaryComponents.find(c => c.ComponentID === componentId);
    return component?.ComponentName || 'Unknown';
  };

  // ? NEW: Validation helper to check for errors
  const hasValidationErrors = () => {
    const allComponents = [
      ...(localSalaryBreakdown.current || []),
      ...(localSalaryBreakdown.expected || [])
    ];
    
    return allComponents.some(comp => 
      !comp.ComponentID || 
      !comp.Amount || 
      comp.Amount <= 0 || 
      !comp.CurrencyID
    );
  };

  const renderSalaryDisplay = () => {
    const hasCurrentSalary = localSalaryBreakdown.current?.length > 0;
    const hasExpectedSalary = localSalaryBreakdown.expected?.length > 0;

    if (!editing && !hasCurrentSalary && !hasExpectedSalary) {
      return (
        <Text style={styles.noDataText}>
          No salary information provided
        </Text>
      );
    }

    return (
      <View style={styles.salaryDisplayContainer}>
        {/* ? NEW: Currency Display Toggle */}
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
            <Text style={styles.totalNote}>
              (All amounts converted to {displayCurrency} annually using live exchange rates)
            </Text>
            <SalaryComponentsList 
              components={localSalaryBreakdown.current}
              displayCurrency={displayCurrency}
              currencies={currencies}
              getComponentName={getComponentName}
              convertCurrency={convertCurrency}
            />
          </View>
        )}

        {hasExpectedSalary && (
          <View style={styles.salarySection}>
            <Text style={styles.salarySectionTitle}>Expected Salary</Text>
            <Text style={styles.totalAmount}>
              {formatAmountWithCurrency(salaryTotals.expected, displayCurrency)}/year
            </Text>
            <Text style={styles.totalNote}>
              (All amounts converted to {displayCurrency} annually using live exchange rates)
            </Text>
            <SalaryComponentsList 
              components={localSalaryBreakdown.expected}
              displayCurrency={displayCurrency}
              currencies={currencies}
              getComponentName={getComponentName}
              convertCurrency={convertCurrency}
            />
          </View>
        )}
      </View>
    );
  };

  // ? NEW: Separate component for rendering salary components list
  const SalaryComponentsList = ({ components, displayCurrency, currencies, getComponentName, convertCurrency }) => {
    const [componentAmounts, setComponentAmounts] = useState({});

    useEffect(() => {
      const convertComponentAmounts = async () => {
        const convertedAmounts = {};
        
        for (let i = 0; i < components.length; i++) {
          const component = components[i];
          const currency = currencies.find(c => c.CurrencyID === component.CurrencyID);
          const originalAmount = component.Amount || 0;
          const yearlyAmount = component.Frequency === 'Monthly' ? originalAmount * 12 : originalAmount;
          
          if (currency && currency.Code !== displayCurrency) {
            const convertedAmount = await convertCurrency(yearlyAmount, currency.Code, displayCurrency);
            convertedAmounts[i] = convertedAmount;
          } else {
            convertedAmounts[i] = yearlyAmount;
          }
        }
        
        setComponentAmounts(convertedAmounts);
      };

      if (components.length > 0) {
        convertComponentAmounts();
      }
    }, [components, displayCurrency, currencies]);

    return (
      <View style={styles.componentsContainer}>
        {components.map((component, index) => {
          const currency = currencies.find(c => c.CurrencyID === component.CurrencyID);
          const originalAmount = component.Amount || 0;
          const convertedAmount = componentAmounts[index] || 0;
          
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
                {currency?.Code !== displayCurrency && (
                  <Text style={styles.componentConverted}>
                    ? {formatAmountWithCurrency(convertedAmount, displayCurrency)}/yr
                  </Text>
                )}
              </View>
            </View>
          );
        })}
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
                  <View style={styles.dropdownContainer}>
                    {salaryComponents.map((comp) => (
                      <TouchableOpacity
                        key={comp.ComponentID}
                        style={[
                          styles.dropdownOption,
                          component.ComponentID === comp.ComponentID && styles.dropdownOptionActive
                        ]}
                        onPress={() => updateSalaryComponent(index, 'ComponentID', comp.ComponentID)}
                      >
                        <Text style={[
                          styles.dropdownOptionText,
                          component.ComponentID === comp.ComponentID && styles.dropdownOptionTextActive
                        ]}>
                          {comp.ComponentName}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Currency and Amount Row */}
                <View style={styles.fieldContainer}>
                  <Text style={styles.fieldLabel}>Amount *</Text>
                  <View style={styles.amountRow}>
                    {/* Currency Dropdown */}
                    <View style={styles.currencyContainer}>
                      <Text style={styles.currencyLabel}>Currency</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.currencyScroll}>
                        <View style={styles.currencyDropdown}>
                          {currencies.map((currency) => (
                            <TouchableOpacity
                              key={currency.CurrencyID}
                              style={[
                                styles.currencyOption,
                                component.CurrencyID === currency.CurrencyID && styles.currencyOptionActive
                              ]}
                              onPress={() => updateSalaryComponent(index, 'CurrencyID', currency.CurrencyID)}
                            >
                              <Text style={[
                                styles.currencyOptionText,
                                component.CurrencyID === currency.CurrencyID && styles.currencyOptionTextActive
                              ]}>
                                {currency.Symbol} {currency.Code}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </ScrollView>
                    </View>

                    {/* Amount Input with Currency Symbol and Validation */}
                    <View style={styles.amountContainer}>
                      <Text style={styles.amountLabel}>Amount</Text>
                      <View style={[
                        styles.amountInputContainer,
                        (!component.Amount || component.Amount <= 0) && styles.amountInputError
                      ]}>
                        <Text style={styles.currencySymbol}>
                          {currencies.find(c => c.CurrencyID === component.CurrencyID)?.Symbol || '$'}
                        </Text>
                        <TextInput
                          style={styles.amountInput}
                          value={component.Amount?.toString() || ''}
                          onChangeText={(text) => {
                            const numericValue = text.replace(/[^0-9.]/g, '');
                            updateSalaryComponent(index, 'Amount', parseFloat(numericValue) || 0);
                          }}
                          placeholder="0"
                          keyboardType="numeric"
                        />
                      </View>
                      {(!component.Amount || component.Amount <= 0) && (
                        <Text style={styles.validationError}>Amount must be greater than 0</Text>
                      )}
                    </View>
                  </View>
                </View>

                {/* Frequency Selection */}
                <View style={styles.fieldContainer}>
                  <Text style={styles.fieldLabel}>Frequency *</Text>
                  <View style={styles.frequencyContainer}>
                    {['Monthly', 'Yearly'].map((freq) => (
                      <TouchableOpacity
                        key={freq}
                        style={[
                          styles.frequencyOption,
                          (component.Frequency || 'Yearly') === freq && styles.frequencyOptionActive
                        ]}
                        onPress={() => updateSalaryComponent(index, 'Frequency', freq)}
                      >
                        <Text style={[
                          styles.frequencyOptionText,
                          (component.Frequency || 'Yearly') === freq && styles.frequencyOptionTextActive
                        ]}>
                          {freq}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Notes */}
                <View style={styles.fieldContainer}>
                  <Text style={styles.fieldLabel}>Notes (Optional)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={component.Notes || ''}
                    onChangeText={(text) => updateSalaryComponent(index, 'Notes', text)}
                    placeholder="Add notes about this component"
                    multiline
                  />
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
          
          {/* Enhanced save button with validation state */}
          <TouchableOpacity
            style={[
              styles.saveButton, 
              (loading || hasValidationErrors()) && styles.saveButtonDisabled
            ]}
            onPress={saveSalaryBreakdown}
            disabled={loading || hasValidationErrors()}
          >
            <Text style={[
              styles.saveButtonText,
              hasValidationErrors() && styles.saveButtonTextDisabled
            ]}>
              {loading ? 'Saving...' : hasValidationErrors() ? 'Fix Errors to Save' : 'Save Breakdown'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="cash" size={20} color={colors.primary || '#007AFF'} />
          <Text style={styles.title}>Salary Breakdown</Text>
        </View>
        {!editing && (
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => setLocalEditing(!localEditing)}
          >
            <Ionicons name="create" size={16} color={colors.primary || '#007AFF'} />
            <Text style={styles.editButtonText}>{localEditing ? 'Done' : 'Edit'}</Text>
          </TouchableOpacity>
        )}
        {(editing || localEditing) && (
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => setShowSalaryModal(true)}
          >
            <Ionicons name="create" size={16} color={colors.primary || '#007AFF'} />
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
        )}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
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
  
  // ? NEW: Currency Toggle Styles
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
  componentConverted: {
    fontSize: typography.sizes?.xs || 11,
    color: colors.primary || '#007AFF',
    marginTop: 2,
    fontWeight: typography.weights?.medium || '500',
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
  },
  componentEditor: {
    backgroundColor: colors.surface || '#F5F5F5',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border || '#E0E0E0',
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
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  currencyContainer: {
    flex: 1,
  },
  currencyLabel: {
    fontSize: typography.sizes?.sm || 14,
    fontWeight: typography.weights?.medium || '500',
    color: colors.text || '#000000',
    marginBottom: 4,
  },
  currencyScroll: {
    maxHeight: 40,
  },
  currencyDropdown: {
    flexDirection: 'row',
    gap: 8,
  },
  currencyOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border || '#E0E0E0',
    backgroundColor: colors.background || '#FFFFFF',
    minWidth: 70,
    alignItems: 'center',
  },
  currencyOptionActive: {
    backgroundColor: colors.primary || '#007AFF',
    borderColor: colors.primary || '#007AFF',
  },
  currencyOptionText: {
    fontSize: typography.sizes?.sm || 14,
    color: colors.text || '#000000',
    fontWeight: typography.weights?.medium || '500',
  },
  currencyOptionTextActive: {
    color: colors.white || '#FFFFFF',
  },
  amountContainer: {
    flex: 2,
  },
  amountLabel: {
    fontSize: typography.sizes?.sm || 14,
    fontWeight: typography.weights?.medium || '500',
    color: colors.text || '#000000',
    marginBottom: 4,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border || '#E0E0E0',
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.white || '#FFFFFF',
  },
  amountInputError: {
    borderColor: colors.danger || '#FF3B30',
  },
  currencySymbol: {
    fontSize: typography.sizes?.sm || 14,
    color: colors.text || '#000000',
    marginRight: 8,
  }
});