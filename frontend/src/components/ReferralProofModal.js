import React, { useState, useCallback, useMemo } from 'react';
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
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import refopenAPI from '../services/api';
import { showToast } from './Toast';
import { typography } from '../styles/theme';
import { useTheme } from '../contexts/ThemeContext';

export default function ReferralProofModal({ 
  visible, 
  onClose, 
  onSubmit, 
  referralRequest,
  jobTitle = 'this job'
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [uploading, setUploading] = useState(false);
  const [proofImage, setProofImage] = useState(null);
  const [description, setDescription] = useState('');

  const handleImagePicker = useCallback(async () => {
    try {
      
      // For now, let's go directly to gallery to test
      
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

  const openCamera = useCallback(async () => {
    try {
      
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Camera permissions are required to take a photo.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
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
      console.error('Camera error:', error);
      Alert.alert('Error', 'Failed to open camera: ' + error.message);
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

      

      // Call the submit handler
      
      await onSubmit(proofData);
      
      
      // Reset form
      setProofImage(null);
      setDescription('');
      showToast('Referral proof submitted successfully', 'success');
      
    } catch (error) {
      console.error('Submit proof error:', error);
      Alert.alert('Error', error.message || 'Failed to submit proof');
    } finally {
      
      setUploading(false);
    }
  }, [proofImage, description, onSubmit]);

  const handleClose = useCallback(() => {
    if (uploading) return;
    setProofImage(null);
    setDescription('');
    onClose();
  }, [uploading, onClose]);

  const getFileType = (uri) => {
    const extension = uri.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'png':
        return 'image/png';
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'gif':
        return 'image/gif';
      case 'webp':
        return 'image/webp';
      default:
        return 'image/jpeg';
    }
  };

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
          <Text style={styles.title}>Submit Referral Proof</Text>
          <TouchableOpacity onPress={handleClose} disabled={uploading}>
            <Ionicons name="close" size={24} color={colors.gray600} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Job Info */}
          <View style={styles.jobInfo}>
            <Text style={styles.jobTitle}>{jobTitle}</Text>
            <Text style={styles.jobSubtitle}>
              {referralRequest?.CompanyName || 'Company Name'}
            </Text>
            <Text style={styles.helperText}>
              Please provide proof that you successfully referred the candidate for this position
            </Text>
          </View>

          {/* Proof Upload Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Screenshot Proof *</Text>
            <Text style={styles.sectionDescription}>
              Upload a screenshot showing you referred this candidate (e.g., email confirmation, internal portal, etc.)
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
                <Ionicons name="camera-outline" size={32} color={colors.gray600} />
                <Text style={styles.uploadButtonText}>Upload Screenshot</Text>
                <Text style={styles.uploadButtonSubtext}>Take photo or select from gallery</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Description Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description *</Text>
            <Text style={styles.sectionDescription}>
              Briefly describe how you referred this candidate
            </Text>
            <TextInput
              style={styles.textInput}
              value={description}
              onChangeText={setDescription}
              placeholder="E.g., Sent candidate's profile via company email to hiring manager John Smith..."
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
            <View style={styles.requirement}>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
              <Text style={styles.requirementText}>Both fields are mandatory</Text>
            </View>
          </View>
        </ScrollView>

        {/* Submit Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.submitButton,
              (!proofImage || description.trim().length < 10 || uploading) && styles.submitButtonDisabled
            ]}
            onPress={handleSubmit}
            disabled={!proofImage || description.trim().length < 10 || uploading}
          >
            {uploading && <ActivityIndicator size="small" color={colors.white} style={{ marginRight: 8 }} />}
            <Text style={styles.submitButtonText}>
              {uploading ? 'Submitting...' : 'Submit Proof'}
            </Text>
          </TouchableOpacity>
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
  jobInfo: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  jobTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 4,
  },
  jobSubtitle: {
    fontSize: typography.sizes.base,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  helperText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
  },
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
  footer: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
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