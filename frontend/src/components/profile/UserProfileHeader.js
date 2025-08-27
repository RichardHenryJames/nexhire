import React, { useState, useEffect } from 'react';
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
import nexhireAPI from '../../services/api';

// ?? CROSS-PLATFORM FILE SYSTEM HANDLER
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
  onProfileUpdate 
}) {
  const { colors } = useTheme();
  const [uploading, setUploading] = useState(false);
  const [profileCompleteness, setProfileCompleteness] = useState(0);
  const [showImagePickerModal, setShowImagePickerModal] = useState(false);

  // ?? CALCULATE PROFILE COMPLETENESS BASED ON ACTUAL PROFILE FIELDS
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

  // ?? CIRCULAR PROGRESS COMPONENT (Pure React Native - Better Visual)
  const CircularProgress = ({ percentage, size = 120 }) => {
    // Color based on completion percentage
    const progressColor = percentage >= 80 ? '#10B981' : // Green for 80%+
                         percentage >= 60 ? '#F59E0B' : // Yellow for 60%+
                         percentage >= 40 ? '#EF4444' : // Red for 40%+
                         '#9CA3AF'; // Gray for less than 40%

    // Calculate the stroke dash offset for the progress
    const radius = (size - 12) / 2;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    // Create multiple progress segments for smooth visual effect
    const createProgressSegments = () => {
      const segments = [];
      const segmentCount = 60; // 60 segments for smooth progress
      const segmentAngle = 360 / segmentCount;
      const filledSegments = Math.floor((percentage / 100) * segmentCount);

      for (let i = 0; i < segmentCount; i++) {
        const rotation = i * segmentAngle - 90; // Start from top (12 o'clock)
        const isActive = i < filledSegments;
        
        segments.push(
          <View
            key={i}
            style={[
              styles.progressSegment,
              {
                transform: [
                  { rotate: `${rotation}deg` },
                  { translateY: -(size / 2 - 6) }
                ],
                backgroundColor: isActive ? progressColor : '#E5E7EB',
              }
            ]}
          />
        );
      }
      return segments;
    };

    return (
      <View style={[styles.progressContainer, { width: size, height: size }]}>
        {/* Progress segments */}
        <View style={styles.progressRing}>
          {createProgressSegments()}
        </View>
      </View>
    );
  };

  // ?? IMAGE PICKER FUNCTIONS
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

  // ?? CROSS-PLATFORM IMAGE PICKER
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
        quality: 0.8, // Good quality but compressed
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
        console.log('?? Selected image:', {
          uri: selectedImage.uri,
          type: selectedImage.type,
          width: selectedImage.width,
          height: selectedImage.height,
          fileSize: selectedImage.fileSize
        });

        await uploadImage(selectedImage);
      }
    } catch (error) {
      console.error('? Image picker error:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  // ?? CLEAN AZURE STORAGE UPLOAD
  const uploadImage = async (imageAsset) => {
    try {
      setUploading(true);
      console.log('?? Starting image upload...');

      // Validate image asset
      if (!imageAsset || !imageAsset.uri) {
        throw new Error('Invalid image selected');
      }

      // Generate unique filename
      const fileExtension = imageAsset.uri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `profile-${user?.UserID}-${Date.now()}.${fileExtension}`;
      
      // Clean MIME type detection
      let mimeType = imageAsset.type;
      if (!mimeType) {
        // Fallback based on file extension
        const mimeMap = {
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg', 
          'png': 'image/png',
          'webp': 'image/webp'
        };
        mimeType = mimeMap[fileExtension] || 'image/jpeg';
      }

      // Ensure mimeType is clean (no data URL prefix)
      if (mimeType.includes('data:')) {
        mimeType = mimeType.split(';')[0].replace('data:', '');
      }

      console.log('?? Upload details:', {
        fileName,
        mimeType,
        fileExtension,
        originalType: imageAsset.type
      });

      // Convert to base64
      console.log('?? Converting image to base64...');
      const base64 = await CrossPlatformFileHandler.readAsBase64(imageAsset.uri);

      if (!base64) {
        throw new Error('Failed to convert image to base64');
      }

      // Final validation
      const validMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!validMimeTypes.includes(mimeType)) {
        throw new Error(`Invalid file type: ${mimeType}. Allowed types: ${validMimeTypes.join(', ')}`);
      }

      // Upload to Azure Storage
      console.log('?? Uploading to Azure Storage...');
      const uploadResult = await nexhireAPI.uploadProfileImage({
        fileName,
        fileData: base64,
        mimeType,
        userId: user?.UserID,
      });

      if (uploadResult.success) {
        console.log('? Upload successful:', uploadResult.data?.imageUrl);
        
        // Update local profile state
        const updatedProfile = {
          ...profile,
          profilePictureURL: uploadResult.data.imageUrl,
        };
        
        // Update profile in backend
        await nexhireAPI.updateProfile(user?.UserID, {
          profilePictureURL: uploadResult.data.imageUrl,
        });

        // Notify parent component
        onProfileUpdate?.(updatedProfile);
        
        Alert.alert('Success! ??', 'Your profile picture has been updated successfully!');
      } else {
        throw new Error(uploadResult.error || 'Failed to upload image');
      }
    } catch (error) {
      console.error('? Upload error:', error);
      Alert.alert('Upload Failed', error.message || 'Failed to upload profile picture. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  // ?? GET PROFILE PICTURE OR INITIALS
  const getProfileImage = () => {
    if (profile?.profilePictureURL) {
      return { uri: profile.profilePictureURL };
    }
    return null;
  };

  const getInitials = () => {
    const firstName = profile?.firstName || '';
    const lastName = profile?.lastName || '';
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  // ?? GET STATUS BADGE
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

  const status = getStatusBadge();

  return (
    <View style={styles.headerCard}>
      {/* ?? PROFILE PICTURE WITH CIRCULAR PROGRESS */}
      <View style={styles.profileImageContainer}>
        {/* Circular Progress Ring */}
        <View style={styles.progressRing}>
          <CircularProgress percentage={profileCompleteness} size={120} />
        </View>
        
        {/* Profile Picture */}
        <TouchableOpacity 
          style={styles.profileImageTouchable}
          onPress={() => setShowImagePickerModal(true)}
          activeOpacity={0.8}
        >
          <View style={styles.profileImageWrapper}>
            {getProfileImage() ? (
              <Image source={getProfileImage()} style={styles.profileImage} />
            ) : (
              <View style={styles.profileImagePlaceholder}>
                <Text style={styles.initialsText}>{getInitials()}</Text>
              </View>
            )}
            
            {/* Upload indicator */}
            {uploading && (
              <View style={styles.uploadingOverlay}>
                <ActivityIndicator size="small" color={colors.white} />
              </View>
            )}
            
            {/* Camera icon */}
            <View style={styles.cameraIcon}>
              <Ionicons name="camera" size={16} color={colors.white} />
            </View>
          </View>
        </TouchableOpacity>
        
        {/* Profile Completeness Text */}
        <View style={styles.completenessContainer}>
          <Text style={styles.completenessText}>{profileCompleteness}%</Text>
          <Text style={styles.completenessLabel}>Complete</Text>
        </View>
      </View>

      {/* ?? USER INFO */}
      <View style={styles.userInfo}>
        <Text style={styles.userName}>
          {profile?.firstName} {profile?.lastName}
        </Text>
        
        {userType === 'JobSeeker' ? (
          <>
            <Text style={styles.userTitle}>
              {jobSeekerProfile?.currentJobTitle || 'Job Seeker'}
            </Text>
            {jobSeekerProfile?.currentCompany && (
              <Text style={styles.userCompany}>
                at {jobSeekerProfile.currentCompany}
              </Text>
            )}
            {jobSeekerProfile?.currentLocation && (
              <View style={styles.locationContainer}>
                <Ionicons name="location" size={14} color={colors.gray500} />
                <Text style={styles.locationText}>{jobSeekerProfile.currentLocation}</Text>
              </View>
            )}
          </>
        ) : (
          <>
            <Text style={styles.userTitle}>
              {employerProfile?.jobTitle || 'Recruiter'}
            </Text>
            {employerProfile?.organizationName && (
              <Text style={styles.userCompany}>
                at {employerProfile.organizationName}
              </Text>
            )}
            {employerProfile?.department && (
              <Text style={styles.userDepartment}>
                {employerProfile.department}
              </Text>
            )}
          </>
        )}

        {/* Status Badge */}
        <View style={[styles.statusBadge, { backgroundColor: status.color + '15' }]}>
          <Ionicons name={status.icon} size={14} color={status.color} />
          <Text style={[styles.statusText, { color: status.color }]}>
            {status.text}
          </Text>
        </View>
      </View>

      {/* ?? QUICK STATS */}
      {userType === 'JobSeeker' && (
        <View style={styles.quickStats}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {jobSeekerProfile?.yearsOfExperience || 0}
            </Text>
            <Text style={styles.statLabel}>Years Exp</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {jobSeekerProfile?.primarySkills?.length || 0}
            </Text>
            <Text style={styles.statLabel}>Skills</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {profileCompleteness}%
            </Text>
            <Text style={styles.statLabel}>Profile</Text>
          </View>
        </View>
      )}

      {/* ?? IMAGE PICKER MODAL */}
      <Modal
        visible={showImagePickerModal}
        transparent={true}
        animationType="fade"
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

const styles = StyleSheet.create({
  headerCard: {
    backgroundColor: '#FFFFFF',
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
    alignItems: 'center',
  },
  
  // ?? Profile Image with Circular Progress
  profileImageContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  progressRing: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  progressSegment: {
    position: 'absolute',
    width: 4,
    height: 8,
    borderRadius: 2,
    transformOrigin: 'center bottom',
  },
  profileImageTouchable: {
    position: 'relative',
  },
  profileImageWrapper: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  profileImage: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
  },
  profileImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#3B82F6' + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#3B82F6',
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
    borderRadius: 50,
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#3B82F6',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  completenessContainer: {
    position: 'absolute',
    bottom: -30,
    alignItems: 'center',
  },
  completenessText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  completenessLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  
  // ?? User Info
  userInfo: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  userTitle: {
    fontSize: 16,
    color: '#374151',
    marginBottom: 2,
  },
  userCompany: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  userDepartment: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  locationText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  
  // ?? Quick Stats
  quickStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3B82F6',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 16,
  },
  
  // ?? Image Picker Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  imagePickerModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 300,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 20,
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
  },
  pickerOptionText: {
    fontSize: 16,
    color: '#1F2937',
    marginLeft: 12,
    fontWeight: '500',
  },
  cancelOption: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  cancelOptionText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
});