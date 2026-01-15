import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  Image,
  Platform,
} from 'react-native';
import useResponsive from '../../hooks/useResponsive';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import messagingApi from '../../services/messagingApi';
import ConfirmationModal from '../../components/common/ConfirmationModal';
import UserProfileHeader from '../../components/profile/UserProfileHeader';
import { showToast } from '../../components/Toast';

export default function ViewProfileScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const responsive = useResponsive();
  const styles = useMemo(() => createStyles(colors, isDark, responsive), [colors, isDark, responsive]);

  const { userId, userName: initialUserName, userProfilePic: initialProfilePic } = route.params;

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [error, setError] = useState(null);
  const [showMenuPopup, setShowMenuPopup] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [blockAction, setBlockAction] = useState(null);

  useEffect(() => {
    loadProfile();
    checkIfBlocked();
  }, [userId]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await messagingApi.getPublicProfile(userId);

      if (result.success) {
        setProfile(result.data);
      } else {
        if (result.error?.includes('private')) {
          setError('private');
        } else if (result.error?.includes('not found')) {
          setError('not_found');
        } else {
          setError('general');
        }
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      const errorMsg = error.message || error.toString();
      if (errorMsg.includes('private') || errorMsg.includes('403')) {
        setError('private');
      } else if (errorMsg.includes('404') || errorMsg.includes('not found')) {
        setError('not_found');
      } else {
        setError('general');
      }
    } finally {
      setLoading(false);
    }
  };

  const checkIfBlocked = async () => {
    try {
      const result = await messagingApi.checkIfBlocked(userId);
      if (result.success) {
        setIsBlocked(result.data.isBlocked || false);
      }
    } catch (error) {
      console.error('Error checking block status:', error);
    }
  };

  const handleSendMessage = async () => {
    // Check if user allows recruiter contact (only relevant for employer viewing job seeker)
    if (profile?.AllowRecruitersToContact === false && user?.UserType === 'Employer') {
      showToast('This user has chosen not to receive messages from recruiters.', 'info');
      return;
    }

    if (isBlocked) {
      showToast('You have blocked this user', 'error');
      return;
    }

    try {
      setSendingMessage(true);
      const result = await messagingApi.createConversation(userId);

      if (result.success) {
        navigation.navigate('Chat', {
          conversationId: result.data.ConversationID,
          otherUserName: profile.UserName || initialUserName,
          otherUserId: userId,
          otherUserProfilePic: profile.ProfilePictureURL,
        });
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
      showToast('Failed to start conversation', 'error');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleBlockUser = () => {
    setBlockAction(isBlocked ? 'unblock' : 'block');
    setShowMenuPopup(false);
    setShowBlockConfirm(true);
  };

  const confirmBlockUser = async () => {
    setShowBlockConfirm(false);
    try {
      if (blockAction === 'unblock') {
        await messagingApi.unblockUser(userId);
        setIsBlocked(false);
      } else {
        await messagingApi.blockUser(userId, 'Blocked from profile view');
        setIsBlocked(true);
      }
    } catch (error) {
      console.error('Failed to update block status:', error);
    }
  };

  const openLink = (url) => {
    if (url) {
      Linking.openURL(url).catch(() => {
        showToast('Failed to open link', 'error');
      });
    }
  };

  // Loading state
  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={styles.headerButton} />
        </View>

        <View style={styles.loadingContainer}>
          <View style={styles.skeletonAvatar} />
          <View style={styles.skeletonName} />
          <View style={styles.skeletonHeadline} />
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 24 }} />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </View>
    );
  }

  // Private profile error
  if (error === 'private') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={styles.headerButton} />
        </View>

        <View style={styles.errorContainer}>
          <View style={[styles.errorIconWrapper, { backgroundColor: colors.primary + '15' }]}>
            <Ionicons name="lock-closed" size={64} color={colors.primary} />
          </View>
          <Text style={styles.errorTitle}>Private Profile</Text>
          <Text style={styles.errorMessage}>
            This user has set their profile to private. Only connections can view their details.
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color={colors.white} />
            <Text style={styles.primaryBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Not found error
  if (error === 'not_found') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={styles.headerButton} />
        </View>

        <View style={styles.errorContainer}>
          <View style={[styles.errorIconWrapper, { backgroundColor: colors.gray200 }]}>
            <Ionicons name="person-outline" size={64} color={colors.gray500} />
          </View>
          <Text style={styles.errorTitle}>Profile Not Found</Text>
          <Text style={styles.errorMessage}>
            This user doesn't exist or has deactivated their account.
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color={colors.white} />
            <Text style={styles.primaryBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // General error
  if (error === 'general') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={styles.headerButton} />
        </View>

        <View style={styles.errorContainer}>
          <View style={[styles.errorIconWrapper, { backgroundColor: colors.error + '15' }]}>
            <Ionicons name="alert-circle" size={64} color={colors.error} />
          </View>
          <Text style={styles.errorTitle}>Something Went Wrong</Text>
          <Text style={styles.errorMessage}>
            We couldn't load this profile. Please check your connection and try again.
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={loadProfile}>
            <Ionicons name="refresh" size={20} color={colors.white} />
            <Text style={styles.primaryBtnText}>Try Again</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.secondaryBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={styles.headerButton} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>No Profile Data</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.primaryBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Check if messaging is allowed
  const canMessage = profile.AllowRecruitersToContact !== false || user?.UserType !== 'Employer';

  return (
    <View style={styles.container}>
      <View style={styles.innerContainer}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity onPress={() => setShowMenuPopup(true)} style={styles.headerButton}>
          <Ionicons name="ellipsis-vertical" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Compact Profile Header - Same as ProfileScreenNew */}
        <UserProfileHeader
          user={{
            UserID: userId,
            FirstName: profile.UserName?.split(' ')[0] || '',
            LastName: profile.UserName?.split(' ').slice(1).join(' ') || '',
            ProfilePictureURL: profile.ProfilePictureURL,
          }}
          profile={{
            firstName: profile.UserName?.split(' ')[0] || '',
            lastName: profile.UserName?.split(' ').slice(1).join(' ') || '',
            profilePictureURL: profile.ProfilePictureURL,
          }}
          jobSeekerProfile={{
            headline: profile.Headline,
            currentJobTitle: profile.CurrentJobTitle,
            currentCompany: profile.CurrentCompanyName,
            currentLocation: profile.CurrentLocation,
            yearsOfExperience: profile.YearsOfExperience,
            highestEducation: profile.HighestEducation,
            fieldOfStudy: profile.FieldOfStudy,
            institution: profile.Institution,
            primarySkills: profile.PrimarySkills,
            isOpenToWork: profile.IsOpenToWork,
            openToRefer: profile.OpenToRefer,
          }}
          userType="JobSeeker"
          onProfileUpdate={null}
          showStats={false}
          showProgress={false}
          isVerifiedUser={profile?.IsVerifiedUser || profile?.IsVerifiedReferrer}
          loadingVerificationStatus={loading}
        />

        {/* Action Buttons Row */}
        <View style={styles.actionRow}>
          {/* Message Button */}
          <TouchableOpacity
            style={[
              styles.messageBtn,
              (!canMessage || isBlocked) && styles.messageBtnDisabled
            ]}
            onPress={handleSendMessage}
            disabled={sendingMessage || !canMessage || isBlocked}
          >
            {sendingMessage ? (
              <ActivityIndicator size="small" color={colors.text} />
            ) : (
              <>
                <Ionicons
                  name={!canMessage ? "close-circle" : "chatbubble-ellipses"}
                  size={18}
                  color={colors.text}
                />
                <Text style={styles.messageBtnText}>
                  {!canMessage ? 'Not Available' : isBlocked ? 'Blocked' : 'Message'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Contact Restriction Notice */}
          {!canMessage && (
            <View style={styles.restrictionNotice}>
              <Ionicons name="information-circle" size={14} color={colors.warning} />
              <Text style={styles.restrictionText}>
                Recruiter messages disabled
              </Text>
            </View>
          )}
        </View>

        {/* About Section */}
        {profile.Summary && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="person-circle-outline" size={22} color={colors.primary} />
              <Text style={styles.sectionTitle}>About</Text>
            </View>
            <Text style={styles.sectionContent}>{profile.Summary}</Text>
          </View>
        )}

        {/* Work Experience Section */}
        {profile.workExperiences && profile.workExperiences.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="briefcase-outline" size={22} color={colors.primary} />
              <Text style={styles.sectionTitle}>Work Experience</Text>
            </View>
            <View style={styles.workExperienceList}>
              {profile.workExperiences.map((exp, index) => (
                <View key={exp.WorkExperienceID || index} style={styles.workExpCard}>
                  <View style={styles.workExpIcon}>
                    {exp.OrganizationLogo ? (
                      <Image 
                        source={{ uri: exp.OrganizationLogo }} 
                        style={{ width: 36, height: 36, borderRadius: 6 }}
                        resizeMode="contain"
                      />
                    ) : (
                      <Ionicons name="business" size={20} color={colors.primary} />
                    )}
                  </View>
                  <View style={styles.workExpDetails}>
                    <View style={styles.workExpHeader}>
                      <Text style={styles.workExpTitle}>{exp.JobTitle}</Text>
                      {exp.IsCurrent && (
                        <View style={styles.currentBadge}>
                          <Text style={styles.currentBadgeText}>Current</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.workExpCompany}>{exp.CompanyName}</Text>
                    <View style={styles.workExpMeta}>
                      {exp.Location && (
                        <View style={styles.workExpMetaItem}>
                          <Ionicons name="location-outline" size={12} color={colors.gray500} />
                          <Text style={styles.workExpMetaText}>{exp.Location}</Text>
                        </View>
                      )}
                      <View style={styles.workExpMetaItem}>
                        <Ionicons name="calendar-outline" size={12} color={colors.gray500} />
                        <Text style={styles.workExpMetaText}>
                          {new Date(exp.StartDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} - 
                          {exp.IsCurrent ? 'Present' : new Date(exp.EndDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Education Section */}
        {profile.HighestEducation && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="school-outline" size={22} color={colors.primary} />
              <Text style={styles.sectionTitle}>Education</Text>
            </View>
            <View style={styles.educationCard}>
              <View style={styles.educationIcon}>
                <Ionicons name="ribbon-outline" size={24} color={colors.primary} />
              </View>
              <View style={styles.educationDetails}>
                <Text style={styles.educationDegree}>{profile.HighestEducation}</Text>
                {profile.FieldOfStudy && (
                  <Text style={styles.educationField}>{profile.FieldOfStudy}</Text>
                )}
                {profile.Institution && (
                  <Text style={styles.educationInstitution}>{profile.Institution}</Text>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Skills Section */}
        {profile.PrimarySkills && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="code-slash-outline" size={22} color={colors.primary} />
              <Text style={styles.sectionTitle}>Skills</Text>
            </View>
            <View style={styles.skillsGrid}>
              {(() => {
                let skills = [];
                try {
                  // Try parsing as JSON array first
                  if (typeof profile.PrimarySkills === 'string') {
                    if (profile.PrimarySkills.startsWith('[')) {
                      skills = JSON.parse(profile.PrimarySkills);
                    } else {
                      skills = profile.PrimarySkills.split(',').map(s => s.trim());
                    }
                  } else if (Array.isArray(profile.PrimarySkills)) {
                    skills = profile.PrimarySkills;
                  }
                } catch (e) {
                  skills = profile.PrimarySkills.split(',').map(s => s.trim());
                }
                return skills.map((skill, index) => (
                  <View key={index} style={styles.skillChip}>
                    <Text style={styles.skillChipText}>{skill}</Text>
                  </View>
                ));
              })()}
            </View>
          </View>
        )}

        {/* Links Section */}
        {(profile.LinkedInProfile || profile.GithubProfile || profile.PortfolioURL) && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="link-outline" size={22} color={colors.primary} />
              <Text style={styles.sectionTitle}>Links</Text>
            </View>
            <View style={styles.linksContainer}>
              {profile.LinkedInProfile && (
                <TouchableOpacity
                  style={styles.linkCard}
                  onPress={() => openLink(profile.LinkedInProfile)}
                >
                  <View style={[styles.linkIconWrapper, { backgroundColor: '#0077B5' + '15' }]}>
                    <Ionicons name="logo-linkedin" size={22} color="#0077B5" />
                  </View>
                  <View style={styles.linkContent}>
                    <Text style={styles.linkTitle}>LinkedIn</Text>
                    <Text style={styles.linkSubtitle}>View profile</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.gray400} />
                </TouchableOpacity>
              )}
              {profile.GithubProfile && (
                <TouchableOpacity
                  style={styles.linkCard}
                  onPress={() => openLink(profile.GithubProfile)}
                >
                  <View style={[styles.linkIconWrapper, { backgroundColor: colors.text + '10' }]}>
                    <Ionicons name="logo-github" size={22} color={colors.text} />
                  </View>
                  <View style={styles.linkContent}>
                    <Text style={styles.linkTitle}>GitHub</Text>
                    <Text style={styles.linkSubtitle}>View repositories</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.gray400} />
                </TouchableOpacity>
              )}
              {profile.PortfolioURL && (
                <TouchableOpacity
                  style={styles.linkCard}
                  onPress={() => openLink(profile.PortfolioURL)}
                >
                  <View style={[styles.linkIconWrapper, { backgroundColor: colors.primary + '15' }]}>
                    <Ionicons name="globe-outline" size={22} color={colors.primary} />
                  </View>
                  <View style={styles.linkContent}>
                    <Text style={styles.linkTitle}>Portfolio</Text>
                    <Text style={styles.linkSubtitle}>View website</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.gray400} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Privacy Notice */}
        <View style={styles.privacyNotice}>
          <Ionicons name="shield-checkmark-outline" size={16} color={colors.gray500} />
          <Text style={styles.privacyNoticeText}>
            Some information may be hidden based on user privacy settings
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Menu Popup */}
      <Modal
        visible={showMenuPopup}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowMenuPopup(false)}
      >
        <Pressable style={styles.menuOverlay} onPress={() => setShowMenuPopup(false)}>
          <Pressable style={styles.menuPopup} onPress={(e) => e.stopPropagation()}>
            <View style={styles.menuHandle} />

            <TouchableOpacity style={styles.menuOption} onPress={handleBlockUser}>
              <Ionicons
                name={isBlocked ? "checkmark-circle-outline" : "close-circle-outline"}
                size={22}
                color={isBlocked ? colors.success : colors.error}
              />
              <Text style={[styles.menuOptionText, { color: isBlocked ? colors.success : colors.error }]}>
                {isBlocked ? 'Unblock User' : 'Block User'}
              </Text>
            </TouchableOpacity>

            {canMessage && !isBlocked && (
              <TouchableOpacity
                style={styles.menuOption}
                onPress={() => {
                  setShowMenuPopup(false);
                  handleSendMessage();
                }}
              >
                <Ionicons name="chatbubble-outline" size={22} color={colors.text} />
                <Text style={styles.menuOptionText}>Send Message</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.menuOption}
              onPress={() => {
                setShowMenuPopup(false);
                showToast('Thank you for reporting. We will review this profile.', 'success');
              }}
            >
              <Ionicons name="flag-outline" size={22} color={colors.warning} />
              <Text style={[styles.menuOptionText, { color: colors.warning }]}>Report Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.menuOption, styles.menuOptionCancel]}
              onPress={() => setShowMenuPopup(false)}
            >
              <Text style={styles.menuCancelText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
      </View>

      {/* Block Confirmation Modal */}
      <ConfirmationModal
        visible={showBlockConfirm}
        title={blockAction === 'unblock' ? 'Unblock User' : 'Block User'}
        message={
          blockAction === 'unblock'
            ? 'Are you sure you want to unblock this user?'
            : "Are you sure you want to block this user? You won't receive messages from them."
        }
        confirmText={blockAction === 'unblock' ? 'Unblock' : 'Block'}
        cancelText="Cancel"
        confirmStyle={blockAction === 'unblock' ? 'primary' : 'danger'}
        icon={blockAction === 'unblock' ? 'checkmark-circle' : 'remove-circle'}
        onConfirm={confirmBlockUser}
        onCancel={() => setShowBlockConfirm(false)}
      />
    </View>
  );
}

const createStyles = (colors, isDark, responsive = {}) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    ...(Platform.OS === 'web' && responsive.isDesktop ? {
      alignItems: 'center',
    } : {}),
  },
  innerContainer: {
    width: '100%',
    maxWidth: Platform.OS === 'web' && responsive.isDesktop ? 800 : '100%',
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.surface,
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
    textAlign: 'center',
  },

  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 60,
    backgroundColor: colors.surface || colors.white,
  },
  skeletonAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.gray200,
    marginBottom: 16,
  },
  skeletonName: {
    width: 150,
    height: 24,
    borderRadius: 4,
    backgroundColor: colors.gray200,
    marginBottom: 8,
  },
  skeletonHeadline: {
    width: 200,
    height: 16,
    borderRadius: 4,
    backgroundColor: colors.gray200,
  },
  loadingText: {
    fontSize: 14,
    color: colors.gray500,
    marginTop: 12,
  },

  // Error
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    backgroundColor: colors.surface || colors.white,
  },
  errorIconWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 15,
    color: colors.gray600,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    minWidth: 160,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
  },
  secondaryBtn: {
    marginTop: 12,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  secondaryBtnText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.gray600,
  },

  // Scroll
  scrollView: {
    flex: 1,
  },

  // Action Row (below UserProfileHeader)
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface || colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border || colors.gray200,
    gap: 12,
    flexWrap: 'wrap',
  },
  messageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  messageBtnDisabled: {
    backgroundColor: colors.gray400,
    shadowOpacity: 0,
    elevation: 0,
  },
  messageBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.white,
  },
  restrictionNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.warning + '15',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  restrictionText: {
    fontSize: 11,
    color: colors.warning,
    fontWeight: '500',
  },

  // Sections
  section: {
    backgroundColor: colors.surface || colors.white,
    marginTop: 12,
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  sectionContent: {
    fontSize: 15,
    color: colors.gray700 || colors.text,
    lineHeight: 24,
  },

  // Work Experience
  workExperienceList: {
    gap: 12,
  },
  workExpCard: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200 || colors.border,
  },
  workExpIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  workExpDetails: {
    flex: 1,
  },
  workExpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  workExpTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  currentBadge: {
    backgroundColor: colors.success + '20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  currentBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.success,
    textTransform: 'uppercase',
  },
  workExpCompany: {
    fontSize: 14,
    color: colors.gray600,
    marginBottom: 4,
  },
  workExpMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  workExpMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  workExpMetaText: {
    fontSize: 12,
    color: colors.gray500,
  },

  // Education
  educationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  educationIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  educationDetails: {
    flex: 1,
  },
  educationDegree: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  educationField: {
    fontSize: 14,
    color: colors.gray600,
    marginBottom: 2,
  },
  educationInstitution: {
    fontSize: 13,
    color: colors.gray500,
  },

  // Skills
  skillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  skillChip: {
    backgroundColor: colors.primary + '12',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  skillChipText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },

  // Links
  linksContainer: {
    gap: 12,
  },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: colors.background,
    borderRadius: 12,
    gap: 14,
  },
  linkIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkContent: {
    flex: 1,
  },
  linkTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  linkSubtitle: {
    fontSize: 13,
    color: colors.gray500,
    marginTop: 2,
  },

  // Privacy Notice
  privacyNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 8,
  },
  privacyNoticeText: {
    fontSize: 12,
    color: colors.gray500,
    flex: 1,
  },

  // Menu Popup
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  menuPopup: {
    backgroundColor: colors.surface || colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 34,
    paddingTop: 8,
  },
  menuHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.gray300,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 14,
  },
  menuOptionText: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
  },
  menuOptionCancel: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border || colors.gray200,
    justifyContent: 'center',
  },
  menuCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray600,
    textAlign: 'center',
  },
});
