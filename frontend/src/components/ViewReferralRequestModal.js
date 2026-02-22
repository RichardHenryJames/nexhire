import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Image,
  Platform,
  ScrollView,
  Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import refopenAPI from '../services/api';
import messagingApi from '../services/messagingApi';
import ModalToast from './ModalToast';
import { typography } from '../styles/theme';
import { useTheme } from '../contexts/ThemeContext';
import useResponsive from '../hooks/useResponsive';

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
  const navigation = useNavigation();
  const responsive = useResponsive();
  const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);
  
  // Toast state for modal
  const [toastState, setToastState] = useState({ visible: false, message: '', type: 'success' });
  
  // Helper function to show toast inside modal
  const showToast = (message, type = 'success') => {
    setToastState({ visible: true, message, type });
  };
  
  // Step state: 'viewing' | 'claimed' (shows proof upload)
  const [step, setStep] = useState('viewing');
  const [claiming, setClaiming] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [proofImage, setProofImage] = useState(null);
  const [description, setDescription] = useState('');
  const [startingChat, setStartingChat] = useState(false);
  
  // Validation error states
  const [proofError, setProofError] = useState(false);
  const [descriptionError, setDescriptionError] = useState(false);

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
      setProofError(false);
      setDescriptionError(false);
      
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
          showToast('Could not open resume', 'error');
        });
      }
    } else {
      showToast('Resume not available', 'error');
    }
  };

  // Handle messaging the applicant
  const handleMessageApplicant = async () => {
    const applicantUserId = referralRequest?.ApplicantUserID;
    if (!applicantUserId) {
      showToast('Cannot message this applicant', 'error');
      return;
    }

    try {
      setStartingChat(true);
      const result = await messagingApi.createConversation(applicantUserId);

      if (result.success) {
        // Close modal first
        onClose();
        
        // Navigate to chat with referral context
        navigation.navigate('Chat', {
          conversationId: result.data.ConversationID,
          otherUserName: referralRequest?.ApplicantName || 'Applicant',
          otherUserId: applicantUserId,
          otherUserProfilePic: referralRequest?.ApplicantProfilePictureURL,
          // Pass referral context for tagging
          referralContext: {
            requestId: referralRequest?.RequestID,
            jobTitle: jobTitle,
            companyName: referralRequest?.CompanyName,
            isReferrer: true,
          }
        });
      } else {
        showToast('Failed to start conversation', 'error');
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
      showToast('Failed to start conversation', 'error');
    } finally {
      setStartingChat(false);
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
        setProofError(false); // Clear error when image selected
      }
    } catch (error) {
      console.error('Image picker error:', error);
      showToast('Failed to access image picker. Please try again.', 'error');
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    // Reset errors
    setProofError(false);
    setDescriptionError(false);
    
    let hasErrors = false;
    
    if (!proofImage) {
      setProofError(true);
      hasErrors = true;
    }

    if (description.trim().length < 10) {
      setDescriptionError(true);
      hasErrors = true;
    }
    
    if (hasErrors) {
      showToast('Please fill all required fields', 'error');
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
      showToast('Failed to submit referral. Please try again.', 'error');
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
      <View style={styles.modalOuterContainer}>
        <View style={styles.container}>
          {/* Modal Toast - shows inside modal */}
          <ModalToast
            visible={toastState.visible}
            message={toastState.message}
            type={toastState.type}
            onHide={() => setToastState({ ...toastState, visible: false })}
          />
          
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
          {/* Candidate Info Card - Compact at top */}
          <View style={styles.candidateCardCompact}>
            <View style={styles.candidateRowCompact}>
              {referralRequest?.ApplicantProfilePictureURL ? (
                <Image 
                  source={{ uri: referralRequest.ApplicantProfilePictureURL }} 
                  style={styles.candidateAvatarCompact}
                />
              ) : (
                <View style={[styles.avatarPlaceholderCompact, { backgroundColor: '#667eea' }]}>
                  <Text style={styles.avatarInitialsCompact}>
                    {applicantName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.candidateInfoCompact}>
                {/* Name row — name truncates, Message stays at right */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={[styles.candidateNameCompact, { flex: 1 }]} numberOfLines={1}>{applicantName}</Text>
                  <TouchableOpacity 
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primary + '12', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, flexShrink: 0 }}
                    onPress={handleMessageApplicant}
                    disabled={startingChat}
                  >
                    {startingChat ? (
                      <ActivityIndicator size={12} color={colors.primary} />
                    ) : (
                      <>
                        <Ionicons name="chatbubble-outline" size={12} color={colors.primary} />
                        <Text style={{ fontSize: 11, fontWeight: '600', color: colors.primary }}>Message</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
                <Text style={styles.wantsReferralForText}>
                  wants referral for <Text style={styles.jobTitleInline}>{jobTitle}</Text>
                </Text>
                <Text style={styles.companyTimeText}>{companyName}</Text>
              </View>
            </View>
          </View>

          {/* Refer for: — compact 2-line layout */}
          <View style={[styles.section, { padding: 12 }]}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 6 }}>Refer for:</Text>

            {/* Line 1: Resume | View Job | Job ID — all inline */}
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
              {/* Resume pill */}
              <TouchableOpacity 
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primary + '10', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}
                onPress={handleOpenResume}
              >
                <Ionicons name="document-text-outline" size={13} color={colors.primary} />
                <Text style={{ fontSize: 11, fontWeight: '600', color: colors.primary }}>Resume</Text>
              </TouchableOpacity>

              {/* View Job pill — internal */}
              {referralRequest?.JobID && !referralRequest?.ExtJobID && (
                <TouchableOpacity 
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#10B98110', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}
                  onPress={() => {
                    onClose();
                    navigation.navigate('JobDetails', { jobId: referralRequest.JobID, fromReferralRequest: true });
                  }}
                >
                  <Ionicons name="briefcase-outline" size={13} color="#10B981" />
                  <Text style={{ fontSize: 11, fontWeight: '600', color: '#10B981' }}>View Job</Text>
                </TouchableOpacity>
              )}

              {/* View Job pill — external */}
              {referralRequest?.ExtJobID && referralRequest?.JobURL && (
                <TouchableOpacity 
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#10B98110', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}
                  onPress={() => {
                    if (Platform.OS === 'web') { window.open(referralRequest.JobURL, '_blank'); }
                    else { Linking.openURL(referralRequest.JobURL).catch(() => showToast('Could not open URL', 'error')); }
                  }}
                >
                  <Ionicons name="link-outline" size={13} color="#10B981" />
                  <Text style={{ fontSize: 11, fontWeight: '600', color: '#10B981' }}>View Job</Text>
                </TouchableOpacity>
              )}

              {/* Job ID — external, copyable */}
              {referralRequest?.ExtJobID && (
                <TouchableOpacity 
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.gray100, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}
                  onPress={async () => {
                    try {
                      if (Platform.OS === 'web') await navigator.clipboard.writeText(referralRequest.ExtJobID);
                      showToast('Job ID copied!', 'success');
                    } catch (e) { showToast('Failed to copy', 'error'); }
                  }}
                >
                  <Text style={{ fontSize: 11, color: colors.gray500 }}>ID:</Text>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: colors.text }} numberOfLines={1}>{referralRequest.ExtJobID}</Text>
                  <Ionicons name="copy-outline" size={11} color={colors.primary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Line 2: Location • YOE — inline */}
            {referralRequest?.JobID && !referralRequest?.ExtJobID && (referralRequest.JobLocation || referralRequest.JobExperienceMin != null || referralRequest.JobExperienceMax != null) && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 }}>
                {referralRequest.JobLocation ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <Ionicons name="location-outline" size={12} color={colors.gray500} />
                    <Text style={{ fontSize: 11, color: colors.gray500 }}>{referralRequest.JobLocation}</Text>
                  </View>
                ) : null}
                {(referralRequest.JobExperienceMin != null || referralRequest.JobExperienceMax != null) ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <Ionicons name="time-outline" size={12} color={colors.gray500} />
                    <Text style={{ fontSize: 11, color: colors.gray500 }}>
                      {referralRequest.JobExperienceMin != null && referralRequest.JobExperienceMax != null
                        ? `${referralRequest.JobExperienceMin}-${referralRequest.JobExperienceMax} yrs`
                        : referralRequest.JobExperienceMin != null
                        ? `${referralRequest.JobExperienceMin}+ yrs`
                        : `Up to ${referralRequest.JobExperienceMax} yrs`}
                    </Text>
                  </View>
                ) : null}
              </View>
            )}
          </View>

          {/* Reward Info Banner */}
          <View style={styles.rewardBannerCompact}>
            <Ionicons name="gift" size={20} color="#ffd700" />
            <View style={styles.rewardTextContainerCompact}>
              <Text style={styles.rewardTitleCompact}>Earn Guaranteed Rewards!</Text>
              <Text style={styles.rewardDescriptionCompact}>
                Complete this referral and earn up to <Text style={styles.rewardHighlight}>₹100</Text> immediately.
              </Text>
            </View>
          </View>

          {/* Referral Message Section */}
          {referralMessage ? (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.primary} />
                <Text style={styles.sectionTitle}>Message from Candidate</Text>
              </View>
              <View style={styles.messageCard}>
                <Text style={styles.messageText}>"{referralMessage}"</Text>
              </View>
            </View>
          ) : (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.gray400} />
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
                  <>
                    <TouchableOpacity 
                      style={[styles.uploadButton, proofError && styles.uploadButtonError]}
                      onPress={handleImagePicker}
                      disabled={uploading}
                    >
                      <Ionicons name="cloud-upload-outline" size={32} color={proofError ? colors.error : colors.gray600} />
                      <Text style={[styles.uploadButtonText, proofError && { color: colors.error }]}>Upload Screenshot</Text>
                      <Text style={styles.uploadButtonSubtext}>Tap to select from gallery</Text>
                    </TouchableOpacity>
                    {proofError && (
                      <Text style={styles.errorText}>* Proof screenshot is required</Text>
                    )}
                  </>
                )}
              </View>

              {/* Description Section */}
              <View style={styles.section}>
                <Text style={[styles.inputLabel, descriptionError && { color: colors.error }]}>Description *</Text>
                <TextInput
                  style={[styles.textInput, descriptionError && styles.textInputError]}
                  value={description}
                  onChangeText={(text) => {
                    setDescription(text);
                    if (text.trim().length >= 10) setDescriptionError(false);
                  }}
                  placeholder="E.g., Sent candidate's profile via company email to hiring manager..."
                  placeholderTextColor={colors.gray500}
                  multiline
                  numberOfLines={4}
                  maxLength={500}
                  editable={!uploading}
                />
                <View style={styles.inputFooter}>
                  {descriptionError ? (
                    <Text style={styles.errorText}>* Minimum 10 characters required</Text>
                  ) : (
                    <View />
                  )}
                  <Text style={[styles.characterCount, descriptionError && { color: colors.error }]}>{description.length}/500</Text>
                </View>
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
            // Step 2: "Submit Referral" button - Always clickable, shows errors if fields missing
            <TouchableOpacity
              style={[
                styles.submitButton,
                uploading && styles.submitButtonDisabled
              ]}
              onPress={handleSubmit}
              disabled={uploading}
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
      </View>
    </Modal>
  );
}

