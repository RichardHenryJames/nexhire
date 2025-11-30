import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import messagingApi from '../../services/messagingApi';
import UserProfileHeader from '../../components/profile/UserProfileHeader';
import ConfirmationModal from '../../components/common/ConfirmationModal';
import { colors } from '../../styles/theme';

export default function ViewProfileScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  
  const { userId, userName: initialUserName } = route.params;
  
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [error, setError] = useState(null);
  const [showMenuPopup, setShowMenuPopup] = useState(false); // Instagram-style popup
  const [showBlockConfirm, setShowBlockConfirm] = useState(false); // Block confirmation modal
  const [blockAction, setBlockAction] = useState(null); // 'block' or 'unblock'

  // Load public profile
  useEffect(() => {
 loadProfile();
    checkIfBlocked();
    // Record profile view
    messagingApi.recordProfileView(userId).catch(console.error);
  }, [userId]);

  const loadProfile = async () => {
    try {
      setLoading(true);
    setError(null); // Reset error
      const result = await messagingApi.getPublicProfile(userId);
      
      console.log('?? ViewProfile - API result:', result); // DEBUG
      console.log('?? ViewProfile - ProfilePictureURL:', result.data?.ProfilePictureURL); // DEBUG
  
      if (result.success) {
    setProfile(result.data);
 } else {
        // ?? Set specific error type
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
      
      // ?? Parse error message
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
 if (isBlocked) {
      Alert.alert('Cannot Message', 'You have blocked this user');
      return;
    }

    try {
      setSendingMessage(true);
      
 // Create or get existing conversation
      const result = await messagingApi.createConversation(userId);
      
      if (result.success) {
        // Navigate to chat screen
        navigation.navigate('Chat', {
        conversationId: result.data.ConversationID,
          otherUserName: profile.UserName || initialUserName,
        otherUserId: userId,
        otherUserProfilePic: profile.ProfilePictureURL,
        });
      }
    } catch (error) {
  console.error('Error creating conversation:', error);
      Alert.alert('Error', 'Failed to start conversation');
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
        Alert.alert('Error', 'Failed to open link');
      });
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
  );
  }

  // ?? NEW: Beautiful error screens
  if (error === 'private') {
 return (
      <View style={styles.container}>
   <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBackButton}>
    <Ionicons name="arrow-back" size={24} color={colors.white} />
  </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
   <View style={styles.headerMenuButton} />
      </View>
      
   <View style={styles.errorContainer}>
     <View style={styles.errorIconContainer}>
       <Ionicons name="lock-closed" size={80} color={colors.primary} />
   </View>
   <Text style={styles.errorTitle}>This Profile is Private</Text>
  <Text style={styles.errorMessage}>
    This user has set their profile to private. Only connections can view their full profile.
        </Text>
        
     <View style={styles.errorActions}>
     <TouchableOpacity 
       style={styles.primaryButton}
       onPress={() => navigation.goBack()}
    >
            <Ionicons name="arrow-back" size={20} color={colors.white} />
      <Text style={styles.primaryButtonText}>Go Back</Text>
     </TouchableOpacity>
   </View>
   
        <View style={styles.privacyTip}>
   <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
 <Text style={styles.privacyTipText}>
       Tip: You can still send them a message if you know their name.
          </Text>
   </View>
      </View>
    </View>
    );
  }

  if (error === 'not_found') {
 return (
      <View style={styles.container}>
        <View style={styles.header}>
   <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBackButton}>
   <Ionicons name="arrow-back" size={24} color={colors.white} />
          </TouchableOpacity>
   <Text style={styles.headerTitle}>Profile</Text>
          <View style={styles.headerMenuButton} />
   </View>
      
   <View style={styles.errorContainer}>
   <View style={styles.errorIconContainer}>
     <Ionicons name="person-outline" size={80} color={colors.gray400} />
        </View>
   <Text style={styles.errorTitle}>Profile Not Found</Text>
        <Text style={styles.errorMessage}>
    This user profile doesn't exist or has been deactivated.
        </Text>
        
   <View style={styles.errorActions}>
        <TouchableOpacity 
    style={styles.primaryButton}
   onPress={() => navigation.goBack()}
     >
     <Ionicons name="arrow-back" size={20} color={colors.white} />
   <Text style={styles.primaryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
    );
  }

  if (error === 'general') {
    return (
   <View style={styles.container}>
   <View style={styles.header}>
  <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBackButton}>
            <Ionicons name="arrow-back" size={24} color={colors.white} />
    </TouchableOpacity>
     <Text style={styles.headerTitle}>Profile</Text>
     <View style={styles.headerMenuButton} />
</View>
   
   <View style={styles.errorContainer}>
        <View style={styles.errorIconContainer}>
   <Ionicons name="alert-circle-outline" size={80} color={colors.error} />
        </View>
   <Text style={styles.errorTitle}>Something Went Wrong</Text>
   <Text style={styles.errorMessage}>
   We couldn't load this profile. Please check your connection and try again.
 </Text>
        
        <View style={styles.errorActions}>
       <TouchableOpacity 
style={styles.primaryButton}
 onPress={loadProfile}
   >
   <Ionicons name="refresh" size={20} color={colors.white} />
       <Text style={styles.primaryButtonText}>Try Again</Text>
   </TouchableOpacity>
        
       <TouchableOpacity 
    style={styles.secondaryButton}
     onPress={() => navigation.goBack()}
     >
        <Text style={styles.secondaryButtonText}>Go Back</Text>
   </TouchableOpacity>
 </View>
 </View>
    </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.errorContainer}>
   <Ionicons name="alert-circle-outline" size={64} color={colors.gray300} />
    <Text style={styles.errorText}>Profile not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
   <Text style={styles.backButtonText}>Go Back</Text>
    </TouchableOpacity>
   </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBackButton}>
          <Ionicons name="arrow-back" size={24} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity onPress={() => setShowMenuPopup(true)} style={styles.headerMenuButton}>
          <Ionicons name="ellipsis-vertical" size={24} color={colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Profile Header Component (NO EDIT, NO STATS) */}
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
            currentCompany: profile.CurrentCompanyName || profile.CurrentCompany,
            currentLocation: profile.CurrentLocation,
            yearsOfExperience: profile.YearsOfExperience,
            highestEducation: profile.HighestEducation,
            fieldOfStudy: profile.FieldOfStudy,
            institution: profile.Institution,
            primarySkills: profile.PrimarySkills,
            isOpenToWork: profile.IsOpenToWork,
            openToRefer: profile.OpenToRefer || false,
          }}
          userType="JobSeeker"
          onProfileUpdate={null} // Read-only - no updates allowed
          showStats={false} // Hide stats column for privacy
        />

   {/* About Section */}
      {profile.Summary && (
      <View style={styles.section}>
   <Text style={styles.sectionTitle}>About</Text>
    <Text style={styles.sectionText}>{profile.Summary}</Text>
      </View>
        )}

        {/* Experience Section */}
 {profile.YearsOfExperience > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
              <Ionicons name="briefcase" size={20} color={colors.primary} />
          <Text style={styles.sectionTitle}>Experience</Text>
       </View>
          <Text style={styles.sectionText}>
      {profile.YearsOfExperience} {profile.YearsOfExperience === 1 ? 'year' : 'years'} of experience
            </Text>
  {profile.CurrentJobTitle && (
              <View style={styles.experienceItem}>
      <Text style={styles.experienceTitle}>{profile.CurrentJobTitle}</Text>
 {(profile.CurrentCompanyName || profile.CurrentCompany) && (profile.CurrentCompanyName || profile.CurrentCompany) !== 'Private' && (
    <Text style={styles.experienceCompany}>{profile.CurrentCompanyName || profile.CurrentCompany}</Text>
  )}
          </View>
            )}
      </View>
      )}

     {/* Education Section */}
   {profile.HighestEducation && (
  <View style={styles.section}>
       <View style={styles.sectionHeader}>
     <Ionicons name="school" size={20} color={colors.primary} />
          <Text style={styles.sectionTitle}>Education</Text>
    </View>
 <Text style={styles.sectionText}>{profile.HighestEducation}</Text>
      {profile.FieldOfStudy && (
     <Text style={styles.sectionSubtext}>{profile.FieldOfStudy}</Text>
            )}
            {profile.Institution && (
          <Text style={styles.sectionSubtext}>{profile.Institution}</Text>
            )}
      </View>
        )}

        {/* Skills Section */}
        {profile.PrimarySkills && (
          <View style={styles.section}>
 <View style={styles.sectionHeader}>
      <Ionicons name="code-slash" size={20} color={colors.primary} />
       <Text style={styles.sectionTitle}>Skills</Text>
   </View>
            <View style={styles.skillsContainer}>
           {profile.PrimarySkills.split(',').map((skill, index) => (
         <View key={index} style={styles.skillBadge}>
         <Text style={styles.skillText}>{skill.trim()}</Text>
            </View>
  ))}
   </View>
      </View>
        )}

        {/* Links Section */}
        {(profile.LinkedInProfile || profile.GithubProfile) && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="link" size={20} color={colors.primary} />
              <Text style={styles.sectionTitle}>Links</Text>
            </View>
            {profile.LinkedInProfile && (
              <TouchableOpacity
                style={styles.linkItem}
                onPress={() => openLink(profile.LinkedInProfile)}
              >
                <Ionicons name="logo-linkedin" size={24} color="#0077B5" />
                <Text style={styles.linkText}>LinkedIn Profile</Text>
                <Ionicons name="open-outline" size={16} color={colors.gray400} />
              </TouchableOpacity>
            )}
            {profile.GithubProfile && (
              <TouchableOpacity
                style={styles.linkItem}
                onPress={() => openLink(profile.GithubProfile)}
              >
                <Ionicons name="logo-github" size={24} color="#333" />
                <Text style={styles.linkText}>GitHub Profile</Text>
                <Ionicons name="open-outline" size={16} color={colors.gray400} />
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>

      {/* Instagram-Style Menu Popup */}
      <Modal
        visible={showMenuPopup}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowMenuPopup(false)}
      >
        <Pressable 
          style={styles.menuOverlay}
          onPress={() => setShowMenuPopup(false)}
        >
          <Pressable style={styles.menuPopup} onPress={(e) => e.stopPropagation()}>
            {/* Block Option */}
            <TouchableOpacity
              style={styles.menuOption}
              onPress={handleBlockUser}
            >
              <Text style={[styles.menuOptionText, styles.menuOptionDanger]}>
                {isBlocked ? 'Unblock' : 'Block'}
              </Text>
            </TouchableOpacity>

            {/* Send Message Option */}
            <TouchableOpacity
              style={styles.menuOption}
              onPress={() => {
                setShowMenuPopup(false);
                handleSendMessage();
              }}
              disabled={isBlocked}
            >
              <Text style={[styles.menuOptionText, isBlocked && styles.menuOptionDisabled]}>
                Send message
              </Text>
            </TouchableOpacity>

            {/* Cancel Option */}
            <TouchableOpacity
              style={[styles.menuOption, styles.menuOptionCancel]}
              onPress={() => setShowMenuPopup(false)}
            >
              <Text style={styles.menuOptionTextBold}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Block/Unblock Confirmation Modal */}
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
        icon={blockAction === 'unblock' ? 'checkmark-circle-outline' : 'ban-outline'}
        onConfirm={confirmBlockUser}
        onCancel={() => setShowBlockConfirm(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background || '#F5F5F7',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  errorContainer: {
    flex: 1,
 justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
    paddingHorizontal: 40,
  },
  errorIconContainer: {
    width: 140,
 height: 140,
    borderRadius: 70,
    backgroundColor: colors.gray100,
 justifyContent: 'center',
 alignItems: 'center',
    marginBottom: 24,
  },
  errorTitle: {
  fontSize: 24,
    fontWeight: 'bold',
    color: colors.gray900,
    marginBottom: 12,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: colors.gray600,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  errorActions: {
    width: '100%',
 gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  secondaryButton: {
    alignItems: 'center',
 justifyContent: 'center',
    backgroundColor: colors.gray100,
paddingHorizontal: 32,
    paddingVertical: 16,
  borderRadius: 12,
  },
  secondaryButtonText: {
    color: colors.gray700,
    fontSize: 16,
    fontWeight: '600',
  },
  privacyTip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.primary + '10',
    padding: 16,
    borderRadius: 12,
    marginTop: 24,
borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  privacyTipText: {
    flex: 1,
    fontSize: 14,
    color: colors.gray700,
    marginLeft: 12,
    lineHeight: 20,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.gray600,
    marginTop: 16,
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.primary,
  },
  headerBackButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.white,
    flex: 1,
    textAlign: 'center',
  },
  headerMenuButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  messageButtonContainer: {
    paddingHorizontal: 20,
  paddingVertical: 16,
    backgroundColor: colors.white,
  },
  messageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  messageButtonDisabled: {
    backgroundColor: colors.gray400,
  },
  messageButtonText: {
    color: colors.white,
  fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  section: {
  backgroundColor: colors.white,
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginTop: 12,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
 marginBottom: 16,
  },
  profileImagePlaceholder: {
    width: 120,
    height: 120,
  borderRadius: 60,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileImageText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: colors.white,
  },
  userName: {
    fontSize: 24,
 fontWeight: 'bold',
    color: colors.gray900,
    marginBottom: 8,
  },
  headline: {
 fontSize: 16,
    color: colors.gray600,
    textAlign: 'center',
    marginBottom: 12,
},
  jobInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  jobText: {
    fontSize: 14,
    color: colors.gray600,
 marginLeft: 6,
  },
  openToWorkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
  borderRadius: 16,
    marginBottom: 20,
  },
  openToWorkText: {
    fontSize: 14,
    color: colors.success,
    fontWeight: '600',
    marginLeft: 6,
  },
  section: {
    backgroundColor: colors.white,
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginTop: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  color: colors.gray900,
    marginLeft: 8,
  },
  sectionText: {
    fontSize: 15,
    color: colors.gray700,
    lineHeight: 22,
  },
  sectionSubtext: {
    fontSize: 14,
  color: colors.gray600,
    marginTop: 4,
  },
  experienceItem: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
  },
  experienceTitle: {
    fontSize: 16,
    fontWeight: '600',
  color: colors.gray900,
    marginBottom: 4,
  },
  experienceCompany: {
    fontSize: 14,
    color: colors.gray600,
  },
  skillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  skillBadge: {
    backgroundColor: colors.primary + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  marginBottom: 8,
  },
  skillText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  linkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  linkText: {
    flex: 1,
    fontSize: 15,
    color: colors.gray900,
    marginLeft: 12,
  },
  privacyNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray100,
    padding: 16,
    marginTop: 12,
    marginHorizontal: 12,
    marginBottom: 24,
    borderRadius: 8,
  },
  privacyText: {
    flex: 1,
    fontSize: 12,
    color: colors.gray600,
    marginLeft: 8,
  lineHeight: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    backgroundColor: colors.white,
  },
  errorIconContainer: {
    width: 140,
 height: 140,
    borderRadius: 70,
    backgroundColor: colors.gray100,
 justifyContent: 'center',
 alignItems: 'center',
    marginBottom: 24,
  },
  errorTitle: {
  fontSize: 24,
    fontWeight: 'bold',
    color: colors.gray900,
    marginBottom: 12,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: colors.gray600,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  errorActions: {
    width: '100%',
 gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  secondaryButton: {
    alignItems: 'center',
 justifyContent: 'center',
    backgroundColor: colors.gray100,
paddingHorizontal: 32,
    paddingVertical: 16,
  borderRadius: 12,
  },
  secondaryButtonText: {
    color: colors.gray700,
    fontSize: 16,
    fontWeight: '600',
  },
  privacyTip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.primary + '10',
    padding: 16,
    borderRadius: 12,
    marginTop: 24,
borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  privacyTipText: {
    flex: 1,
    fontSize: 14,
    color: colors.gray700,
    marginLeft: 12,
    lineHeight: 20,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.gray600,
    marginTop: 16,
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.primary,
  },
  headerBackButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.white,
    flex: 1,
    textAlign: 'center',
  },
  headerMenuButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  messageButtonContainer: {
    paddingHorizontal: 20,
  paddingVertical: 16,
    backgroundColor: colors.white,
  },
  messageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  messageButtonDisabled: {
    backgroundColor: colors.gray400,
  },
  messageButtonText: {
    color: colors.white,
  fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  section: {
  backgroundColor: colors.white,
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginTop: 12,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
 marginBottom: 16,
  },
  profileImagePlaceholder: {
    width: 120,
    height: 120,
  borderRadius: 60,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileImageText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: colors.white,
  },
  userName: {
    fontSize: 24,
 fontWeight: 'bold',
    color: colors.gray900,
    marginBottom: 8,
  },
  headline: {
 fontSize: 16,
    color: colors.gray600,
    textAlign: 'center',
    marginBottom: 12,
},
  jobInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  jobText: {
    fontSize: 14,
    color: colors.gray600,
 marginLeft: 6,
  },
  openToWorkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
  borderRadius: 16,
    marginBottom: 20,
  },
  openToWorkText: {
    fontSize: 14,
    color: colors.success,
    fontWeight: '600',
    marginLeft: 6,
  },
  section: {
    backgroundColor: colors.white,
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginTop: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  color: colors.gray900,
    marginLeft: 8,
  },
  sectionText: {
    fontSize: 15,
    color: colors.gray700,
    lineHeight: 22,
  },
  sectionSubtext: {
    fontSize: 14,
  color: colors.gray600,
    marginTop: 4,
  },
  experienceItem: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
  },
  experienceTitle: {
    fontSize: 16,
    fontWeight: '600',
  color: colors.gray900,
    marginBottom: 4,
  },
  experienceCompany: {
    fontSize: 14,
    color: colors.gray600,
  },
  skillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  skillBadge: {
    backgroundColor: colors.primary + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  marginBottom: 8,
  },
  skillText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  linkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  linkText: {
    flex: 1,
    fontSize: 15,
    color: colors.gray900,
    marginLeft: 12,
  },
  privacyNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray100,
    padding: 16,
    marginTop: 12,
    marginHorizontal: 12,
    marginBottom: 24,
    borderRadius: 8,
  },
  privacyText: {
    flex: 1,
    fontSize: 12,
    color: colors.gray600,
    marginLeft: 8,
  lineHeight: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    backgroundColor: colors.white,
  },
  errorIconContainer: {
    width: 140,
 height: 140,
    borderRadius: 70,
    backgroundColor: colors.gray100,
 justifyContent: 'center',
 alignItems: 'center',
    marginBottom: 24,
  },
  errorTitle: {
  fontSize: 24,
    fontWeight: 'bold',
    color: colors.gray900,
    marginBottom: 12,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: colors.gray600,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  errorActions: {
    width: '100%',
 gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  secondaryButton: {
    alignItems: 'center',
 justifyContent: 'center',
    backgroundColor: colors.gray100,
paddingHorizontal: 32,
    paddingVertical: 16,
  borderRadius: 12,
  },
  secondaryButtonText: {
    color: colors.gray700,
    fontSize: 16,
    fontWeight: '600',
  },
  privacyTip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.primary + '10',
    padding: 16,
    borderRadius: 12,
    marginTop: 24,
borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  privacyTipText: {
    flex: 1,
    fontSize: 14,
    color: colors.gray700,
    marginLeft: 12,
    lineHeight: 20,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.gray600,
    marginTop: 16,
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.primary,
  },
  headerBackButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.white,
    flex: 1,
    textAlign: 'center',
  },
  headerMenuButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  messageButtonContainer: {
    paddingHorizontal: 20,
  paddingVertical: 16,
    backgroundColor: colors.white,
  },
  messageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  messageButtonDisabled: {
    backgroundColor: colors.gray400,
  },
  messageButtonText: {
    color: colors.white,
  fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  section: {
  backgroundColor: colors.white,
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginTop: 12,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
 marginBottom: 16,
  },
  profileImagePlaceholder: {
    width: 120,
    height: 120,
  borderRadius: 60,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileImageText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: colors.white,
  },
  userName: {
    fontSize: 24,
 fontWeight: 'bold',
    color: colors.gray900,
    marginBottom: 8,
  },
  headline: {
 fontSize: 16,
    color: colors.gray600,
    textAlign: 'center',
    marginBottom: 12,
},
  jobInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  jobText: {
    fontSize: 14,
    color: colors.gray600,
 marginLeft: 6,
  },
  openToWorkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
  borderRadius: 16,
    marginBottom: 20,
  },
  openToWorkText: {
    fontSize: 14,
    color: colors.success,
    fontWeight: '600',
    marginLeft: 6,
  },
  section: {
    backgroundColor: colors.white,
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginTop: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  color: colors.gray900,
    marginLeft: 8,
  },
  sectionText: {
    fontSize: 15,
    color: colors.gray700,
    lineHeight: 22,
  },
  sectionSubtext: {
    fontSize: 14,
  color: colors.gray600,
    marginTop: 4,
  },
  experienceItem: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
  },
  experienceTitle: {
    fontSize: 16,
    fontWeight: '600',
  color: colors.gray900,
    marginBottom: 4,
  },
  experienceCompany: {
    fontSize: 14,
    color: colors.gray600,
  },
  skillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  skillBadge: {
    backgroundColor: colors.primary + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  marginBottom: 8,
  },
  skillText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  linkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  linkText: {
    flex: 1,
    fontSize: 15,
    color: colors.gray900,
    marginLeft: 12,
  },
  privacyNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray100,
    padding: 16,
    marginTop: 12,
    marginHorizontal: 12,
    marginBottom: 24,
    borderRadius: 8,
  },
  privacyText: {
    flex: 1,
    fontSize: 12,
    color: colors.gray600,
    marginLeft: 8,
  lineHeight: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    backgroundColor: colors.white,
  },
  errorIconContainer: {
    width: 140,
 height: 140,
    borderRadius: 70,
    backgroundColor: colors.gray100,
 justifyContent: 'center',
 alignItems: 'center',
    marginBottom: 24,
  },
  errorTitle: {
  fontSize: 24,
    fontWeight: 'bold',
    color: colors.gray900,
    marginBottom: 12,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: colors.gray600,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  errorActions: {
    width: '100%',
 gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  secondaryButton: {
    alignItems: 'center',
 justifyContent: 'center',
    backgroundColor: colors.gray100,
paddingHorizontal: 32,
    paddingVertical: 16,
  borderRadius: 12,
  },
  secondaryButtonText: {
    color: colors.gray700,
    fontSize: 16,
    fontWeight: '600',
  },
  privacyTip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.primary + '10',
    padding: 16,
    borderRadius: 12,
    marginTop: 24,
borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  privacyTipText: {
    flex: 1,
    fontSize: 14,
    color: colors.gray700,
    marginLeft: 12,
    lineHeight: 20,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.gray600,
    marginTop: 16,
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.primary,
  },
  headerBackButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.white,
    flex: 1,
    textAlign: 'center',
  },
  headerMenuButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  messageButtonContainer: {
    paddingHorizontal: 20,
  paddingVertical: 16,
    backgroundColor: colors.white,
  },
  messageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  messageButtonDisabled: {
    backgroundColor: colors.gray400,
  },
  messageButtonText: {
    color: colors.white,
  fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  section: {
  backgroundColor: colors.white,
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginTop: 12,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
 marginBottom: 16,
  },
  profileImagePlaceholder: {
    width: 120,
    height: 120,
  borderRadius: 60,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileImageText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: colors.white,
  },
  userName: {
    fontSize: 24,
 fontWeight: 'bold',
    color: colors.gray900,
    marginBottom: 8,
  },
  headline: {
 fontSize: 16,
    color: colors.gray600,
    textAlign: 'center',
    marginBottom: 12,
},
  jobInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  jobText: {
    fontSize: 14,
    color: colors.gray600,
 marginLeft: 6,
  },
  openToWorkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
  borderRadius: 16,
    marginBottom: 20,
  },
  openToWorkText: {
    fontSize: 14,
    color: colors.success,
    fontWeight: '600',
    marginLeft: 6,
  },
  section: {
    backgroundColor: colors.white,
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginTop: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  color: colors.gray900,
    marginLeft: 8,
  },
  sectionText: {
    fontSize: 15,
    color: colors.gray700,
    lineHeight: 22,
  },
  sectionSubtext: {
    fontSize: 14,
  color: colors.gray600,
    marginTop: 4,
  },
  experienceItem: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
  },
  experienceTitle: {
    fontSize: 16,
    fontWeight: '600',
  color: colors.gray900,
    marginBottom: 4,
  },
  experienceCompany: {
    fontSize: 14,
    color: colors.gray600,
  },
  skillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  skillBadge: {
    backgroundColor: colors.primary + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  marginBottom: 8,
  },
  skillText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  linkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  linkText: {
    flex: 1,
    fontSize: 15,
    color: colors.gray900,
    marginLeft: 12,
  },
  privacyNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray100,
    padding: 16,
    marginTop: 12,
    marginHorizontal: 12,
    marginBottom: 24,
    borderRadius: 8,
  },
  privacyText: {
    flex: 1,
    fontSize: 12,
    color: colors.gray600,
    marginLeft: 8,
  lineHeight: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    backgroundColor: colors.white,
  },
  errorIconContainer: {
    width: 140,
 height: 140,
    borderRadius: 70,
    backgroundColor: colors.gray100,
 justifyContent: 'center',
 alignItems: 'center',
    marginBottom: 24,
  },
  errorTitle: {
  fontSize: 24,
    fontWeight: 'bold',
    color: colors.gray900,
    marginBottom: 12,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: colors.gray600,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  errorActions: {
    width: '100%',
 gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  secondaryButton: {
    alignItems: 'center',
 justifyContent: 'center',
    backgroundColor: colors.gray100,
paddingHorizontal: 32,
    paddingVertical: 16,
  borderRadius: 12,
  },
  secondaryButtonText: {
    color: colors.gray700,
    fontSize: 16,
    fontWeight: '600',
  },
  privacyTip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.primary + '10',
    padding: 16,
    borderRadius: 12,
    marginTop: 24,
borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  privacyTipText: {
    flex: 1,
    fontSize: 14,
    color: colors.gray700,
    marginLeft: 12,
    lineHeight: 20,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.gray600,
    marginTop: 16,
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.primary,
  },
  headerBackButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.white,
    flex: 1,
    textAlign: 'center',
  },
  headerMenuButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  messageButtonContainer: {
    paddingHorizontal: 20,
  paddingVertical: 16,
    backgroundColor: colors.white,
  },
  messageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  messageButtonDisabled: {
    backgroundColor: colors.gray400,
  },
  messageButtonText: {
    color: colors.white,
  fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  section: {
  backgroundColor: colors.white,
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginTop: 12,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
 marginBottom: 16,
  },
  profileImagePlaceholder: {
    width: 120,
    height: 120,
  borderRadius: 60,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileImageText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: colors.white,
  },
  userName: {
    fontSize: 24,
 fontWeight: 'bold',
    color: colors.gray900,
    marginBottom: 8,
  },
  headline: {
 fontSize: 16,
    color: colors.gray600,
    textAlign: 'center',
    marginBottom: 12,
},
  jobInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  jobText: {
    fontSize: 14,
    color: colors.gray600,
 marginLeft: 6,
  },
  openToWorkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
  borderRadius: 16,
    marginBottom: 20,
  },
  openToWorkText: {
    fontSize: 14,
    color: colors.success,
    fontWeight: '600',
    marginLeft: 6,
  },
  section: {
    backgroundColor: colors.white,
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginTop: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  color: colors.gray900,
    marginLeft: 8,
  },
  sectionText: {
    fontSize: 15,
    color: colors.gray700,
    lineHeight: 22,
  },
  sectionSubtext: {
    fontSize: 14,
  color: colors.gray600,
    marginTop: 4,
  },
  experienceItem: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
  },
  experienceTitle: {
    fontSize: 16,
    fontWeight: '600',
  color: colors.gray900,
    marginBottom: 4,
  },
  experienceCompany: {
    fontSize: 14,
    color: colors.gray600,
  },
  skillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  skillBadge: {
    backgroundColor: colors.primary + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  marginBottom: 8,
  },
  skillText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  linkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  linkText: {
    flex: 1,
    fontSize: 15,
    color: colors.gray900,
    marginLeft: 12,
  },
  privacyNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray100,
    padding: 16,
    marginTop: 12,
    marginHorizontal: 12,
    marginBottom: 24,
    borderRadius: 8,
  },
  privacyText: {
    flex: 1,
    fontSize: 12,
    color: colors.gray600,
    marginLeft: 8,
  lineHeight: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    backgroundColor: colors.white,
  },
  errorIconContainer: {
    width: 140,
 height: 140,
    borderRadius: 70,
    backgroundColor: colors.gray100,
 justifyContent: 'center',
 alignItems: 'center',
    marginBottom: 24,
  },
  errorTitle: {
  fontSize: 24,
    fontWeight: 'bold',
    color: colors.gray900,
    marginBottom: 12,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: colors.gray600,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  errorActions: {
    width: '100%',
 gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  secondaryButton: {
    alignItems: 'center',
 justifyContent: 'center',
    backgroundColor: colors.gray100,
paddingHorizontal: 32,
    paddingVertical: 16,
  borderRadius: 12,
  },
  secondaryButtonText: {
    color: colors.gray700,
    fontSize: 16,
    fontWeight: '600',
  },
  privacyTip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.primary + '10',
    padding: 16,
    borderRadius: 12,
    marginTop: 24,
borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  privacyTipText: {
    flex: 1,
    fontSize: 14,
    color: colors.gray700,
    marginLeft: 12,
    lineHeight: 20,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.gray600,
    marginTop: 16,
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.primary,
  },
  headerBackButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.white,
    flex: 1,
    textAlign: 'center',
  },
  headerMenuButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  messageButtonContainer: {
    paddingHorizontal: 20,
  paddingVertical: 16,
    backgroundColor: colors.white,
  },
  messageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  messageButtonDisabled: {
    backgroundColor: colors.gray400,
  },
  messageButtonText: {
    color: colors.white,
  fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  section: {
  backgroundColor: colors.white,
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginTop: 12,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
 marginBottom: 16,
  },
  profileImagePlaceholder: {
    width: 120,
    height: 120,
  borderRadius: 60,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileImageText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: colors.white,
  },
  userName: {
    fontSize: 24,
 fontWeight: 'bold',
    color: colors.gray900,
    marginBottom: 8,
  },
  headline: {
 fontSize: 16,
    color: colors.gray600,
    textAlign: 'center',
    marginBottom: 12,
},
  jobInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  jobText: {
    fontSize: 14,
    color: colors.gray600,
 marginLeft: 6,
  },
  openToWorkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
  borderRadius: 16,
    marginBottom: 20,
  },
  openToWorkText: {
    fontSize: 14,
    color: colors.success,
    fontWeight: '600',
    marginLeft: 6,
  },
  section: {
    backgroundColor: colors.white,
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginTop: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  color: colors.gray900,
    marginLeft: 8,
  },
  sectionText: {
    fontSize: 15,
    color: colors.gray700,
    lineHeight: 22,
  },
  sectionSubtext: {
    fontSize: 14,
  color: colors.gray600,
    marginTop: 4,
  },
  experienceItem: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
  },
  experienceTitle: {
    fontSize: 16,
    fontWeight: '600',
  color: colors.gray900,
    marginBottom: 4,
  },
  experienceCompany: {
    fontSize: 14,
    color: colors.gray600,
  },
  skillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  skillBadge: {
    backgroundColor: colors.primary + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  marginBottom: 8,
  },
  skillText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  linkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  linkText: {
    flex: 1,
    fontSize: 15,
    color: colors.gray900,
    marginLeft: 12,
  },
  privacyNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray100,
    padding: 16,
    marginTop: 12,
    marginHorizontal: 12,
    marginBottom: 24,
    borderRadius: 8,
  },
  privacyText: {
    flex: 1,
    fontSize: 12,
    color: colors.gray600,
    marginLeft: 8,
    lineHeight: 16,
  },
  // Instagram-Style Menu Popup Styles
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  menuPopup: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  menuOption: {
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200 || '#E5E7EB',
    alignItems: 'center',
  },
  menuOptionCancel: {
    borderBottomWidth: 0,
    marginTop: 8,
  },
  menuOptionText: {
    fontSize: 16,
    color: colors.text || '#000000',
    fontWeight: '400',
  },
  menuOptionTextBold: {
    fontSize: 16,
    color: colors.text || '#000000',
    fontWeight: '600',
  },
  menuOptionDanger: {
    color: colors.danger || '#FF3B30',
    fontWeight: '600',
  },
  menuOptionDisabled: {
    color: colors.gray400 || '#9CA3AF',
  },
});
