/**
 * Social Share Submit Screen
 * Allows users to submit their social media posts for rewards
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../contexts/ThemeContext';
import refopenAPI from '../services/api';
import { showToast } from '../components/Toast';
import SubScreenHeader from '../components/SubScreenHeader';

// RefOpen Social Media Links
const REFOPEN_SOCIALS = {
  linkedin: 'https://www.linkedin.com/company/refopen',
  instagram: 'https://www.instagram.com/refopensolutions',
  twitter: 'https://x.com/refopensolution',
  website: 'https://refopen.com',
};

const PLATFORM_CONFIG = {
  LinkedIn: {
    color: '#0A66C2',
    icon: 'logo-linkedin',
    reward: 30,
    hashtags: '#RefOpen #JobReferrals #CareerGrowth',
    samplePost: `Just discovered RefOpen - a platform where you can get direct referrals from employees at top companies! 🚀 No more cold applying. If you're job hunting, check it out!

👉 ${REFOPEN_SOCIALS.website}
🔗 Follow: ${REFOPEN_SOCIALS.linkedin}

#RefOpen #JobReferrals #CareerGrowth`,
    requirements: [
      '✅ Follow @RefOpen on LinkedIn',
      '✅ Tag @RefOpen in your post',
      '✅ Include #RefOpen hashtag',
      '✅ Post must be public for 7 days',
    ],
  },
  Twitter: {
    displayName: 'X (Twitter)',
    color: '#000000',
    icon: 'logo-twitter',
    useXLogo: true,
    reward: 20,
    hashtags: '#RefOpen #JobReferrals',
    samplePost: `Found this gem 💎 Get actual employee referrals for your dream job! Way better than mass applying.

Check it out 👉 ${REFOPEN_SOCIALS.website}
Follow: ${REFOPEN_SOCIALS.linkedin}

#RefOpen #JobReferrals @refopensolution`,
    requirements: [
      '✅ Follow @refopensolution on X + @RefOpen on LinkedIn',
      '✅ Tag @refopensolution & include LinkedIn link',
      '✅ Include #RefOpen hashtag',
      '✅ Tweet must be public for 3 days',
    ],
  },
  Instagram: {
    color: '#E4405F',
    icon: 'logo-instagram',
    reward: 20,
    hashtags: '#RefOpen #JobReferrals #CareerTips',
    samplePost: `Finally found a legit way to get job referrals! 🎯

RefOpen connects you with employees who can refer you directly. No more endless applications!

👉 Link: ${REFOPEN_SOCIALS.website}
📱 Follow: @refopensolutions
🔗 LinkedIn: ${REFOPEN_SOCIALS.linkedin}

#RefOpen #JobReferrals #CareerTips #JobHunt`,
    requirements: [
      '✅ Follow @refopensolutions on Insta + @RefOpen on LinkedIn',
      '✅ Tag @refopensolutions & include LinkedIn link',
      '✅ Include #RefOpen hashtag',
      '✅ Post must be public for 7 days',
    ],
  },
  Facebook: {
    color: '#1877F2',
    icon: 'logo-facebook',
    reward: 15,
    hashtags: '#RefOpen #JobReferrals',
    samplePost: `Sharing this for anyone job hunting! 💼

Found RefOpen - a platform where employees from top companies can give you direct referrals. Much better than applying blindly!

👉 Website: ${REFOPEN_SOCIALS.website}
🔗 LinkedIn: ${REFOPEN_SOCIALS.linkedin}

#RefOpen #JobReferrals`,
    requirements: [
      '✅ Follow @RefOpen on LinkedIn',
      '✅ Include RefOpen LinkedIn link in post',
      '✅ Include #RefOpen hashtag',
      '✅ Post must be public for 7 days',
    ],
  },
};

export default function SocialShareSubmitScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const platform = route.params?.platform || 'LinkedIn';
  const config = PLATFORM_CONFIG[platform] || PLATFORM_CONFIG.LinkedIn;

  const [postUrl, setPostUrl] = useState('');
  const [screenshotUri, setScreenshotUri] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [existingClaim, setExistingClaim] = useState(null);
  const [rejectedClaim, setRejectedClaim] = useState(null);
  const [canSubmit, setCanSubmit] = useState(true);
  const [checkingEligibility, setCheckingEligibility] = useState(true);

  useEffect(() => {
    navigation.setOptions({
      headerShown: false, // Using custom header with close button
    });
    checkEligibility();
  }, [platform]);

  const checkEligibility = async () => {
    try {
      setCheckingEligibility(true);
      const response = await refopenAPI.apiCall(`/social-share/can-claim/${platform}`);
      if (response.success) {
        setCanSubmit(response.data.canSubmit);
        setExistingClaim(response.data.existingClaim);
        setRejectedClaim(response.data.rejectedClaim);
      }
    } catch (error) {
      console.error('Error checking eligibility:', error);
    } finally {
      setCheckingEligibility(false);
    }
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant permission to access photos');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
        base64: true, // Get base64 data for easier upload
      });

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        // On web, construct data URL from base64
        if (Platform.OS === 'web' && asset.base64) {
          const mimeType = asset.mimeType || 'image/jpeg';
          setScreenshotUri(`data:${mimeType};base64,${asset.base64}`);
        } else {
          setScreenshotUri(asset.uri);
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const uploadScreenshot = async () => {
    if (!screenshotUri) return null;

    try {
      setUploading(true);
      
      // Use uploadFile with fileUri and containerName
      const response = await refopenAPI.uploadFile(screenshotUri, 'social-shares');
      
      if (response.success && response.data?.fileUrl) {
        return response.data.fileUrl;
      }
      console.error('Upload response:', response);
      throw new Error(response.error || 'Upload failed - no fileUrl returned');
    } catch (error) {
      console.error('Screenshot upload error:', error);
      throw error;
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    // Both Post URL and Screenshot are mandatory
    if (!postUrl || !postUrl.trim()) {
      showToast('Please provide the post URL', 'error');
      return;
    }
    if (!screenshotUri) {
      showToast('Please upload a screenshot of your post', 'error');
      return;
    }

    try {
      setSubmitting(true);

      // Upload screenshot first
      let screenshotUrl = null;
      if (screenshotUri) {
        try {
          screenshotUrl = await uploadScreenshot();
          console.log('Screenshot uploaded:', screenshotUrl);
        } catch (uploadError) {
          console.error('Screenshot upload failed:', uploadError);
          showToast('Failed to upload screenshot', 'error');
          setSubmitting(false);
          return;
        }
      }

      // Verify we have screenshot URL
      if (!screenshotUrl) {
        showToast('Screenshot upload failed - please try again', 'error');
        setSubmitting(false);
        return;
      }

      const response = await refopenAPI.apiCall('/social-share/submit', {
        method: 'POST',
        body: JSON.stringify({
          platform,
          postUrl: postUrl.trim(),
          screenshotUrl,
        }),
      });

      if (response.success) {
        showToast('Submitted! We\'ll review and credit your wallet soon.', 'success');
        setTimeout(() => {
          if (navigation.canGoBack()) {
            navigation.goBack();
          } else {
            navigation.navigate('MainTabs', { screen: 'Profile' });
          }
        }, 2000);
      } else {
        showToast(response.error || 'Failed to submit', 'error');
      }
    } catch (error) {
      console.error('Submit error:', error);
      showToast('Failed to submit claim', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const copyToClipboard = async (text) => {
    try {
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(text);
      } else {
        const Clipboard = require('expo-clipboard');
        await Clipboard.setStringAsync(text);
      }
      showToast('Copied to clipboard!', 'success');
    } catch (e) {
      showToast('Failed to copy', 'error');
    }
  };

  if (checkingEligibility) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Handle close button - navigate back or to home if no history
  const handleClose = () => {
    navigation.navigate('ShareEarn');
  };

  return (
    <View style={styles.container}>
      <SubScreenHeader
        title={`Share on ${config.displayName || platform}`}
        icon="close"
        onBack={handleClose}
      />

      <ScrollView style={styles.scrollView} contentContainerStyle={{ padding: 16 }}>
        {/* Header Card */}
        <View style={[styles.headerCard, { borderColor: config.color }]}>
          <View style={[styles.platformIcon, { backgroundColor: config.color + '20' }]}>
            {config.useXLogo ? (
              <Text style={{ fontSize: 28, fontWeight: '900', color: config.color }}>𝕏</Text>
            ) : (
              <Ionicons name={config.icon} size={32} color={config.color} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.platformTitle}>{config.displayName || platform}</Text>
            <Text style={styles.platformSubtitle}>Earn ₹{config.reward} by sharing</Text>
          </View>
          <View style={styles.rewardBadge}>
            <Text style={styles.rewardAmount}>₹{config.reward}</Text>
          </View>
        </View>

        {/* Already Claimed/Pending */}
        {!canSubmit && existingClaim && (
          <View style={[styles.statusCard, { 
            backgroundColor: existingClaim.Status === 'Pending' ? '#FF950020' : '#10B98120',
            borderColor: existingClaim.Status === 'Pending' ? '#FF9500' : '#10B981',
          }]}>
            <Ionicons 
              name={existingClaim.Status === 'Pending' ? 'time' : 'checkmark-circle'} 
              size={24} 
              color={existingClaim.Status === 'Pending' ? '#FF9500' : '#10B981'} 
            />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.statusTitle, { 
                color: existingClaim.Status === 'Pending' ? '#FF9500' : '#10B981' 
              }]}>
                {existingClaim.Status === 'Pending' ? 'Claim Pending Review' : 'Already Claimed!'}
              </Text>
              <Text style={styles.statusDesc}>
                {existingClaim.Status === 'Pending' 
                  ? 'Your claim is being reviewed. We\'ll notify you soon!'
                  : `You've already received ₹${existingClaim.RewardAmount} for this platform.`
                }
              </Text>
            </View>
          </View>
        )}

        {/* Previous Claim Rejected - Can Resubmit */}
        {canSubmit && rejectedClaim && (
          <View style={[styles.statusCard, { 
            backgroundColor: '#EF444420',
            borderColor: '#EF4444',
          }]}>
            <Ionicons name="close-circle" size={24} color="#EF4444" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.statusTitle, { color: '#EF4444' }]}>
                Previous Claim Rejected
              </Text>
              <Text style={styles.statusDesc}>
                Reason: {rejectedClaim.RejectionReason || 'No reason provided'}
              </Text>
              <Text style={[styles.statusDesc, { marginTop: 4, color: colors.text }]}>
                You can submit a new claim. Please follow all requirements.
              </Text>
            </View>
          </View>
        )}

        {canSubmit && (
          <>
            {/* Simple Steps */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, paddingHorizontal: 4 }}>
              {[
                { icon: 'copy-outline', label: 'Copy' },
                { icon: 'arrow-forward', label: '' },
                { icon: 'share-outline', label: 'Paste & Post' },
                { icon: 'arrow-forward', label: '' },
                { icon: 'image-outline', label: 'Submit Proof' },
                { icon: 'arrow-forward', label: '' },
                { icon: 'cash-outline', label: `Earn ₹${config.reward}` },
              ].map((step, i) => (
                step.icon === 'arrow-forward' ? (
                  <Ionicons key={i} name="chevron-forward" size={16} color={colors.textSecondary} style={{ alignSelf: 'center' }} />
                ) : (
                  <View key={i} style={{ alignItems: 'center', gap: 4 }}>
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: config.color + '20', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name={step.icon} size={18} color={config.color} />
                    </View>
                    <Text style={{ fontSize: 10, color: colors.textSecondary, fontWeight: '500' }}>{step.label}</Text>
                  </View>
                )
              ))}
            </View>

            {/* Post to copy — no "Sample" label, user copies as-is */}
            <View style={styles.samplePostBox}>
              <Text style={styles.samplePostText}>{config.samplePost}</Text>
            </View>
            <TouchableOpacity 
              style={[styles.submitButton, { backgroundColor: config.color, marginTop: 10, marginBottom: 20 }]}
              onPress={() => copyToClipboard(config.samplePost)}
            >
              <Ionicons name="copy-outline" size={18} color="#FFF" />
              <Text style={styles.submitButtonText}>Copy & Post on {config.displayName || platform}</Text>
            </TouchableOpacity>

            {/* Disclaimer */}
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FF950010', borderRadius: 10, padding: 12, marginBottom: 16, gap: 8 }}>
              <Ionicons name="warning-outline" size={16} color="#FF9500" />
              <Text style={{ flex: 1, fontSize: 12, color: colors.textSecondary, lineHeight: 18 }}>
                You must follow <Text style={{ fontWeight: '700', color: colors.text }} onPress={() => Linking.openURL(REFOPEN_SOCIALS.linkedin)}>RefOpen on LinkedIn</Text> to be eligible for credits on any platform.
              </Text>
            </View>

            {/* Post URL Input */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Post URL <Text style={{ color: '#EF4444' }}>*</Text></Text>
              <TextInput
                style={styles.input}
                placeholder={`Paste your ${platform} post URL here`}
                placeholderTextColor={colors.textSecondary}
                value={postUrl}
                onChangeText={setPostUrl}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Screenshot Upload */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Screenshot <Text style={{ color: '#EF4444' }}>*</Text></Text>
              <TouchableOpacity style={styles.uploadBox} onPress={pickImage}>
                {screenshotUri ? (
                  <View style={{ alignItems: 'center' }}>
                    <Image source={{ uri: screenshotUri }} style={styles.previewImage} />
                    <Text style={styles.changeText}>Tap to change</Text>
                  </View>
                ) : (
                  <>
                    <Ionicons name="cloud-upload-outline" size={36} color={colors.textSecondary} />
                    <Text style={styles.uploadText}>Upload screenshot of your post</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Submit Button */}
            <TouchableOpacity 
              style={[styles.submitButton, { backgroundColor: config.color }]}
              onPress={handleSubmit}
              disabled={submitting || uploading}
            >
              {(submitting || uploading) ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Ionicons name="paper-plane" size={20} color="#FFF" />
                  <Text style={styles.submitButtonText}>Submit for ₹{config.reward}</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors, isDark) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  scrollView: {
    flex: 1,
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    marginBottom: 16,
  },
  platformIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  platformTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  platformSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  rewardBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  rewardAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFF',
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  statusDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 10,
  },
  requirementText: {
    fontSize: 14,
    color: colors.text,
    flex: 1,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: colors.primary + '15',
    borderRadius: 8,
  },
  copyButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.primary,
  },
  samplePostBox: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  samplePostText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 22,
  },
  hashtagsText: {
    fontSize: 13,
    color: colors.primary,
    marginTop: 8,
    fontWeight: '500',
  },
  quickCopyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
  },
  quickCopyText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  orText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  uploadBox: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  uploadText: {
    fontSize: 15,
    color: colors.text,
    marginTop: 12,
    fontWeight: '500',
  },
  uploadSubtext: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  previewImage: {
    width: 200,
    height: 150,
    borderRadius: 8,
    resizeMode: 'cover',
  },
  changeText: {
    fontSize: 13,
    color: colors.primary,
    marginTop: 8,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    padding: 14,
    borderRadius: 10,
    gap: 10,
    marginBottom: 30,
  },
  noteText: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});
