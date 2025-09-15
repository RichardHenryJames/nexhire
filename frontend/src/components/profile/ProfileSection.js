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
  hideHeaderActions = false, // NEW: hide Edit/Save/Cancel (for smart-save sections)
  hideSaveButton = false // NEW: hide only the Save button (e.g., Work Experience section has its own internal save)
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
        {/* HEADER - Now only contains title and collapse/expand controls */}
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
          
          {/* Only show Edit button in header when not in editing mode and not hideHeaderActions */}
          {!hideHeaderActions && !globalEditing && !collapsed && !localEditing && (
            <TouchableOpacity
              style={styles.editButton}
              onPress={handleEditPress}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${title}`}
            >
              <Ionicons 
                name="create" 
                size={16} 
                color={colors.primary} 
              />
              <Text style={styles.editButtonText}>
                Edit
              </Text>
            </TouchableOpacity>
          )}
        </View>
        
        {/* CONTENT */}
        {!collapsed && (
          <View accessibilityRole="region" accessibilityLabel={`${title} content`}>
            {children}
            
            {/* FOOTER ACTIONS - Save and Cancel buttons moved here */}
            {!hideHeaderActions && !globalEditing && currentEditMode && (
              <View style={styles.footerActions}>
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
                {!hideSaveButton && (
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
                      color={saving ? colors.gray400 : colors.white} 
                    />
                    <Text style={[
                      styles.saveButtonText,
                      saving && styles.saveButtonTextDisabled
                    ]}>
                      {saving ? 'Saving...' : 'Save'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
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
    flex: 1,
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
  
  // FOOTER ACTIONS - New styles for buttons at bottom
  footerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border || '#E5E7EB',
  },
  cancelButton: {
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
  cancelButtonText: {
    fontSize: typography.sizes?.sm || 14,
    color: colors.gray600 || '#6B7280',
    fontWeight: typography.weights?.medium || '500',
  },
  saveButton: {
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
  saveButtonText: {
    fontSize: typography.sizes?.sm || 14,
    color: colors.white || '#FFFFFF',
    fontWeight: typography.weights?.bold || 'bold',
  },
  saveButtonTextDisabled: {
    color: colors.gray300 || '#D1D5DB',
  },
});