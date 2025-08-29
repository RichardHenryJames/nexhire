import React, { useState, createContext, useContext, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../../styles/theme';

// ? NEW: Create context for editing state
const EditingContext = createContext(false);

export const useEditing = () => useContext(EditingContext);

export default function ProfileSection({ 
  title, 
  icon, 
  children, 
  editing: globalEditing = false,
  onUpdate,
  onSave,
  onEdit, // NEW: when provided, clicking Edit will call this instead of toggling local edit state
  onCancel, // NEW: optional cancel handler (does not persist)
  style = {},
  defaultCollapsed = false,
  hideHeaderActions = false // NEW: hide Edit/Save/Cancel (for smart-save sections)
}) {
  const [localEditing, setLocalEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [collapsed, setCollapsed] = useState(!!defaultCollapsed);
  
  // Auto-expand when global edit mode becomes true
  useEffect(() => {
    if (globalEditing && collapsed) setCollapsed(false);
  }, [globalEditing, collapsed]);
  
  const currentEditMode = globalEditing || localEditing;
  
  const handleSaveAndExit = async () => {
    if (onSave) {
      setSaving(true);
      try {
        const success = await onSave();
        if (success !== false) {
          setLocalEditing(false);
        }
      } catch (error) {
        console.error('Error saving section:', error);
      } finally {
        setSaving(false);
      }
    } else {
      setLocalEditing(false);
    }
  };

  const handleEditPress = () => {
    if (onEdit) {
      // Let parent manage edit; ensure section is expanded first for UX
      if (collapsed) setCollapsed(false);
      onEdit();
      return;
    }
    if (localEditing) {
      handleSaveAndExit();
    } else {
      if (collapsed) setCollapsed(false);
      setLocalEditing(true);
    }
  };

  const handleCancelPress = () => {
    // Exit local edit mode without saving
    setLocalEditing(false);
    setSaving(false);
    if (typeof onCancel === 'function') {
      try { onCancel(); } catch { /* noop */ }
    }
  };
  
  return (
    <EditingContext.Provider value={currentEditMode}>
      <View style={[styles.container, style]}>
        <View style={styles.sectionHeader}>
          <TouchableOpacity
            style={styles.headerLeft}
            onPress={() => setCollapsed(v => !v)}
            accessibilityRole="button"
            accessibilityLabel={`${collapsed ? 'Expand' : 'Collapse'} ${title} section`}
            activeOpacity={0.7}
          >
            <Ionicons name={icon} size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>{title}</Text>
            <Ionicons
              name={collapsed ? 'chevron-down' : 'chevron-up'}
              size={18}
              color={colors.gray500 || '#6B7280'}
              style={{ marginLeft: 6 }}
            />
          </TouchableOpacity>
          {/* Header actions (hidden when hideHeaderActions is true) */}
          {!hideHeaderActions && !globalEditing && !collapsed && (
            localEditing && !onEdit ? (
              <View style={styles.headerActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={handleCancelPress}
                  disabled={saving}
                  accessibilityRole="button"
                  accessibilityLabel={`Cancel editing ${title}`}
                >
                  <Ionicons name="close" size={16} color={colors.gray600 || '#6B7280'} />
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={handleSaveAndExit}
                  disabled={saving}
                  accessibilityRole="button"
                  accessibilityLabel={saving ? `Saving ${title}` : `Save ${title}`}
                >
                  <Ionicons 
                    name={saving ? 'hourglass' : 'save-outline'} 
                    size={16} 
                    color={saving ? colors.gray400 : colors.primary} 
                  />
                  <Text style={[
                    styles.saveButtonText,
                    saving && styles.editButtonTextDisabled
                  ]}>
                    {saving ? 'Saving...' : 'Save'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.editButton}
                onPress={handleEditPress}
                disabled={saving}
                accessibilityRole="button"
                accessibilityLabel={localEditing ? (saving ? 'Saving' : `Save ${title}`) : `Edit ${title}`}
              >
                <Ionicons 
                  name={localEditing && !onEdit ? (saving ? 'hourglass' : 'create') : 'create'} 
                  size={16} 
                  color={saving ? colors.gray400 : colors.primary} 
                />
                <Text style={[
                  styles.editButtonText,
                  saving && styles.editButtonTextDisabled
                ]}>
                  {onEdit ? 'Edit' : (saving ? 'Saving...' : (localEditing ? 'Save' : 'Edit'))}
                </Text>
              </TouchableOpacity>
            )
          )}
        </View>
        {!collapsed && (
          <View accessibilityRole="region" accessibilityLabel={`${title} content`}>
            {children}
          </View>
        )}
      </View>
    </EditingContext.Provider>
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
    shadowOffset: { width: 0, height: 2 },
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: typography.sizes?.lg || 18,
    fontWeight: typography.weights?.bold || 'bold',
    color: colors.text || '#000000',
    marginRight: 4,
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
  editButtonTextDisabled: {
    color: colors.gray400 || '#CCCCCC',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 8,
  },
  cancelButtonText: {
    fontSize: typography.sizes?.sm || 14,
    color: colors.gray600 || '#6B7280',
    fontWeight: typography.weights?.medium || '500',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 8,
  },
  saveButtonText: {
    fontSize: typography.sizes?.sm || 14,
    color: colors.primary || '#007AFF',
    fontWeight: typography.weights?.medium || '500',
  },
});