import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, Platform, StyleSheet } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../styles/theme';

/**
 * Cross-platform DatePicker component
 * 
 * @param {Object} props
 * @param {string} props.label - Label for the date picker
 * @param {Date|string|null} props.value - Selected date (Date object, ISO string, or null)
 * @param {Function} props.onChange - Callback when date changes (receives ISO string)
 * @param {string} props.placeholder - Placeholder text
 * @param {Date} props.minimumDate - Minimum selectable date
 * @param {Date} props.maximumDate - Maximum selectable date
 * @param {boolean} props.required - Whether field is required
 * @param {string} props.mode - 'date' | 'time' | 'datetime'
 * @param {string} props.error - Error message to display
 * @param {boolean} props.noMargin - If true, removes bottom margin (useful when wrapped in parent container)
 * @param {object} props.buttonStyle - Custom style object for the button (e.g., to match parent input padding)
 */
export default function DatePicker({
  label,
  value,
  onChange,
  placeholder = 'Select date',
  minimumDate,
  maximumDate,
  required = false,
  mode = 'date',
  error,
  noMargin = false,
  buttonStyle,
  labelStyle,
  requiredStyle,
  textStyle,
  placeholderStyle,
  errorTextStyle,
  textColor,
  placeholderTextColor,
  iconColor,
  placeholderIconColor,
  pickerTextColor,
  containerStyle,
}) {
  const [show, setShow] = useState(false);
  const webInputRef = useRef(null);
  
  // Convert value to Date object
  const dateValue = value 
    ? (value instanceof Date ? value : new Date(value))
    : null;

  const handleChange = (event, selectedDate) => {
    // On Android, picker closes automatically
    if (Platform.OS === 'android') {
      setShow(false);
    }
    
    if (selectedDate) {
      // Return ISO string format (YYYY-MM-DD)
      const isoString = selectedDate.toISOString().split('T')[0];
      onChange(isoString);
    }
  };

  const formatDate = (date) => {
    if (!date) return '';
    
    const d = date instanceof Date ? date : new Date(date);
    
    if (mode === 'time') {
      return d.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    }
    
    if (mode === 'datetime') {
      return d.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    
    // Default: date only
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const displayValue = dateValue ? formatDate(dateValue) : '';
  const resolvedTextColor = displayValue
    ? (textColor ?? colors.textPrimary)
    : (placeholderTextColor ?? colors.textLight);
  const resolvedIconColor = displayValue
    ? (iconColor ?? colors.textPrimary)
    : (placeholderIconColor ?? colors.textLight);

  const toPx = (value) => (typeof value === 'number' ? `${value}px` : value);

  const normalizeWebButtonStyle = (style) => {
    if (!style || typeof style !== 'object') return {};

    // Allow passing either web CSS style keys or RN style keys.
    const web = { ...style };

    // Convert RN border props into CSS border shorthand.
    const borderWidth = style.borderWidth;
    const borderColor = style.borderColor;
    if (borderWidth != null || borderColor != null) {
      const width = borderWidth ?? 1;
      const color = borderColor ?? colors.border;
      web.border = `${width}px solid ${color}`;
      delete web.borderWidth;
      delete web.borderColor;
    }

    if (style.borderRadius != null) {
      web.borderRadius = toPx(style.borderRadius);
    }
    if (style.padding != null) {
      web.padding = toPx(style.padding);
    }
    if (style.paddingVertical != null) {
      web.paddingTop = toPx(style.paddingVertical);
      web.paddingBottom = toPx(style.paddingVertical);
      delete web.paddingVertical;
    }
    if (style.paddingHorizontal != null) {
      web.paddingLeft = toPx(style.paddingHorizontal);
      web.paddingRight = toPx(style.paddingHorizontal);
      delete web.paddingHorizontal;
    }

    // RN uses backgroundColor; CSS accepts it too.
    return web;
  };

  // ? FIX: For web, render actual HTML input that's clickable
  if (Platform.OS === 'web') {
    const normalizedWebButtonStyle = normalizeWebButtonStyle(buttonStyle);

    return (
      <View style={[styles.container, noMargin && { marginBottom: 0 }, containerStyle]}>
        {label && (
          <Text style={[styles.label, labelStyle]}>
            {label}
            {required && <Text style={[styles.required, requiredStyle]}> *</Text>}
          </Text>
        )}
        
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: colors.white,
            border: `1px solid ${error ? colors.error : colors.border}`,
            borderRadius: '8px',
            padding: '16px', // Default padding
            cursor: 'pointer',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
            // ? Apply custom styles (will override defaults like padding)
            ...normalizedWebButtonStyle,
          }}
          onClick={() => webInputRef.current?.showPicker?.()}
        >
          <div style={{ display: 'flex', alignItems: 'center', flex: 1, gap: '10px' }}>
            <Ionicons 
              name="calendar-outline" 
              size={20} 
              color={resolvedIconColor} 
            />
            <span style={{
              fontSize: `${typography.sizes.base}px`,
              fontWeight: typography.weights.normal,
              color: resolvedTextColor,
              flex: 1,
              fontFamily: 'inherit',
              ...(textStyle || {}),
              ...(!displayValue ? (placeholderStyle || {}) : {}),
            }}>
              {displayValue || placeholder}
            </span>
          </div>
          {/* ? REMOVED: Chevron icon - entire box is clickable */}
          
          {/* Hidden but functional date input */}
          <input
            ref={webInputRef}
            type={mode === 'time' ? 'time' : mode === 'datetime' ? 'datetime-local' : 'date'}
            value={dateValue ? dateValue.toISOString().split('T')[0] : ''}
            onChange={(e) => {
              if (e.target.value) {
                const selectedDate = new Date(e.target.value + 'T00:00:00');
                if (!isNaN(selectedDate.getTime())) {
                  const isoString = selectedDate.toISOString().split('T')[0];
                  onChange(isoString);
                }
              }
            }}
            min={minimumDate ? minimumDate.toISOString().split('T')[0] : undefined}
            max={maximumDate ? maximumDate.toISOString().split('T')[0] : undefined}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              opacity: 0,
              cursor: 'pointer',
            }}
          />
        </div>

        {error && (
          <Text style={[styles.errorText, errorTextStyle]}>{error}</Text>
        )}
      </View>
    );
  }

  // Native mobile rendering (iOS/Android)
  return (
    <View style={[styles.container, noMargin && { marginBottom: 0 }, containerStyle]}>
      {label && (
        <Text style={[styles.label, labelStyle]}>
          {label}
          {required && <Text style={[styles.required, requiredStyle]}> *</Text>}
        </Text>
      )}
      
      <TouchableOpacity
        style={[
          styles.button,
          error && styles.buttonError,
          buttonStyle // ? Apply custom button styles
        ]}
        onPress={() => setShow(true)}
      >
        <View style={styles.buttonContent}>
          <Ionicons 
            name="calendar-outline" 
            size={20} 
            color={resolvedIconColor} 
          />
          <Text style={[
            styles.buttonText,
            !displayValue && styles.placeholder,
            textStyle,
            !displayValue && placeholderStyle,
            { color: resolvedTextColor },
          ]}>
            {displayValue || placeholder}
          </Text>
        </View>
        {/* ? REMOVED: Chevron icon - entire box is clickable */}
      </TouchableOpacity>

      {error && (
        <Text style={[styles.errorText, errorTextStyle]}>{error}</Text>
      )}

      {show && (
        <>
          {Platform.OS === 'ios' && (
            <View style={styles.iosPickerContainer}>
              <View style={styles.iosPickerHeader}>
                <TouchableOpacity onPress={() => setShow(false)}>
                  <Text style={styles.iosPickerCancel}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShow(false)}>
                  <Text style={styles.iosPickerDone}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={dateValue || new Date()}
                mode={mode}
                display="spinner"
                onChange={handleChange}
                minimumDate={minimumDate}
                maximumDate={maximumDate}
                textColor={pickerTextColor ?? colors.textPrimary}
              />
            </View>
          )}
          
          {Platform.OS === 'android' && (
            <DateTimePicker
              value={dateValue || new Date()}
              mode={mode}
              display="default"
              onChange={handleChange}
              minimumDate={minimumDate}
              maximumDate={maximumDate}
            />
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16, // ? RESTORED: Default margin for standalone usage
    position: 'relative',
  },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.normal,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  required: {
    color: colors.error,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 16,
    // ? REMOVED: minHeight: 50 - let padding control the height
  },
  buttonError: {
    borderColor: colors.error,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  buttonText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.normal,
    color: colors.textPrimary,
    flex: 1,
  },
  placeholder: {
    color: colors.textLight,
  },
  errorText: {
    color: colors.error,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.normal,
    marginTop: 4,
  },
  iosPickerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    zIndex: 1000,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
    }),
  },
  iosPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iosPickerCancel: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.normal,
    color: colors.textLight,
  },
  iosPickerDone: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
  },
});
