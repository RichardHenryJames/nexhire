import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  Dimensions,
  Platform,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { colors, typography } from '../../styles/theme';
import nexhireAPI from '../../services/api';
import { useEditing } from './ProfileSection'; // ? Import the editing context

const { width: screenWidth } = Dimensions.get('window');
const CARD_WIDTH = 190; // ? FIXED: Slightly bigger to fit content properly
const CARD_MARGIN = 10;

const ResumeSection = ({ 
  profile, 
  setProfile, 
  // ? REMOVED: editing prop - now uses context
  onUpdate 
}) => {
  // ? Use ProfileSection's editing context instead of prop
  const editing = useEditing();
  
  const [resumes, setResumes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [resumeLabel, setResumeLabel] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  
  // ? NEW: Beautiful delete confirmation modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteResumeData, setDeleteResumeData] = useState({ id: '', label: '' });
  const [deleting, setDeleting] = useState(false);
  const fadeAnim = useState(new Animated.Value(0))[0];
  const scaleAnim = useState(new Animated.Value(0.8))[0];

  // Load resumes on component mount and when profile changes
  useEffect(() => {
    if (profile?.resumes) {
      setResumes(profile.resumes);
    } else {
      loadResumes();
    }
  }, [profile?.UserID]);

  // ? NEW: Animate modal appearance
  useEffect(() => {
    if (showDeleteModal) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [showDeleteModal]);

  const loadResumes = async () => {
    try {
      setLoading(true);
      
      // Check authentication before making API call
      if (!nexhireAPI.token) {
        setResumes([]);
        return;
      }
      
      const response = await nexhireAPI.getMyResumes();
      
      if (response && response.success && Array.isArray(response.data)) {
        setResumes(response.data);
        
        // Update profile with resumes
        if (setProfile) {
          setProfile(prev => ({
            ...prev,
            resumes: response.data,
            primaryResumeURL: response.data.find(r => r.IsPrimary)?.ResumeURL || response.data[0]?.ResumeURL || ''
          }));
        }
      } else {
        setResumes([]);
      }
    } catch (error) {
      // Don't show alert for loading errors, just log them
      if (!error.message?.includes('Authentication')) {
        // Error handled silently in production
      }
      
      setResumes([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelection = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf', 
          'application/msword', 
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ],
        copyToCacheDirectory: true,
        multiple: false
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        
        // Validate file size (10MB limit)
        if (file.size > 10 * 1024 * 1024) {
          Alert.alert('File Too Large', 'Please select a file smaller than 10MB');
          return;
        }

        setSelectedFile(file);
        setResumeLabel(getDefaultLabel(file.name));
        setShowLabelModal(true);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to select file');
    }
  };

  const getDefaultLabel = (fileName) => {
    const name = fileName.replace(/\.[^/.]+$/, ""); // Remove extension
    const cleanName = name.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    return cleanName || 'My Resume';
  };

  const uploadResume = async () => {
    if (!selectedFile || !resumeLabel.trim()) {
      Alert.alert('Missing Information', 'Please provide a label for your resume');
      return;
    }

    try {
      setUploading(true);
      setShowLabelModal(false);

      // Check if we're at the 3 resume limit
      if (resumes.length >= 3) {
        Alert.alert(
          'Maximum Resumes Reached',
          'You can only have 3 resumes. The oldest non-primary resume will be replaced.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Continue', onPress: () => performUpload() }
          ]
        );
      } else {
        await performUpload();
      }
    } catch (error) {
      console.error('Error uploading resume:', error);
      Alert.alert('Upload Failed', error.message || 'Failed to upload resume');
      setUploading(false);
    }
  };

  const performUpload = async () => {
    try {
      const response = await nexhireAPI.uploadResume(
        selectedFile, 
        profile.UserID, 
        resumeLabel.trim()
      );

      if (response.success) {
        Alert.alert('Success!', 'Resume uploaded successfully');
        await loadResumes(); // Reload to get updated list
        if (onUpdate) {
          onUpdate({ resumeUploaded: true });
        }
      }
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Upload Failed', error.message || 'Failed to upload resume');
    } finally {
      setUploading(false);
      setSelectedFile(null);
      setResumeLabel('');
    }
  };

  const setPrimaryResume = async (resumeId) => {
    try {
      console.log('Setting primary resume:', resumeId);
      setLoading(true);
      const response = await nexhireAPI.setPrimaryResume(resumeId);
      console.log('Set primary response:', response);
      if (response.success) {
        Alert.alert('Success!', 'Primary resume updated successfully');
        await loadResumes();
        if (onUpdate) {
          onUpdate({ primaryResumeChanged: true });
        }
      } else {
        Alert.alert('Error', response.error || 'Failed to update primary resume');
      }
    } catch (error) {
      console.error('Error setting primary resume:', error);
      Alert.alert('Error', error.message || 'Failed to update primary resume');
    } finally {
      setLoading(false);
    }
  };

  // ? NEW: Beautiful custom delete confirmation
  const deleteResume = async (resumeId, resumeLabel) => {
    if (resumes.length <= 1) {
      Alert.alert('Cannot Delete', 'You must have at least one resume');
      return;
    }

    // Proceed directly to delete confirmation modal
    setDeleteResumeData({ id: resumeId, label: resumeLabel });
    setShowDeleteModal(true);
  };

  // ? NEW: Handle delete confirmation
  const handleDeleteConfirm = async () => {
    // Proceed with actual deletion
    setShowDeleteModal(false);
    await performDeleteResume(deleteResumeData.id, deleteResumeData.label);
  };

  // ? NEW: Handle delete cancel
  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
    setDeleteResumeData({ id: '', label: '' });
  };

  const performDeleteResume = async (resumeId, resumeLabel) => {
    console.log('?=== PERFORM DELETE RESUME START ===');
    console.log('?Resume ID:', resumeId);
    console.log('?Resume Label:', resumeLabel);
    console.log('?Current resumes count:', resumes.length);
    
    try {
      console.log('?Setting loading state...');
      setDeleting(true);
      
      // ? FIXED: Ensure we have proper authentication
      if (!nexhireAPI.token) {
        console.error('?No auth token available');
        Alert.alert('Authentication Error', 'Please login again to delete resumes');
        return;
      }
      
      console.log('?Auth token verified, making API call...');
      const response = await nexhireAPI.deleteResume(resumeId);
      console.log('?API response received:', response);
      
      if (response && response.success) {
        console.log('? Resume deleted successfully from server');
        
        // ? FIXED: Immediately update local state to remove deleted resume
        console.log('Updating local resumes state...');
        setResumes(prevResumes => {
          const updatedResumes = prevResumes.filter(r => r.ResumeID !== resumeId);
          console.log('Updated local resumes count:', updatedResumes.length);
          return updatedResumes;
        });
        
        // ? FIXED: Update parent profile state as well
        if (setProfile) {
          console.log('Updating parent profile state...');
          setProfile(prev => {
            const updatedResumes = (prev.resumes || []).filter(r => r.ResumeID !== resumeId);
            const newPrimaryURL = updatedResumes.find(r => r.IsPrimary)?.ResumeURL || updatedResumes[0]?.ResumeURL || '';
            
            console.log('Updated profile resumes count:', updatedResumes.length);
            console.log('New primary resume URL:', newPrimaryURL);
            
            return {
              ...prev,
              resumes: updatedResumes,
              primaryResumeURL: newPrimaryURL
            };
          });
        }
        
        // ? NEW: Show beautiful success message
        Alert.alert('? Success', 'Resume deleted successfully');
        
        // ? OPTIONAL: Reload from server as backup verification
        console.log('Reloading resumes from server for verification...');
        setTimeout(() => {
          loadResumes();
        }, 500);
        
        if (onUpdate) {
          onUpdate({ resumeDeleted: true });
        }
      } else {
        console.error('? Delete failed - server response:', response);
        Alert.alert('Error', response?.error || 'Failed to delete resume');
      }
    } catch (error) {
      console.error('?=== ERROR DELETING RESUME ===');
      console.error('?Error type:', error.constructor.name);
      console.error('?Error message:', error.message);
      console.error('?Full error:', error);
      
      // ? IMPROVED: Better error messages based on error type
      let errorMessage = 'Failed to delete resume';
      if (error.message?.includes('Authentication')) {
        errorMessage = 'Please login again to delete resumes';
      } else if (error.message?.includes('Network')) {
        errorMessage = 'Network error. Please check your connection.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      console.log('?Clearing loading state...');
      setDeleting(false);
      console.log('?=== PERFORM DELETE RESUME END ===');
    }
  };

  const openResume = (resumeURL) => {
    try {
      console.log('Opening resume:', resumeURL);
      
      if (Platform.OS === 'web') {
        // On web, open in new tab for download/view
        window.open(resumeURL, '_blank');
      } else {
        // On mobile, use Linking to open the URL
        const Linking = require('react-native').Linking;
        Linking.openURL(resumeURL).catch(() => {
          Alert.alert('Error', 'Could not open resume. URL might be invalid.');
        });
      }
    } catch (error) {
      console.error('Error opening resume:', error);
      // Fallback: Show URL in alert with copy option
      Alert.alert('Resume URL', resumeURL, [
        { text: 'Close', style: 'cancel' },
        { text: 'Copy URL', onPress: () => {
          // In a real app, you'd copy to clipboard
          console.log('Resume URL copied:', resumeURL);
          Alert.alert('Copied', 'Resume URL copied to clipboard');
        }}
      ]);
    }
  };

  const getFileIcon = (resumeURL) => {
    if (resumeURL.includes('.pdf')) return 'document-text';
    if (resumeURL.includes('.doc')) return 'document';
    return 'document-outline';
  };

  const getFileType = (resumeURL) => {
    if (resumeURL.includes('.pdf')) return 'PDF';
    if (resumeURL.includes('.docx')) return 'DOCX';
    if (resumeURL.includes('.doc')) return 'DOC';
    return 'Document';
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const renderResumeCard = (resume, index) => (
    <View key={resume.ResumeID} style={styles.resumeCard}>
      {/* Primary Badge */}
      {resume.IsPrimary && (
        <View style={styles.primaryBadge}>
          <Ionicons name="star" size={10} color={colors.white} />
          <Text style={styles.primaryBadgeText}>Primary</Text>
        </View>
      )}

      {/* File Icon and Type */}
      <View style={styles.resumeHeader}>
        <Ionicons 
          name={getFileIcon(resume.ResumeURL)} 
          size={32} 
          color={colors.primary} 
        />
        <Text style={styles.fileType}>{getFileType(resume.ResumeURL)}</Text>
      </View>

      {/* Resume Info */}
      <View style={styles.resumeInfo}>
        <Text style={styles.resumeLabel} numberOfLines={2}>
          {resume.ResumeLabel.length > 18 
            ? `${resume.ResumeLabel.substring(0, 18)}...` 
            : resume.ResumeLabel}
        </Text>
        <Text style={styles.resumeDate}>
          Uploaded: {formatDate(resume.CreatedAt)}
        </Text>
      </View>

      {/* Actions */}
      <View style={styles.resumeActions}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => openResume(resume.ResumeURL)}
        >
          <Ionicons name="eye" size={12} color={colors.primary} />
          <Text style={styles.actionButtonText}>View</Text>
        </TouchableOpacity>

        {editing && (
          <>
            {!resume.IsPrimary && (
              <TouchableOpacity 
                style={[styles.actionButton, styles.primaryButton]}
                onPress={() => setPrimaryResume(resume.ResumeID)}
                disabled={loading}
              >
                <Ionicons name="star-outline" size={12} color={colors.warning} />
                <Text style={[styles.actionButtonText, styles.primaryButtonText]}>
                  Primary
                </Text>
              </TouchableOpacity>
            )}

            {/* ? FIXED: Only show delete button for non-primary resumes */}
            {!resume.IsPrimary && (
              <TouchableOpacity 
                style={[styles.actionButton, styles.deleteButton]}
                onPress={() => deleteResume(resume.ResumeID, resume.ResumeLabel)}
                disabled={loading || resumes.length <= 1 || deleting}
              >
                <Ionicons name="trash" size={12} color={colors.danger} />
                <Text style={[styles.actionButtonText, styles.deleteButtonText]}>
                  Delete
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="document-outline" size={48} color={colors.gray400} />
      <Text style={styles.emptyStateTitle}>No Resumes</Text>
      <Text style={styles.emptyStateText}>
        {editing ? 'Upload your first resume to get started' : 'No resumes uploaded yet'}
      </Text>
      {editing && (
        <TouchableOpacity 
          style={styles.uploadButton}
          onPress={handleFileSelection}
          disabled={uploading}
        >
          <Ionicons name="cloud-upload" size={20} color={colors.white} />
          <Text style={styles.uploadButtonText}>Upload Resume</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (loading && resumes.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading resumes...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[
        styles.sectionHeader,
        resumes.length === 0 && styles.sectionHeaderEmpty // ? ADDED: Different style when empty
      ]}>
        <View style={styles.headerLeft}>
          <Text style={styles.resumeCount}>
            {resumes.length} of 3 resumes
          </Text>
          {resumes.length > 0 && (
            <Text style={styles.primaryIndicator}>
              Primary: {resumes.find(r => r.IsPrimary)?.ResumeLabel || 'None'}
            </Text>
          )}
        </View>

        {/* ? FIXED: Only show Add Resume button when user has resumes AND is under the limit */}
        {editing && resumes.length > 0 && resumes.length < 3 && (
          <TouchableOpacity 
            style={styles.addButton}
            onPress={handleFileSelection}
            disabled={uploading}
          >
            <Ionicons name="add" size={16} color={colors.primary} />
            <Text style={styles.addButtonText}>Add Resume</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Resume Slider */}
      {resumes.length > 0 ? (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.resumeSlider}
          decelerationRate="fast"
          snapToInterval={CARD_WIDTH + CARD_MARGIN * 2}
          snapToAlignment="start"
        >
          {resumes.map((resume, index) => renderResumeCard(resume, index))}
        </ScrollView>
      ) : (
        renderEmptyState()
      )}

      {/* Upload Status */}
      {uploading && (
        <View style={styles.uploadingIndicator}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.uploadingText}>Uploading resume...</Text>
        </View>
      )}

      {/* ? NEW: Beautiful Delete Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        transparent={true}
        animationType="none"
        onRequestClose={handleDeleteCancel}
      >
        <View style={styles.deleteModalOverlay}>
          <Animated.View 
            style={[
              styles.deleteModalContainer,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }]
              }
            ]}
          >
            {/* Icon */}
            <View style={styles.deleteModalIcon}>
              <Ionicons name="trash" size={32} color={colors.danger} />
            </View>

            {/* Title */}
            <Text style={styles.deleteModalTitle}>Delete Resume</Text>
            
            {/* Message */}
            <Text style={styles.deleteModalMessage}>
              Are you sure you want to delete "{deleteResumeData.label}"? This action cannot be undone.
            </Text>

            {/* Buttons */}
            <View style={styles.deleteModalButtons}>
              <TouchableOpacity
                style={styles.deleteModalCancelButton}
                onPress={handleDeleteCancel}
                disabled={deleting}
              >
                <Text style={styles.deleteModalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.deleteModalDeleteButton, deleting && styles.deleteModalDeleteButtonDisabled]}
                onPress={handleDeleteConfirm}
                disabled={deleting}
              >
                {deleting ? (
                  <>
                    <ActivityIndicator size="small" color={colors.white} style={{ marginRight: 8 }} />
                    <Text style={styles.deleteModalDeleteText}>Deleting...</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="trash" size={16} color={colors.white} style={{ marginRight: 8 }} />
                    <Text style={styles.deleteModalDeleteText}>Delete</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* Resume Label Modal */}
      <Modal
        visible={showLabelModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowLabelModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowLabelModal(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Label Your Resume</Text>
            <TouchableOpacity 
              onPress={uploadResume}
              disabled={!resumeLabel.trim() || uploading}
            >
              <Text style={[
                styles.uploadButtonModal,
                (!resumeLabel.trim() || uploading) && styles.uploadButtonDisabled
              ]}>
                Upload
              </Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.modalContent}>
            <Text style={styles.modalDescription}>
              Give your resume a meaningful name to help you organize multiple versions.
            </Text>
            
            {selectedFile && (
              <View style={styles.selectedFile}>
                <Ionicons name="document" size={20} color={colors.primary} />
                <Text style={styles.selectedFileName}>{selectedFile.name}</Text>
                <Text style={styles.selectedFileSize}>
                  {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
                </Text>
              </View>
            )}

            <Text style={styles.labelInputLabel}>Resume Label</Text>
            <TextInput
              style={styles.labelInput}
              value={resumeLabel}
              onChangeText={setResumeLabel}
              placeholder="e.g., Software Engineer Resume, Tech Lead Resume"
              autoFocus
              maxLength={50}
            />
            
            <Text style={styles.labelHint}>
              Examples: "Tech Resume", "Manager Resume", "Creative Portfolio"
            </Text>

            {uploading && (
              <View style={styles.uploadingContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.uploadingModalText}>Uploading...</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  
  // Header Styles
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingHorizontal: 4,
    minHeight: 40, // ? ADDED: Ensure consistent header height
  },
  sectionHeaderEmpty: {
    marginBottom: 8, // ? ADDED: Less margin when showing empty state
    justifyContent: 'center', // ? ADDED: Center content when empty
  },
  headerLeft: {
    flex: 1,
  },
  resumeCount: {
    fontSize: typography.sizes?.sm || 14,
    color: colors.gray600 || '#6B7280',
    fontWeight: typography.weights?.medium || '500',
  },
  primaryIndicator: {
    fontSize: typography.sizes?.xs || 12,
    color: colors.gray500 || '#9CA3AF',
    marginTop: 2,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background || '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.primary || '#007AFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  addButtonText: {
    fontSize: typography.sizes?.sm || 14,
    color: colors.primary || '#007AFF',
    fontWeight: typography.weights?.medium || '500',
  },

  // Resume Slider Styles
  resumeSlider: {
    paddingLeft: 1, // ? FIXED: Align with header padding
    paddingRight: CARD_MARGIN,
  },
  resumeCard: {
    width: CARD_WIDTH,
    height: CARD_WIDTH + 20, // ? FIXED: Slightly taller to accommodate buttons
    backgroundColor: colors.surface || colors.background || '#FFFFFF',
    borderRadius: 12,
    padding: 14, // ? ADJUSTED: Better padding for content
    marginHorizontal: CARD_MARGIN,
    borderWidth: 1,
    borderColor: colors.border || '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  primaryBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: colors.warning || '#F59E0B',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6, // ? REDUCED: Smaller padding for compact badge
    paddingVertical: 3, // ? REDUCED: Smaller padding for compact badge
    borderRadius: 8, // ? REDUCED: Smaller border radius
    gap: 3, // ? REDUCED: Smaller gap
    zIndex: 1,
  },
  primaryBadgeText: {
    fontSize: typography.sizes?.xs || 9, // ? REDUCED: Smaller text for compact badge
    color: colors.white || '#FFFFFF',
    fontWeight: typography.weights?.bold || 'bold',
  },
  resumeHeader: {
    alignItems: 'center',
    marginBottom: 8, // ? REDUCED: Less margin for compact design
  },
  fileType: {
    fontSize: typography.sizes?.xs || 10, // ? REDUCED: Smaller file type text
    color: colors.gray600 || '#6B7280',
    fontWeight: typography.weights?.medium || '500',
    marginTop: 2, // ? REDUCED: Less margin
  },
  resumeInfo: {
    marginBottom: 12, // ? REDUCED: Less margin for compact design
    flex: 1, // ? ADDED: Allow content to flex
  },
  resumeLabel: {
    fontSize: typography.sizes?.sm || 13, // ? SLIGHTLY INCREASED: Better readability
    color: colors.text || '#111827',
    fontWeight: typography.weights?.medium || '500',
    marginBottom: 3, // ? ADJUSTED: Better spacing
    lineHeight: 16, // ? ADJUSTED: Better line height
  },
  resumeDate: {
    fontSize: typography.sizes?.xs || 10, // ? REDUCED: Even smaller date text
    color: colors.gray500 || '#9CA3AF',
  },
  resumeActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4, // ? REDUCED: Smaller gaps between buttons
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray100 || '#F3F4F6',
    paddingHorizontal: 10, // ? SLIGHTLY INCREASED: Better button size
    paddingVertical: 5, // ? SLIGHTLY INCREASED: Better button size
    borderRadius: 6,
    gap: 3, // ? SLIGHTLY INCREASED: Better spacing
  },
  actionButtonText: {
    fontSize: typography.sizes?.xs || 11, // ? SLIGHTLY INCREASED: Better readability
    color: colors.gray700 || '#374151',
    fontWeight: typography.weights?.medium || '500',
  },
  primaryButton: {
    backgroundColor: colors.warning + '20' || '#F59E0B20',
  },
  primaryButtonText: {
    color: colors.warning || '#F59E0B',
  },
  deleteButton: {
    backgroundColor: colors.danger + '20' || '#EF444420',
  },
  deleteButtonText: {
    color: colors.danger || '#EF4444',
  },

  // ? NEW: Beautiful Delete Modal Styles
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  deleteModalContainer: {
    backgroundColor: colors.surface || colors.background || '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    width: '100%',
    maxWidth: 350,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
  },
  deleteModalIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.danger + '15' || '#EF444415',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  deleteModalTitle: {
    fontSize: typography.sizes?.xl || 24,
    fontWeight: typography.weights?.bold || 'bold',
    color: colors.text || '#111827',
    marginBottom: 12,
    textAlign: 'center',
  },
  deleteModalMessage: {
    fontSize: typography.sizes?.md || 16,
    color: colors.gray600 || '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  deleteModalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  deleteModalCancelButton: {
    flex: 1,
    backgroundColor: colors.gray100 || '#F3F4F6',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteModalCancelText: {
    fontSize: typography.sizes?.md || 16,
    fontWeight: typography.weights?.semibold || '600',
    color: colors.gray700 || '#374151',
  },
  deleteModalDeleteButton: {
    flex: 1,
    backgroundColor: colors.danger || '#EF4444',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  deleteModalDeleteButtonDisabled: {
    opacity: 0.7,
  },
  deleteModalDeleteText: {
    fontSize: typography.sizes?.md || 16,
    fontWeight: typography.weights?.bold || 'bold',
    color: colors.white || '#FFFFFF',
  },

  // Empty State Styles
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48, // ? INCREASED: More padding for better centering
    paddingHorizontal: 24, // ? INCREASED: More horizontal padding
    minHeight: 200, // ? ADDED: Ensure minimum height for proper centering
    justifyContent: 'center', // ? ADDED: Center content vertically
  },
  emptyStateTitle: {
    fontSize: typography.sizes?.lg || 18,
    color: colors.gray600 || '#6B7280',
    fontWeight: typography.weights?.medium || '500',
    marginTop: 16, // ? INCREASED: More space from icon
    marginBottom: 8, // ? INCREASED: More space before description
  },
  emptyStateText: {
    fontSize: typography.sizes?.sm || 14,
    color: colors.gray500 || '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32, // ? INCREASED: More space before button
    maxWidth: 280, // ? ADDED: Limit text width for better readability
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary || '#007AFF',
    paddingHorizontal: 24, // ? INCREASED: Wider button
    paddingVertical: 14, // ? INCREASED: Taller button
    borderRadius: 12, // ? INCREASED: More rounded corners
    gap: 8,
    shadowColor: '#000', // ? ADDED: Shadow for better visual hierarchy
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  uploadButtonText: {
    fontSize: typography.sizes?.md || 16, // ? INCREASED: Larger text
    color: colors.white || '#FFFFFF',
    fontWeight: typography.weights?.semibold || '600', // ? INCREASED: Bolder text
  },

  // Loading Styles
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  loadingText: {
    fontSize: typography.sizes?.sm || 14,
    color: colors.gray600 || '#6B7280',
    marginTop: 8,
  },
  uploadingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    gap: 8,
  },
  uploadingText: {
    fontSize: typography.sizes?.sm || 14,
    color: colors.primary || '#007AFF',
  },

  // Modal Styles
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
    borderBottomColor: colors.border || '#E5E7EB',
  },
  modalTitle: {
    fontSize: typography.sizes?.lg || 18,
    fontWeight: typography.weights?.bold || 'bold',
    color: colors.text || '#111827',
  },
  uploadButtonModal: {
    fontSize: typography.sizes?.md || 16,
    color: colors.primary || '#007AFF',
    fontWeight: typography.weights?.medium || '500',
  },
  uploadButtonDisabled: {
    color: colors.gray400 || '#9CA3AF',
  },
  modalContent: {
    padding: 20,
  },
  modalDescription: {
    fontSize: typography.sizes?.sm || 14,
    color: colors.gray600 || '#6B7280',
    lineHeight: 20,
    marginBottom: 20,
  },
  selectedFile: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray100 || '#F3F4F6',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    gap: 8,
  },
  selectedFileName: {
    flex: 1,
    fontSize: typography.sizes?.sm || 14,
    color: colors.text || '#111827',
    fontWeight: typography.weights?.medium || '500',
  },
  selectedFileSize: {
    fontSize: typography.sizes?.xs || 12,
    color: colors.gray500 || '#9CA3AF',
  },
  labelInputLabel: {
    fontSize: typography.sizes?.sm || 14,
    color: colors.gray700 || '#374151',
    fontWeight: typography.weights?.medium || '500',
    marginBottom: 8,
  },
  labelInput: {
    backgroundColor: colors.background || '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border || '#E5E7EB',
    borderRadius: 8,
    padding: 16,
    fontSize: typography.sizes?.md || 16,
    color: colors.text || '#111827',
    marginBottom: 8,
  },
  labelHint: {
    fontSize: typography.sizes?.xs || 12,
    color: colors.gray500 || '#9CA3AF',
    marginBottom: 20,
  },
  uploadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  uploadingModalText: {
    fontSize: typography.sizes?.sm || 14,
    color: colors.primary || '#007AFF',
  },
});

export default ResumeSection;