const createStyles = (colors, responsive = {}) => StyleSheet.create({
  modalOuterContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: responsive.isDesktop ? 'center' : 'stretch',
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
    width: '100%',
    maxWidth: responsive.isDesktop ? 900 : '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
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
    padding: 16,
  },
  
  // Compact Candidate Card at top
  candidateCardCompact: {
    backgroundColor: colors.surface,
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  candidateRowCompact: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  candidateAvatarCompact: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.gray100,
  },
  avatarPlaceholderCompact: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitialsCompact: {
    fontSize: 18,
    fontWeight: typography.weights.bold,
    color: '#FFFFFF',
  },
  candidateInfoCompact: {
    flex: 1,
    marginLeft: 12,
  },
  candidateNameCompact: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 2,
  },
  wantsReferralForText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  jobTitleInline: {
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  companyTimeText: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },
  candidateActionsCompact: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: colors.primary + '15',
    gap: 4,
  },
  actionPillText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },

  // Compact Reward Banner
  rewardBannerCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#fcd34d',
    gap: 10,
  },
  rewardTextContainerCompact: {
    flex: 1,
  },
  rewardTitleCompact: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: '#92400e',
    marginBottom: 2,
  },
  rewardDescriptionCompact: {
    fontSize: typography.sizes.xs,
    color: '#78350f',
  },
  rewardHighlight: {
    fontWeight: typography.weights.bold,
    color: '#059669',
  },
  
  // Job Details Compact - inline row style
  jobDetailsCompact: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  jobDetailInline: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray100,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  jobDetailLabelInline: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  jobDetailValueInline: {
    fontSize: typography.sizes.sm,
    color: colors.text,
    fontWeight: typography.weights.semibold,
    maxWidth: 120,
  },
  copyBtnSmall: {
    padding: 4,
    borderRadius: 4,
  },
  jobUrlInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  jobUrlTextInline: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: typography.weights.medium,
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
  uploadButtonError: {
    borderColor: colors.error,
    backgroundColor: colors.error + '08',
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
  textInputError: {
    borderColor: colors.error,
    borderWidth: 2,
    backgroundColor: colors.error + '08',
  },
  inputFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  errorText: {
    fontSize: typography.sizes.xs,
    color: colors.error,
    fontWeight: typography.weights.medium,
    marginTop: 6,
  },
  characterCount: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    textAlign: 'right',
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
