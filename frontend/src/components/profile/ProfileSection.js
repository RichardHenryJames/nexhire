import React, { useState, createContext, useContext } from 'react';
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
  onSave, // ? NEW: Save callback for when user finishes editing
  style = {}
}) {
  const [localEditing, setLocalEditing] = useState(false);
  const [saving, setSaving] = useState(false); // ? NEW: Saving state
  
  const currentEditMode = globalEditing || localEditing;
  
  // ? NEW: Handle save and exit edit mode
  const handleSaveAndExit = async () => {
    if (onSave) {
      setSaving(true);
      try {
        const success = await onSave();
        if (success !== false) { // ? FIX: Only exit edit mode if onSave doesn't return false
          setLocalEditing(false);
        }
      } catch (error) {
        console.error('Error saving section:', error);
      } finally {
        setSaving(false);
      }
    } else {
      setLocalEditing(false); // Just exit edit mode if no save function
    }
  };
  
  return (
    <EditingContext.Provider value={currentEditMode}>
      <View style={[styles.container, style]}>
        <View style={styles.sectionHeader}>
          <View style={styles.headerLeft}>
            <Ionicons name={icon} size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>{title}</Text>
          </View>
          {!globalEditing && (
            <TouchableOpacity
              style={styles.editButton}
              onPress={localEditing ? handleSaveAndExit : () => setLocalEditing(true)}
              disabled={saving}
            >
              <Ionicons 
                name={localEditing ? (saving ? "hourglass" : "checkmark") : "create"} 
                size={16} 
                color={saving ? colors.gray400 : colors.primary} 
              />
              <Text style={[
                styles.editButtonText,
                saving && styles.editButtonTextDisabled
              ]}>
                {saving ? 'Saving...' : (localEditing ? 'Save' : 'Edit')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        
        {/* Children now have access to editing state via context */}
        {children}
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
  editButtonTextDisabled: {
    color: colors.gray400 || '#CCCCCC',
  },
});