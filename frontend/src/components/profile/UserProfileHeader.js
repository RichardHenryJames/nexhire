import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Alert, 
  ActivityIndicator,
  Platform,
  Image,
  Modal
} from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../contexts/ThemeContext';
import refopenAPI from '../../services/api';

// CROSS-PLATFORM FILE SYSTEM HANDLER
class CrossPlatformFileHandler {
  static async readAsBase64(uri, options = {}) {
    if (Platform.OS === 'web') {
      // Web implementation using fetch + FileReader
      try {
        const response = await fetch(uri);
        const blob = await response.blob();
        
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result;
            // Remove data:image/jpeg;base64, prefix if present
            const base64Data = result.includes(',') ? result.split(',')[1] : result;
            resolve(base64Data);
          };
          reader.onerror = () => reject(new Error('Failed to read file as base64'));
          reader.readAsDataURL(blob);
        });
      } catch (error) {
        throw new Error(`Web file reading failed: ${error.message}`);
      }
    } else {
      // Mobile implementation using expo-file-system
      try {
        const FileSystem = require('expo-file-system');
        return await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
          ...options
        });
      } catch (error) {
        throw new Error(`Mobile file reading failed: ${error.message}`);
      }
    }
  }

  static async requestPermissions() {
    if (Platform.OS === 'web') {
      // Web doesn't need explicit permissions for file picker
      return { granted: true };
    } else {
      // Mobile permission handling
      const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
      const { status: libraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      return {
        granted: cameraStatus === 'granted' && libraryStatus === 'granted',
        cameraStatus,
        libraryStatus
      };
    }
  }
}

