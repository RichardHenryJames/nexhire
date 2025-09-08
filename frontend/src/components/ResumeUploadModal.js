/**
 * Enhanced Job Application with Smart Resume Upload Flow
 * 
 * This component provides a seamless experience when applying for jobs:
 * 1. If user has resumes ? show selection + option to upload new
 * 2. If user has no resumes ? automatic upload flow with helpful messaging
 * 3. Smart handling of resume limits and error states
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import nexhireAPI from '../services/api';
import { colors, typography } from '../styles/theme';

const ResumeUploadModal = ({ 
  visible, 
  onClose, 
  onResumeSelected, 
  user,
  jobTitle 
}) => {
  const [uploading, setUploading] = useState(false);
  const [existingResumes, setExistingResumes] = useState([]);
  const [hasCheckedResumes, setHasCheckedResumes] = useState(false);

  // ?? DEBUG: Log when component is rendered
  console.log('?? ResumeUploadModal rendered with visible:', visible);

  useEffect(() => {
    if (visible && !hasCheckedResumes) {
      console.log('?? Modal is visible, checking existing resumes...');
      checkExistingResumes();
    }
  }, [visible]);

  const checkExistingResumes = async () => {
    try {
      setHasCheckedResumes(true);
      const response = await nexhireAPI.getMyResumes();
      
      if (response && response.success && Array.isArray(response.data)) {
        setExistingResumes(response.data);
      } else {
        setExistingResumes([]);
      }
    } catch (error) {
      console.error('Error checking resumes:', error);
      setExistingResumes([]);
    }
  };

  const handleUploadNewResume = async () => {
    try {
      // WEB FALLBACK: use native file input because DocumentPicker can silently fail on web
      if (Platform.OS === 'web') {
        console.log('?? Web platform detected, using <input type=file> fallback');
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        input.style.display = 'none';
        document.body.appendChild(input);
        input.onchange = async (e) => {
          const file = e.target.files && e.target.files[0];
          if (!file) {
            document.body.removeChild(input);
            return;
          }
          console.log('?? File selected (web fallback):', file.name, file.type, file.size);
          if (file.size > 10 * 1024 * 1024) {
            Alert.alert('File Too Large', 'Please select a file smaller than 10MB');
            document.body.removeChild(input);
            return;
          }
          setUploading(true);
          try {
            console.log('?? Starting upload process...');
            
            // ?? TEMPORARY: Skip prompt and use default label for testing
            console.log('?? STEP 1: Using default resume label...');
            const resumeLabel = jobTitle ? `Resume for ${jobTitle}` : 'Application Resume';
            console.log('?? STEP 2: Resume label set to:', resumeLabel);
            
            console.log('?? STEP 3: Calling uploadResume API...');
            console.log('?? API call parameters:', {
              fileName: file.name,
              fileSize: file.size,
              userObject: user,
              userId: user.userId || user.UserID || user.id || user.sub,
              resumeLabel: resumeLabel
            });
            
            // ?? ENSURE we have a valid user ID
            const actualUserId = user.userId || user.UserID || user.id || user.sub;
            if (!actualUserId) {
              throw new Error('User ID not found. Please log in again.');
            }
            
            console.log('?? Using userId:', actualUserId);
            
            const uploadResult = await nexhireAPI.uploadResume(file, actualUserId, resumeLabel);
            console.log('?? STEP 4: Upload result received:', uploadResult);
            
            if (uploadResult.success) {
              const resumeData = {
                ResumeID: uploadResult.data.resumeID || uploadResult.data.ResumeID,
                ResumeURL: uploadResult.data.resumeURL,
                ResumeLabel: resumeLabel,
                IsPrimary: existingResumes.length === 0
              };
              console.log('?? STEP 5: Resume data prepared:', resumeData);
              onResumeSelected(resumeData);
              onClose();
            } else {
              console.error('?? Upload failed:', uploadResult);
              Alert.alert('Upload Failed', uploadResult.error || 'Failed to upload resume');
            }
          } catch (err) {
            console.error('?? Resume upload error (web fallback):', err);
            Alert.alert('Upload Failed', err.message || 'Failed to upload resume. Please try again.');
          } finally {
            setUploading(false);
            document.body.removeChild(input);
          }
        };
        input.click();
        return;
      }

      // Native / Expo (original flow)
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ],
        copyToCacheDirectory: true,
        multiple: false
      });

      console.log('?? Document picker result (native):', result);

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setUploading(true);
        const file = result.assets[0];
        if (file.size > 10 * 1024 * 1024) {
          Alert.alert('File Too Large', 'Please select a file smaller than 10MB');
          setUploading(false);
          return;
        }
        const resumeLabel = await promptForResumeLabel(jobTitle);
        const uploadResult = await nexhireAPI.uploadResume({
          name: file.name,
          size: file.size,
          uri: file.uri,
          type: file.mimeType
        }, user.userId, resumeLabel);
        if (uploadResult.success) {
          const resumeData = {
            ResumeID: uploadResult.data.resumeID || uploadResult.data.ResumeID,
            ResumeURL: uploadResult.data.resumeURL,
            ResumeLabel: resumeLabel,
            IsPrimary: existingResumes.length === 0
          };
          onResumeSelected(resumeData);
          onClose();
        } else {
          Alert.alert('Upload Failed', uploadResult.error || 'Failed to upload resume');
        }
      } else {
        console.log('?? Document picker canceled');
      }
    } catch (error) {
      console.error('Resume upload error:', error);
      Alert.alert('Upload Failed', error.message || 'Failed to upload resume');
    } finally {
      setUploading(false);
    }
  };

  const promptForResumeLabel = (jobTitle) => {
    return new Promise((resolve) => {
      const defaultLabel = jobTitle ? `Resume for ${jobTitle}` : 'Application Resume';
      
      console.log('?? promptForResumeLabel called with jobTitle:', jobTitle);
      console.log('?? Default label:', defaultLabel);
      
      // ?? WEB FIX: Use regular Alert with default label since Alert.prompt doesn't work on web
      Alert.alert(
        'Resume Label',
        `Give this resume a name. Default: "${defaultLabel}"`,
        [
          { text: 'Use Default', onPress: () => {
            console.log('?? User selected default label:', defaultLabel);
            resolve(defaultLabel);
          }},
          { text: 'Custom Name', onPress: () => {
            console.log('?? User wants custom name...');
            // For web, we'll use the default for now
            // In a full implementation, you'd use a custom modal
            try {
              const customName = prompt(`Enter resume name (or leave empty for default):`) || defaultLabel;
              console.log('?? Custom name received:', customName);
              resolve(customName);
            } catch (error) {
              console.error('?? Error with prompt:', error);
              console.log('?? Falling back to default label');
              resolve(defaultLabel);
            }
          }}
        ]
      );
    });
  };

  const handleSelectExistingResume = (resume) => {
    onResumeSelected(resume);
    onClose();
  };

  const renderContent = () => {
    if (existingResumes.length === 0) {
      // No resumes - show upload flow
      return (
        <View style={styles.modalContent}>
          <Ionicons name="document-text-outline" size={64} color={colors.primary} />
          <Text style={styles.modalTitle}>Upload Your Resume</Text>
          <Text style={styles.modalMessage}>
            To apply for jobs, you need to upload a resume. This will be saved to your profile for future applications.
          </Text>
          
          <TouchableOpacity 
            style={styles.uploadButton}
            onPress={handleUploadNewResume}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Ionicons name="cloud-upload-outline" size={20} color={colors.white} />
            )}
            <Text style={styles.uploadButtonText}>
              {uploading ? 'Uploading...' : 'Choose Resume File'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.cancelButton}
            onPress={onClose}
            disabled={uploading}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Has resumes - show selection + upload option
    return (
      <View style={styles.modalContent}>
        <Ionicons name="documents-outline" size={48} color={colors.primary} />
        <Text style={styles.modalTitle}>Select Resume</Text>
        <Text style={styles.modalMessage}>
          Choose which resume to use for this application:
        </Text>

        {/* Existing resumes */}
        {existingResumes.map((resume) => (
          <TouchableOpacity
            key={resume.ResumeID}
            style={[
              styles.resumeOption,
              resume.IsPrimary && styles.primaryResumeOption
            ]}
            onPress={() => handleSelectExistingResume(resume)}
          >
            <Ionicons 
              name="document-text" 
              size={20} 
              color={resume.IsPrimary ? colors.primary : colors.gray600} 
            />
            <View style={styles.resumeInfo}>
              <Text style={[
                styles.resumeLabel,
                resume.IsPrimary && styles.primaryResumeLabel
              ]}>
                {resume.ResumeLabel}
                {resume.IsPrimary && ' (Primary)'}
              </Text>
              <Text style={styles.resumeDate}>
                {resume.UploadedAt ? new Date(resume.UploadedAt).toLocaleDateString() : 'Recently uploaded'}
              </Text>
            </View>
            <Ionicons 
              name="chevron-forward" 
              size={16} 
              color={colors.gray400} 
            />
          </TouchableOpacity>
        ))}

        {/* Upload new option */}
        <TouchableOpacity 
          style={styles.uploadNewOption}
          onPress={handleUploadNewResume}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
          )}
          <Text style={styles.uploadNewText}>
            {uploading ? 'Uploading...' : 'Upload New Resume'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.cancelButton}
          onPress={onClose}
          disabled={uploading}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {renderContent()}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: colors.white,
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalContent: {
    padding: 24,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: typography.sizes.md,
    color: colors.gray600,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  uploadButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 12,
  },
  uploadButtonText: {
    color: colors.white,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    marginLeft: 8, // ?? WEB FIX: Replace gap with marginLeft
  },
  resumeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    marginBottom: 8,
    width: '100%',
  },
  primaryResumeOption: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '08',
  },
  resumeInfo: {
    flex: 1,
    marginLeft: 12,
  },
  resumeLabel: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.text,
    marginBottom: 2,
  },
  primaryResumeLabel: {
    color: colors.primary,
  },
  resumeDate: {
    fontSize: typography.sizes.sm,
    color: colors.gray500,
  },
  uploadNewOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 12,
    borderStyle: 'dashed',
    marginTop: 8,
    marginBottom: 16,
    width: '100%',
  },
  uploadNewText: {
    color: colors.primary,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    marginLeft: 8, // ?? WEB FIX: Replace gap with marginLeft
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  cancelButtonText: {
    color: colors.gray600,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
  },
});

export default ResumeUploadModal;