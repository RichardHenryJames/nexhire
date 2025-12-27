import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TextInput,
  Image,
  Platform,
  ScrollView,
  Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import refopenAPI from '../services/api';
import { showToast } from './Toast';
import { typography } from '../styles/theme';
import { useTheme } from '../contexts/ThemeContext';

/**
 * ViewReferralRequestModal - Enhanced referral flow modal
 * 
 * Flow:
 * 1. Opens with referral message & candidate info (logs "Viewed" status)
 * 2. User clicks "I'll Refer" (logs "Claimed" status)  
 * 3. Proof upload section appears
 * 4. User uploads proof & clicks "Submit Referral" (logs "ProofUploaded" + "Completed")
 */
export default function ViewReferralRequestModal({ 
  visible, 
  onClose, 
  onSubmit, 
  referralRequest,
  jobTitle = 'this job',
  currentUserId = null  // NEW: Pass current user's UserID to check if they claimed
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  // Step state: 'viewing' | 'claimed' (shows proof upload)
  const [step, setStep] = useState('viewing');
  const [claiming, setClaiming] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [proofImage, setProofImage] = useState(null);
  const [description, setDescription] = useState('');

  // Determine initial step based on current status AND who claimed it
  const getInitialStep = (status, assignedReferrerUserID) => {
    // If current user is the one who claimed, show proof upload step
    if (assignedReferrerUserID && assignedReferrerUserID === currentUserId) {
      const claimedStatuses = ['Claimed', 'ProofUploaded', 'Completed', 'Verified'];
      if (claimedStatuses.includes(status)) {
        return 'claimed';
      }
    }
    // Otherwise, always start with viewing step (even if someone else claimed)
    return 'viewing';
  };

  // Reset state when modal opens/closes
  useEffect(() => {
    if (visible && referralRequest) {
      // Set initial step based on current status AND who claimed
      const initialStep = getInitialStep(referralRequest.Status, referralRequest.AssignedReferrerUserID);
      setStep(initialStep);
      setProofImage(null);
      setDescription('');
      
      // Only log "Viewed" status if not already claimed by current user
      if (initialStep === 'viewing') {
        logViewedStatus();
      }
    }
  }, [visible, referralRequest?.RequestID, referralRequest?.Status, referralRequest?.AssignedReferrerUserID, currentUserId]);

  const logViewedStatus = async () => {
    if (!referralRequest?.RequestID) return;
    
    try {
      await refopenAPI.logReferralStatus(referralRequest.RequestID, 'Viewed');
      console.log('📊 Viewed status logged');
    } catch (error) {
      console.warn('Failed to log Viewed status:', error);
      // Non-critical, don't show error to user
    }
  };

  const handleIllRefer = async () => {
    if (!referralRequest?.RequestID) return;
    
    setClaiming(true);
    try {
      // Log "Claimed" status
      await refopenAPI.logReferralStatus(
        referralRequest.RequestID, 
        'Claimed',
        'Referrer started working on this request'
      );
      console.log('📊 Claimed status logged');
      
      // Move to proof upload step
      setStep('claimed');
      showToast('Great! Now upload proof of your referral', 'success');
    } catch (error) {
      console.error('Failed to log Claimed status:', error);
      // Still proceed even if logging fails
      setStep('claimed');
    } finally {
      setClaiming(false);
    }
  };

  const handleOpenResume = () => {
    const resumeUrl = referralRequest?.ResumeURL;
    if (resumeUrl) {
      if (Platform.OS === 'web') {
        window.open(resumeUrl, '_blank');
      } else {
        Linking.openURL(resumeUrl).catch(() => {
          Alert.alert('Error', 'Could not open resume');
        });
      }
    } else {
      showToast('Resume not available', 'error');
    }
  };

  const handleImagePicker = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: false
      });

      if (!result.canceled && result.assets?.[0]) {
        setProofImage(result.assets[0]);
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to access image picker: ' + error.message);
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!proofImage) {
      Alert.alert('Proof Required', 'Please upload a screenshot showing your referral');
      return;
    }

    if (description.trim().length < 10) {
      Alert.alert('Description Required', 'Please provide a brief description of your referral (at least 10 characters)');
      return;
    }

    try {
      setUploading(true);

      // Upload image to storage
      const uploadResponse = await refopenAPI.uploadFile(proofImage.uri, 'referral-proofs');
      
      if (!uploadResponse.success) {
        throw new Error(uploadResponse.error || 'Failed to upload proof image');
      }

      const proofData = {
        proofFileURL: uploadResponse.data.fileUrl,
        proofFileType: getFileType(proofImage.uri),
        proofDescription: description.trim()
      };

      // Call the submit handler (this calls /claim API which handles both new claims and continue flow)
      await onSubmit(proofData);
      
      // Reset form
      setProofImage(null);
      setDescription('');
      setStep('viewing');
      showToast('Referral submitted successfully!', 'success');
      
    } catch (error) {
      console.error('Submit proof error:', error);
      Alert.alert('Error', error.message || 'Failed to submit referral');
    } finally {
      setUploading(false);
    }
  }, [proofImage, description, onSubmit]);

  const handleClose = useCallback(() => {
    if (uploading || claiming) return;
    setProofImage(null);
    setDescription('');
    setStep('viewing');
    onClose();
  }, [uploading, claiming, onClose]);

  const getFileType = (uri) => {
    const extension = uri.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'png': return 'image/png';
      case 'jpg':
      case 'jpeg': return 'image/jpeg';
      case 'gif': return 'image/gif';
      case 'webp': return 'image/webp';
      default: return 'image/jpeg';
    }
  };

  const applicantName = referralRequest?.ApplicantName || 'Job Seeker';
  const referralMessage = referralRequest?.ReferralMessage;
  const companyName = referralRequest?.CompanyName || 'Company';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>
            {step === 'viewing' ? 'Referral Request' : 'Submit Referral Proof'}
          </Text>
          <TouchableOpacity onPress={handleClose} disabled={uploading || claiming}>
            <Ionicons name="close" size={24} color={colors.gray600} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Job & Company Info */}
          <View style={styles.jobInfo}>
            <View style={styles.jobHeader}>
              {referralRequest?.OrganizationLogo ? (
                <Image 
                  source={{ uri: referralRequest.OrganizationLogo }} 
                  style={styles.companyLogo}
                />
              ) : (
                <View style={styles.logoPlaceholder}>
                  <Ionicons name="business" size={24} color={colors.gray500} />
                </View>
              )}
              <View style={styles.jobDetails}>
                <Text style={styles.jobTitle}>{jobTitle}</Text>
                <Text style={styles.companyName}>{companyName}</Text>
              </View>
            </View>
          </View>

          {/* Candidate Info Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="person-circle-outline" size={20} color={colors.primary} />
              <Text style={styles.sectionTitle}>Candidate Information</Text>
            </View>
            
            <View style={styles.candidateCard}>
              <View style={styles.candidateRow}>
                {referralRequest?.ApplicantProfilePictureURL ? (
                  <Image 
                    source={{ uri: referralRequest.ApplicantProfilePictureURL }} 
                    style={styles.candidateAvatar}
                  />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Ionicons name="person" size={20} color={colors.gray500} />
                  </View>
                )}
                <View style={styles.candidateInfo}>
                  <Text style={styles.candidateName}>{applicantName}</Text>
                  <Text style={styles.candidateEmail}>{referralRequest?.ApplicantEmail || ''}</Text>
                </View>
              </View>
              
              {/* Resume Button - Inside modal */}
              <TouchableOpacity style={styles.resumeButton} onPress={handleOpenResume}>
                <Ionicons name="document-text" size={18} color={colors.white} />
                <Text style={styles.resumeButtonText}>View Resume</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Referral Message Section */}
          {referralMessage && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.primary} />
                <Text style={styles.sectionTitle}>Message from Candidate</Text>
              </View>
              
              <View style={styles.messageCard}>
                <Text style={styles.messageText}>"{referralMessage}"</Text>
              </View>
            </View>
          )}

          {/* No Message Placeholder */}
          {!referralMessage && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.gray400} />
                <Text style={[styles.sectionTitle, { color: colors.gray400 }]}>Message from Candidate</Text>
              </View>
              <View style={[styles.messageCard, { backgroundColor: colors.gray100 }]}>
                <Text style={[styles.messageText, { color: colors.gray500, fontStyle: 'italic' }]}>
                  No message provided
                </Text>
              </View>
            </View>
          )}

          {/* Proof Upload Section - Only shows after "I'll Refer" is clicked */}
          {step === 'claimed' && (
            <>
              <View style={styles.divider} />
              
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="camera-outline" size={20} color={colors.success} />
                  <Text style={styles.sectionTitle}>Upload Referral Proof</Text>
                </View>
                <Text style={styles.sectionDescription}>
                  Upload a screenshot showing you referred this candidate (e.g., email confirmation, internal portal)
                </Text>
                
                {proofImage ? (
                  <View style={styles.imageContainer}>
                    <Image source={{ uri: proofImage.uri }} style={styles.previewImage} />
                    <TouchableOpacity 
                      style={styles.changeImageButton}
                      onPress={handleImagePicker}
                      disabled={uploading}
                    >
                      <Ionicons name="camera" size={16} color={colors.primary} />
                      <Text style={styles.changeImageText}>Change Image</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity 
                    style={styles.uploadButton}
                    onPress={handleImagePicker}
                    disabled={uploading}
                  >
                    <Ionicons name="cloud-upload-outline" size={32} color={colors.gray600} />
                    <Text style={styles.uploadButtonText}>Upload Screenshot</Text>
                    <Text style={styles.uploadButtonSubtext}>Tap to select from gallery</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Description Section */}
              <View style={styles.section}>
                <Text style={styles.inputLabel}>Description *</Text>
                <TextInput
                  style={styles.textInput}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="E.g., Sent candidate's profile via company email to hiring manager..."
                  placeholderTextColor={colors.gray500}
                  multiline
                  numberOfLines={4}
                  maxLength={500}
                  editable={!uploading}
                />
                <Text style={styles.characterCount}>{description.length}/500</Text>
              </View>

              {/* Requirements */}
              <View style={styles.requirements}>
                <Text style={styles.requirementsTitle}>Requirements:</Text>
                <View style={styles.requirement}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                  <Text style={styles.requirementText}>Screenshot showing referral action</Text>
                </View>
                <View style={styles.requirement}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                  <Text style={styles.requirementText}>Clear description of referral method</Text>
                </View>
              </View>
            </>
          )}
        </ScrollView>

        {/* Footer with Action Buttons */}
        <View style={styles.footer}>
          {step === 'viewing' ? (
            // Step 1: "I'll Refer" button
            <TouchableOpacity
              style={styles.illReferButton}
              onPress={handleIllRefer}
              disabled={claiming}
            >
              {claiming ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <>
                  <Ionicons name="hand-right" size={20} color={colors.white} />
                  <Text style={styles.illReferButtonText}>I'll Refer This Candidate</Text>
                </>
              )}
            </TouchableOpacity>
          ) : (
            // Step 2: "Submit Referral" button
            <TouchableOpacity
              style={[
                styles.submitButton,
                (!proofImage || description.trim().length < 10 || uploading) && styles.submitButtonDisabled
              ]}
              onPress={handleSubmit}
              disabled={!proofImage || description.trim().length < 10 || uploading}
            >
              {uploading ? (
                <ActivityIndicator size="small" color={colors.white} style={{ marginRight: 8 }} />
              ) : (
                <Ionicons name="send" size={18} color={colors.white} style={{ marginRight: 8 }} />
              )}
              <Text style={styles.submitButtonText}>
                {uploading ? 'Submitting...' : 'Submit Referral'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  
  // Job Info Section
  jobInfo: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  jobHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  companyLogo: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: colors.gray100,
  },
  logoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  jobDetails: {
    flex: 1,
    marginLeft: 12,
  },
  jobTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 2,
  },
  companyName: {
    fontSize: typography.sizes.base,
    color: colors.textSecondary,
  },
  
  // Section Styles
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginLeft: 8,
  },
  sectionDescription: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  
  // Candidate Card
  candidateCard: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  candidateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  candidateAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.gray100,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  candidateInfo: {
    flex: 1,
    marginLeft: 12,
  },
  candidateName: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: 2,
  },
  candidateEmail: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  resumeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  resumeButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.white,
    marginLeft: 6,
  },
  
  // Message Card
  messageCard: {
    backgroundColor: colors.primary + '10',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  messageText: {
    fontSize: typography.sizes.base,
    color: colors.text,
    lineHeight: 22,
    fontStyle: 'italic',
  },
  
  // Divider
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 20,
  },
  
  // Upload Section
  uploadButton: {
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  uploadButtonText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.text,
    marginTop: 8,
  },
  uploadButtonSubtext: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: 4,
  },
  imageContainer: {
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: colors.background,
  },
  changeImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.primary + '15',
    borderRadius: 20,
  },
  changeImageText: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    marginLeft: 6,
    fontWeight: typography.weights.medium,
  },
  
  // Input
  inputLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    fontSize: typography.sizes.base,
    color: colors.text,
    backgroundColor: colors.surface,
    textAlignVertical: 'top',
    minHeight: 100,
  },
  characterCount: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    textAlign: 'right',
    marginTop: 8,
  },
  
  // Requirements
  requirements: {
    backgroundColor: colors.info + '10',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: colors.info,
  },
  requirementsTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.info,
    marginBottom: 12,
  },
  requirement: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  requirementText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginLeft: 8,
  },
  
  // Footer
  footer: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  illReferButton: {
    backgroundColor: colors.success,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  illReferButtonText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.white,
    marginLeft: 8,
  },
  submitButton: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: colors.gray400,
  },
  submitButtonText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.white,
  },
});