// ? BEAUTIFUL USER PROFILE HEADER WITH CIRCULAR PROGRESS
export default function UserProfileHeader({ 
  user, 
  profile, 
  jobSeekerProfile,
  employerProfile,
  userType,
  onProfileUpdate,
  showStats = false, // NEW: hide right-side Education/Skills/% Complete by default
  showProgress = true, // NEW: hide circular progress ring when viewing others' profiles
  isVerifiedUser = false, // NEW: Show verified badge if user is a permanently verified user
  isVerifiedReferrer = false, // Show if user is a verified referrer
  onBecomeVerifiedReferrer = null // Callback when "Become Verified Referrer" is clicked
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [uploading, setUploading] = useState(false);
  const [profileCompleteness, setProfileCompleteness] = useState(0);
  const [showImagePickerModal, setShowImagePickerModal] = useState(false);
  const [verifyingReferrer, setVerifyingReferrer] = useState(false);

  // CALCULATE PROFILE COMPLETENESS BASED ON ACTUAL PROFILE FIELDS
  useEffect(() => {
    calculateProfileCompleteness();
  }, [profile, jobSeekerProfile, employerProfile, userType]);

  const calculateProfileCompleteness = () => {
    const requiredFields = userType === 'JobSeeker' ? [
      // Basic Info (Users table) - 30%
      profile?.firstName,
      profile?.lastName, 
      profile?.email,
      profile?.phone,
      profile?.profilePictureURL,
      
      // Professional Info (Applicants table) - 40%
      jobSeekerProfile?.headline,
      jobSeekerProfile?.currentJobTitle,
      jobSeekerProfile?.currentCompany,
      jobSeekerProfile?.yearsOfExperience,
      jobSeekerProfile?.currentLocation,
      jobSeekerProfile?.summary,
      
      // Education (Applicants table) - 20%
      jobSeekerProfile?.highestEducation,
      jobSeekerProfile?.fieldOfStudy,
      jobSeekerProfile?.institution,
      
      // Skills & Preferences (Applicants table) - 10%
      jobSeekerProfile?.primarySkills?.length > 0 ? 'skills' : null,
      jobSeekerProfile?.preferredJobTypes,
      jobSeekerProfile?.preferredWorkTypes,
    ] : [
      // Employer Basic Info - 40%
      profile?.firstName,
      profile?.lastName,
      profile?.email,
      profile?.phone,
      profile?.profilePictureURL,
      
      // Organization Info - 60%
      employerProfile?.jobTitle,
      employerProfile?.department,
      employerProfile?.organizationName,
      employerProfile?.organizationSize,
      employerProfile?.industry,
      employerProfile?.recruitmentFocus,
    ];

    const filledFields = requiredFields.filter(field => {
      if (typeof field === 'string') return field.trim().length > 0;
      if (typeof field === 'number') return field > 0;
      return !!field;
    }).length;

    const completeness = Math.round((filledFields / requiredFields.length) * 100);
    setProfileCompleteness(Math.min(completeness, 100));
  };

  // FIXED PROGRESS RING (Guaranteed 12 o'clock start)
  const CircularProgress = ({ percentage, size = 100 }) => {
    // Color based on completion percentage
    let progressColor = '#EF4444'; // Red for < 15%
    if (percentage >= 75) {
      progressColor = '#10B981'; // Green for 75%+
    } else if (percentage >= 15) {
      progressColor = '#F59E0B'; // Yellow for 15-74%
    }

    const strokeWidth = 3;
    const radius = (size - strokeWidth * 2) / 2;
    const circumference = 2 * Math.PI * radius;
    const strokeDasharray = circumference;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    if (Platform.OS === 'web') {
      return (
        <View style={[styles.progressContainer, { width: size, height: size }]}>
          <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
            {/* Background circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="#E5E7EB"
              strokeWidth={strokeWidth}
              fill="transparent"
            />
            {/* Progress circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={progressColor}
              strokeWidth={strokeWidth}
              fill="transparent"
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              style={{
                transition: 'stroke-dashoffset 0.5s ease-in-out'
              }}
            />
          </svg>
        </View>
      );
    }

    // Mobile fallback with proper rotation
    return (
      <View style={[styles.progressContainer, { width: size, height: size }]}>
        <View style={[
          styles.progressBackgroundCircle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: strokeWidth,
            borderColor: '#E5E7EB',
          }
        ]} />
        
        {percentage > 0 && (
          <View style={[
            styles.progressArc,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: strokeWidth,
              borderColor: 'transparent',
              borderTopColor: progressColor,
              borderRightColor: percentage > 25 ? progressColor : 'transparent',
              borderBottomColor: percentage > 50 ? progressColor : 'transparent',
              borderLeftColor: percentage > 75 ? progressColor : 'transparent',
              transform: [{ rotate: '-90deg' }],
              position: 'absolute',
            }
          ]} />
        )}
      </View>
    );
  };

  // IMAGE PICKER FUNCTIONS
  const requestPermissions = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please allow access to your photo library to update your profile picture.'
        );
        return false;
      }
    }
    return true;
  };

  // CROSS-PLATFORM IMAGE PICKER
  const showImagePicker = () => {
    const options = [
      {
        text: 'Take Photo',
        onPress: () => {
          setShowImagePickerModal(false);
          pickImage('camera');
        },
        icon: 'camera-alt'
      },
      {
        text: 'Choose from Library', 
        onPress: () => {
          setShowImagePickerModal(false);
          pickImage('library');
        },
        icon: 'photo-library'
      },
      {
        text: 'Cancel',
        style: 'cancel',
        onPress: () => setShowImagePickerModal(false),
        icon: 'cancel'
      }
    ];

    if (Platform.OS === 'web') {
      // Web: Direct to library picker
      pickImage('library'); 
    } else {
      // Mobile: Show action sheet
      Alert.alert(
        'Select Profile Picture',
        'Choose how you want to update your profile picture',
        options
      );
    }
  };

  const pickImage = async (type) => {
    try {
      // Check permissions first
      const permissionResult = await CrossPlatformFileHandler.requestPermissions();
      
      if (!permissionResult.granted) {
        Alert.alert(
          'Permission Required',
          'Please grant camera and photo library permissions to upload profile pictures.'
        );
        return;
      }

      const commonOptions = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1], // Square aspect ratio for profile pictures
        quality: 0.5, // Reduce quality to 50% to decrease file size
        base64: false // We'll handle base64 conversion ourselves
      };

      let result;

      if (type === 'camera') {
        if (Platform.OS === 'web') {
          // Web doesn't support camera, fallback to library
          Alert.alert('Camera Not Available', 'Camera is not available on web. Using photo library instead.');
          result = await ImagePicker.launchImageLibraryAsync(commonOptions);
        } else {
          result = await ImagePicker.launchCameraAsync(commonOptions);
        }
      } else {
        result = await ImagePicker.launchImageLibraryAsync(commonOptions);
      }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedImage = result.assets[0];

        await uploadImage(selectedImage);
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  // CLEAN AZURE STORAGE UPLOAD
  const uploadImage = async (imageAsset) => {
    try {
      setUploading(true);

      // Validate image asset
      if (!imageAsset || !imageAsset.uri) {
        throw new Error('Invalid image selected');
      }

      // FIXED: Proper file extension detection for data URLs
      let fileExtension = 'jpg'; // Default fallback
      
      if (imageAsset.uri.startsWith('data:')) {
        // For data URLs, extract from MIME type
        const mimeType = imageAsset.uri.split(';')[0].split(':')[1];
        if (mimeType === 'image/jpeg') fileExtension = 'jpg';
        else if (mimeType === 'image/png') fileExtension = 'png';
        else if (mimeType === 'image/webp') fileExtension = 'webp';
      } else {
        // For file URLs, extract from path
        const pathExtension = imageAsset.uri.split('.').pop()?.toLowerCase();
        if (pathExtension && ['jpg', 'jpeg', 'png', 'webp'].includes(pathExtension)) {
          fileExtension = pathExtension;
        }
      }

      // Generate unique filename
      const fileName = `profile-${user?.UserID}-${Date.now()}.${fileExtension}`;
      
      // FIXED: Proper MIME type detection
      let mimeType = imageAsset.type;
      if (!mimeType) {
        // Fallback: determine from file extension
        const mimeMap = {
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg', 
          'png': 'image/png',
          'webp': 'image/webp'
        };
        mimeType = mimeMap[fileExtension] || 'image/jpeg';
      }

      // Clean any data URL contamination
      if (mimeType.includes('data:')) {
        mimeType = mimeType.split(';')[0].replace('data:', '');
      }

      // Convert to base64
      const base64 = await CrossPlatformFileHandler.readAsBase64(imageAsset.uri);

      if (!base64) {
        throw new Error('Failed to convert image to base64');
      }

      // Validate base64 is clean (no data URL prefix)
      if (base64.includes('data:') || base64.includes(';base64,')) {
        throw new Error('Base64 conversion failed - contains data URL prefix');
      }

      // Check base64 size
      const base64Size = base64.length;
      const estimatedSizeKB = Math.round((base64Size * 3) / 4 / 1024);

      // If image is too large (>1MB base64), show warning
      if (base64Size > 1024 * 1024) {
        // Large image detected
      }

      // Final validation
      const validMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!validMimeTypes.includes(mimeType)) {
        throw new Error(`Invalid file type: ${mimeType}. Allowed types: ${validMimeTypes.join(', ')}`);
      }

      // Upload to Azure Storage
      const uploadResult = await refopenAPI.uploadProfileImage({
        fileName,
        fileData: base64,
        mimeType,
        userId: user?.UserID,
      });

      if (uploadResult && uploadResult.success) {
        // Update local profile state
        const updatedProfile = {
          ...profile,
          profilePictureURL: uploadResult.data.imageUrl,
        };
        
        // Update profile in backend
        try {
          await refopenAPI.updateProfile({
            profilePictureURL: uploadResult.data.imageUrl,
          });
        } catch (updateError) {
          // Continue anyway - image uploaded successfully
        }

        // Notify parent component
        onProfileUpdate?.(updatedProfile);
        
        Alert.alert('Success! ??', 'Your profile picture has been updated successfully!');
      } else {
        throw new Error(uploadResult?.error || 'Upload failed - no response from server');
      }
    } catch (error) {
      console.error('Upload error:', error);
      
      let userMessage = 'Failed to upload profile picture. Please try again.';
      
      if (error.message?.includes('Request URL Too Long') || error.message?.includes('414')) {
        userMessage = 'Image file is too large. Please select a smaller image or try a different format.';
      } else if (error.message?.includes('Base64 conversion failed')) {
        userMessage = 'Image processing failed. Please try selecting a different image.';
      } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
        userMessage = 'Network error. Please check your internet connection and try again.';
      } else if (error.message?.includes('Invalid file type')) {
        userMessage = error.message;
      }
      
      Alert.alert('Upload Failed', userMessage);
    } finally {
      setUploading(false);
    }
  };

  // GET PROFILE PICTURE OR INITIALS
  const getProfileImage = () => {
    if (profile?.profilePictureURL) {
      return { uri: profile.profilePictureURL };
    }
    return null;
  };

  const getInitials = () => {
    const firstName = profile?.firstName || user?.FirstName || '';
    const lastName = profile?.lastName || user?.LastName || '';
    const firstInitial = firstName.charAt(0).toUpperCase();
    const lastInitial = lastName.charAt(0).toUpperCase();
    return `${firstInitial}${lastInitial}`;
  };

  // GET STATUS BADGE
  const getStatusBadge = () => {
    if (userType === 'JobSeeker') {
      if (jobSeekerProfile?.isOpenToWork) {
        return { text: 'Open to Work', color: '#10B981', icon: 'checkmark-circle' };
      }
      return { text: 'Not Looking', color: '#6B7280', icon: 'pause-circle' };
    } else {
      return { text: 'Recruiter', color: '#3B82F6', icon: 'business' };
    }
  };

  // ?STATUS BADGE RENDERER
  const renderStatusBadge = () => {
    let badgeText = '';
    let badgeColor = colors.gray600;
    let badgeIcon = 'person';

    // For JobSeekers - show "Become Verified Referrer" button if not verified, or "Verified Referrer" badge if verified
    if (userType === 'JobSeeker') {
      if (isVerifiedReferrer) {
        // Show Verified Referrer badge
        return (
          <View style={[styles.statusBadge, { backgroundColor: colors.success + '15' }]}>
            <Ionicons name="shield-checkmark" size={14} color={colors.success} />
            <Text style={[styles.statusBadgeText, { color: colors.success }]}>
              Verified Referrer
            </Text>
          </View>
        );
      } else if (onBecomeVerifiedReferrer) {
        // Show "Become Verified Referrer" button
        return (
          <TouchableOpacity 
            style={[styles.becomeReferrerButton, { backgroundColor: colors.primary + '15', borderColor: colors.primary }]}
            onPress={async () => {
              setVerifyingReferrer(true);
              try {
                await onBecomeVerifiedReferrer();
              } finally {
                setVerifyingReferrer(false);
              }
            }}
            disabled={verifyingReferrer}
            activeOpacity={0.7}
          >
            {verifyingReferrer ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <Ionicons name="shield-checkmark" size={14} color={colors.primary} />
                <Text style={[styles.becomeReferrerText, { color: colors.primary }]}>
                  Become Verified Referrer
                </Text>
              </>
            )}
          </TouchableOpacity>
        );
      }
      return null;
    } else if (userType === 'Employer') {
      badgeText = 'Recruiter';
      badgeColor = '#3B82F6'; // Blue
      badgeIcon = 'business';
    }

    if (!badgeText) return null;

    return (
      <View style={[styles.statusBadge, { backgroundColor: badgeColor + '15' }]}>
        <MaterialIcons name={badgeIcon} size={14} color={badgeColor} />
        <Text style={[styles.statusBadgeText, { color: badgeColor }]}>
          {badgeText}
        </Text>
      </View>
    );
  };

  const status = getStatusBadge();

  // ✅ Fix the "0" issue by ensuring no stray elements are rendered
  return (
    <View style={styles.headerCard}>
      {/* CLEAN COMPACT LAYOUT */}
      <View style={styles.mainContent}>
        {/* Profile Picture with Progress Ring */}
        <View style={styles.profileSection}>
          {showProgress ? (
            <View style={styles.profileImageWrapper}>
              <CircularProgress percentage={profileCompleteness} size={100} />
              
              <TouchableOpacity 
                style={styles.profileImageTouchable}
                onPress={onProfileUpdate ? () => setShowImagePickerModal(true) : undefined}
                activeOpacity={onProfileUpdate ? 0.8 : 1}
                disabled={!onProfileUpdate}
              >
                <View style={styles.profileImageInner}>
                  {profile?.profilePictureURL ? (
                    <Image 
                      source={{ uri: profile.profilePictureURL }} 
                      style={styles.profileImage}
                    />
                  ) : (
                    <View style={styles.profileImagePlaceholder}>
                      <Text style={styles.initialsText}>
                        {getInitials()}
                      </Text>
                    </View>
                  )}
                  
                  {uploading && (
                    <View style={styles.uploadingOverlay}>
                      <ActivityIndicator size="small" color={colors.white} />
                    </View>
                  )}
                  
                  {onProfileUpdate && (
                    <View style={styles.cameraIcon}>
                      <MaterialIcons name="camera-alt" size={14} color={colors.white} />
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity 
              style={styles.profileImageStandalone}
              onPress={onProfileUpdate ? () => setShowImagePickerModal(true) : undefined}
              activeOpacity={onProfileUpdate ? 0.8 : 1}
              disabled={!onProfileUpdate}
            >
              {profile?.profilePictureURL ? (
                <Image 
                  source={{ uri: profile.profilePictureURL }} 
                  style={styles.profileImageStandaloneImg}
                />
              ) : (
                <View style={styles.profileImagePlaceholderStandalone}>
                  <Text style={styles.initialsText}>
                    {getInitials()}
                  </Text>
                </View>
              )}
              
              {uploading && (
                <View style={styles.uploadingOverlay}>
                  <ActivityIndicator size="small" color={colors.white} />
                </View>
              )}
              
              {onProfileUpdate && (
                <View style={styles.cameraIcon}>
                  <MaterialIcons name="camera-alt" size={14} color={colors.white} />
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* User Info */}
        <View style={styles.infoSection}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <Text style={[styles.userName, { marginBottom: 0 }]}>
              {user?.FirstName?.charAt(0).toUpperCase() + user?.FirstName?.slice(1).toLowerCase()} {user?.LastName?.charAt(0).toUpperCase() + user?.LastName?.slice(1).toLowerCase()}
            </Text>
            {isVerifiedUser && (
              <MaterialIcons 
                name="verified" 
                size={20} 
                color={colors.primary} 
                style={{ marginLeft: 6 }} 
              />
            )}
          </View>
          
          {/* Current Job Title or Education for students */}
          {userType === 'JobSeeker' && (
            <>
              {/* Prioritize work experience if available */}
              {jobSeekerProfile?.currentJobTitle && jobSeekerProfile?.currentCompany ? (
                <Text style={styles.jobTitle}>
                  {jobSeekerProfile.currentJobTitle} at {jobSeekerProfile.currentCompany}
                </Text>
              ) : (
                /* Show education if no work experience */
                jobSeekerProfile?.highestEducation && (
                  <Text style={styles.jobTitle}>
                    {jobSeekerProfile.highestEducation}
                    {jobSeekerProfile?.fieldOfStudy && ` in ${jobSeekerProfile.fieldOfStudy}`}
                    {jobSeekerProfile?.institution && ` at ${jobSeekerProfile.institution}`}
                  </Text>
                )
              )}
            </>
          )}
          
          {userType === 'Employer' && employerProfile?.jobTitle && (
            <Text style={styles.jobTitle}>
              {employerProfile.jobTitle}
              {employerProfile?.organizationName && ` at ${employerProfile.organizationName}`}
            </Text>
          )}

          {/* Location */}
          {userType === 'JobSeeker' && jobSeekerProfile?.currentLocation && (
            <View style={styles.locationRow}>
              <MaterialIcons name="location-on" size={16} color="#6B7280" />
              <Text style={styles.locationText}>{jobSeekerProfile.currentLocation}</Text>
            </View>
          )}

          {/* Status Badge */}
          {renderStatusBadge()}
        </View>

        {/* Right Stats - now optional via prop */}
        {showStats && userType === 'JobSeeker' && (
          <View style={styles.statsColumn}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {/* Show meaningful experience or education data */}
                {(jobSeekerProfile?.yearsOfExperience && jobSeekerProfile.yearsOfExperience > 0) 
                  ? jobSeekerProfile.yearsOfExperience 
                  : (jobSeekerProfile?.graduationYear && jobSeekerProfile.graduationYear.trim()
                      ? Math.max(1, new Date().getFullYear() - parseInt(jobSeekerProfile.graduationYear))
                      : (jobSeekerProfile?.highestEducation ? 'Fresh' : 0)
                    )
                }
              </Text>
              <Text style={styles.statLabel}>
                {(jobSeekerProfile?.yearsOfExperience && jobSeekerProfile.yearsOfExperience > 0) 
                  ? 'Years' 
                  : (jobSeekerProfile?.graduationYear && jobSeekerProfile.graduationYear.trim()
                      ? 'Education'
                      : (jobSeekerProfile?.highestEducation ? 'Graduate' : 'Experience')
                    )
                }
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {Array.isArray(jobSeekerProfile?.primarySkills) 
                  ? jobSeekerProfile.primarySkills.length 
                  : (jobSeekerProfile?.primarySkills ? jobSeekerProfile.primarySkills.split(',').length : 0)
                }
              </Text>
              <Text style={styles.statLabel}>Skills</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{Math.round(profileCompleteness)}%</Text>
              <Text style={styles.statLabel}>Complete</Text>
            </View>
          </View>
        )}
      </View>

      {/* IMAGE PICKER MODAL */}
      <Modal
        visible={showImagePickerModal}
        transparent={true}
        onRequestClose={() => setShowImagePickerModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.imagePickerModal}>
            <Text style={styles.modalTitle}>Update Profile Picture</Text>
            
            <TouchableOpacity
              style={styles.pickerOption}
              onPress={() => {
                setShowImagePickerModal(false);
                pickImage('camera');
              }}
            >
              <Ionicons name="camera" size={24} color={colors.primary} />
              <Text style={styles.pickerOptionText}>Take Photo</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.pickerOption}
              onPress={() => {
                setShowImagePickerModal(false);
                pickImage('library');
              }}
            >
              <Ionicons name="images" size={24} color={colors.primary} />
              <Text style={styles.pickerOptionText}>Choose from Library</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.cancelOption}
              onPress={() => setShowImagePickerModal(false)}
            >
              <Text style={styles.cancelOptionText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  // Main Header Card
  headerCard: {
    backgroundColor: colors.surface,
    paddingVertical: 20,
    paddingHorizontal: 20,
    marginTop: 12,
  },

  // Main Content Layout
  mainContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  // Profile Section
  profileSection: {
    marginRight: 16,
  },
  progressContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressBackgroundCircle: {
    position: 'absolute',
  },
  profileImageWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileImageTouchable: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    bottom: 8,
  },
  profileImageInner: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  profileImage: {
    width: '100%',
    height: '100%',
    borderRadius: 42,
  },
  profileImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.primary,
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 42,
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.primary,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.surface,
  },

  // Standalone Profile Image (without progress ring)
  profileImageStandalone: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  profileImageStandaloneImg: {
    width: '100%',
    height: '100%',
    borderRadius: 42,
  },
  profileImagePlaceholderStandalone: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Info Section
  infoSection: {
    flex: 1,
    paddingRight: 12,
  },
  userName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  jobTitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 6,
    lineHeight: 20,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  locationText: {
    fontSize: 14,
    color: colors.textMuted,
    marginLeft: 4,
  },

  // Status Badge
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  
  // Become Verified Referrer Button
  becomeReferrerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
    marginTop: 4,
    borderWidth: 1,
    gap: 6,
  },
  becomeReferrerText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Stats Column
  statsColumn: {
    alignItems: 'center',
    gap: 8,
    minWidth: 60,
  },
  statItem: {
    alignItems: 'center',
    minWidth: 50,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
    lineHeight: 20,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 2,
  },

  // IMAGE PICKER MODAL
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePickerModal: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    width: '80%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: 12,
    borderRadius: 10,
    backgroundColor: colors.gray100,
  },
  pickerOptionText: {
    fontSize: 16,
    color: colors.text,
    marginLeft: 10,
    fontWeight: '500',
  },
  cancelOption: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: colors.error,
    alignItems: 'center',
  },
  cancelOptionText: {
    fontSize: 16,
    color: colors.white,
    fontWeight: '500',
  },
});