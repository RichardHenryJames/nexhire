import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../../styles/theme';
import refopenAPI from '../../services/api';

/**
 * SkillsSelectionModal
 * 
 * Multi-select modal for choosing skills from ReferenceMetadata
 * Supports primary and secondary skills selection with search functionality
 */
export default function SkillsSelectionModal({ 
  visible, 
  onClose, 
  onSave, 
  initialPrimarySkills = [], 
  initialSecondarySkills = [],
  title = "Select Skills"
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('primary'); // 'primary' or 'secondary'
  
  // All skills from ReferenceMetadata
  const [allSkills, setAllSkills] = useState([]);
  
  // Selected skills
  const [selectedPrimarySkills, setSelectedPrimarySkills] = useState([]);
  const [selectedSecondarySkills, setSelectedSecondarySkills] = useState([]);
  
  // Load skills from ReferenceMetadata when modal opens
  useEffect(() => {
    if (visible) {
      loadSkills();
      // Initialize with passed skills
      setSelectedPrimarySkills(initialPrimarySkills || []);
      setSelectedSecondarySkills(initialSecondarySkills || []);
      setSearchQuery('');
    }
  }, [visible]);
  
  const loadSkills = async () => {
    try {
      setLoading(true);
      const response = await refopenAPI.getReferenceMetadata('Skill');
      
      console.log('Skills API response:', response);
      
      if (response.success && response.data) {
        // Ensure data is an array and filter out invalid entries
        const skillsArray = Array.isArray(response.data) ? response.data : [];
        const validSkills = skillsArray.filter(skill => skill && skill.Value);
        
        // Sort skills alphabetically
        const sortedSkills = validSkills.sort((a, b) => {
          const aValue = a.Value || '';
          const bValue = b.Value || '';
          return aValue.localeCompare(bValue);
        });
        
        console.log('Loaded skills count:', sortedSkills.length);
        setAllSkills(sortedSkills);
      } else {
        console.error('Invalid skills response:', response);
        Alert.alert('Error', 'No skills data available');
      }
    } catch (error) {
      console.error('Error loading skills:', error);
      Alert.alert('Error', 'Failed to load skills. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  // Filter skills based on search query - only show when searching
  const filteredSkills = searchQuery.trim().length > 0 
    ? allSkills.filter(skill =>
        skill && skill.Value && skill.Value.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 20) // Limit to 20 results
    : [];
  
  // Check if a skill is selected
  const isSkillSelected = (skillValue) => {
    if (activeTab === 'primary') {
      return selectedPrimarySkills.includes(skillValue);
    } else {
      return selectedSecondarySkills.includes(skillValue);
    }
  };
  
  // Get current selected skills for active tab
  const currentSelectedSkills = activeTab === 'primary' 
    ? selectedPrimarySkills 
    : selectedSecondarySkills;
  
  // Toggle skill selection
  const toggleSkill = (skillValue) => {
    if (activeTab === 'primary') {
      setSelectedPrimarySkills(prev => {
        if (prev.includes(skillValue)) {
          return prev.filter(s => s !== skillValue);
        } else {
          // Limit to 10 primary skills
          if (prev.length >= 10) {
            Alert.alert('Limit Reached', 'You can select up to 10 primary skills');
            return prev;
          }
          return [...prev, skillValue];
        }
      });
    } else {
      setSelectedSecondarySkills(prev => {
        if (prev.includes(skillValue)) {
          return prev.filter(s => s !== skillValue);
        } else {
          // Limit to 15 secondary skills
          if (prev.length >= 15) {
            Alert.alert('Limit Reached', 'You can select up to 15 secondary skills');
            return prev;
          }
          return [...prev, skillValue];
        }
      });
    }
  };
  
  // Handle save
  const handleSave = async () => {
    try {
      setSaving(true);
      
      // Convert arrays to comma-separated strings
      const primarySkillsStr = selectedPrimarySkills.join(', ');
      const secondarySkillsStr = selectedSecondarySkills.join(', ');
      
      // Call the save callback
      await onSave({
        primarySkills: primarySkillsStr,
        secondarySkills: secondarySkillsStr
      });
      
      onClose();
    } catch (error) {
      console.error('Error saving skills:', error);
      Alert.alert('Error', 'Failed to save skills. Please try again.');
    } finally {
      setSaving(false);
    }
  };
  
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{title}</Text>
          <TouchableOpacity 
            onPress={handleSave} 
            disabled={saving}
            style={styles.saveButton}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>
        
        {/* Tab Switcher */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'primary' && styles.tabActive]}
            onPress={() => setActiveTab('primary')}
          >
            <Text style={[styles.tabText, activeTab === 'primary' && styles.tabTextActive]}>
              Primary Skills {selectedPrimarySkills.length > 0 && `(${selectedPrimarySkills.length})`}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'secondary' && styles.tabActive]}
            onPress={() => setActiveTab('secondary')}
          >
            <Text style={[styles.tabText, activeTab === 'secondary' && styles.tabTextActive]}>
              Secondary Skills {selectedSecondarySkills.length > 0 && `(${selectedSecondarySkills.length})`}
            </Text>
          </TouchableOpacity>
        </View>
        
        {/* Info Text */}
        <View style={styles.infoContainer}>
          <Ionicons name="information-circle-outline" size={16} color="#666" />
          <Text style={styles.infoText}>
            {activeTab === 'primary' 
              ? 'Select up to 10 core skills you excel at'
              : 'Select up to 15 additional skills you have experience with'}
          </Text>
        </View>
        
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Type to search and add skills..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#999"
            autoCapitalize="none"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearch}>
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          )}
        </View>

        {/* Selected Skills Display */}
        <View style={styles.selectedSkillsContainer}>
          <Text style={styles.selectedSkillsTitle}>
            Selected {activeTab === 'primary' ? 'Primary' : 'Secondary'} Skills ({currentSelectedSkills.length})
          </Text>
          {currentSelectedSkills.length === 0 ? (
            <Text style={styles.noSelectionText}>No skills selected yet. Search and tap to add.</Text>
          ) : (
            <View style={styles.selectedSkillsGrid}>
              {currentSelectedSkills.map((skillValue, index) => (
                <View key={index} style={styles.selectedSkillChip}>
                  <Text style={styles.selectedSkillText}>{skillValue}</Text>
                  <TouchableOpacity
                    onPress={() => toggleSkill(skillValue)}
                    style={styles.removeSkillButton}
                  >
                    <Ionicons name="close-circle" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>
        
        {/* Search Results Dropdown */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading skills...</Text>
          </View>
        ) : searchQuery.trim().length > 0 ? (
          <ScrollView style={styles.dropdownList} showsVerticalScrollIndicator={false}>
            {filteredSkills.length === 0 ? (
              <View style={styles.emptyDropdown}>
                <Ionicons name="search-outline" size={32} color="#ccc" />
                <Text style={styles.emptyText}>No skills found matching "{searchQuery}"</Text>
              </View>
            ) : (
              <View>
                {filteredSkills.map((skill) => {
                  const isSelected = isSkillSelected(skill.Value);
                  return (
                    <TouchableOpacity
                      key={skill.ReferenceID}
                      style={[styles.dropdownItem, isSelected && styles.dropdownItemSelected]}
                      onPress={() => {
                        toggleSkill(skill.Value);
                        setSearchQuery(''); // Clear search after selection
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.dropdownItemText, isSelected && styles.dropdownItemTextSelected]}>
                        {skill.Value}
                      </Text>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </ScrollView>
        ) : allSkills.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="warning-outline" size={48} color="#ff9500" />
            <Text style={styles.emptyText}>No skills loaded</Text>
            <Text style={styles.emptySubtext}>Please try closing and reopening this screen</Text>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={loadSkills}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.instructionContainer}>
            <Ionicons name="information-circle-outline" size={48} color="#ccc" />
            <Text style={styles.instructionText}>Start typing to search from {allSkills.length} available skills</Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  closeButton: {
    padding: 4,
    width: 60,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
    textAlign: 'center',
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    width: 60,
    alignItems: 'flex-end',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#f8f8f8',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
    backgroundColor: '#fff',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f0f7ff',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 8,
    gap: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#666',
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
  },
  clearSearch: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#666',
  },
  skillsList: {
    flex: 1,
  },
  skillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 8,
  },
  skillChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginRight: 8,
    marginBottom: 8,
  },
  skillChipSelected: {
    backgroundColor: '#e3f2fd',
    borderColor: colors.primary,
  },
  skillChipText: {
    fontSize: 14,
    color: '#333',
  },
  skillChipTextSelected: {
    color: colors.primary,
    fontWeight: '500',
  },
  checkIcon: {
    marginLeft: 6,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  selectedSkillsContainer: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  selectedSkillsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  noSelectionText: {
    fontSize: 13,
    color: '#999',
    fontStyle: 'italic',
  },
  selectedSkillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectedSkillChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 8,
    borderRadius: 16,
    gap: 6,
  },
  selectedSkillText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '500',
  },
  removeSkillButton: {
    padding: 2,
  },
  dropdownList: {
    flex: 1,
    marginHorizontal: 16,
    marginTop: 12,
    maxHeight: 300,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dropdownItemSelected: {
    backgroundColor: '#f0f7ff',
  },
  dropdownItemText: {
    fontSize: 15,
    color: '#333',
    flex: 1,
  },
  dropdownItemTextSelected: {
    color: colors.primary,
    fontWeight: '500',
  },
  emptyDropdown: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  instructionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  instructionText: {
    marginTop: 16,
    fontSize: 15,
    color: '#999',
    textAlign: 'center',
  },
  summaryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f8f8f8',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  summaryText: {
    fontSize: 14,
    color: '#666',
  },
});
