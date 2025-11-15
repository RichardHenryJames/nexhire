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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import messagingApi from '../../services/messagingApi';
import UserProfileHeader from '../../components/profile/UserProfileHeader';
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
      const result = await messagingApi.getPublicProfile(userId);
      
  if (result.success) {
      setProfile(result.data);
      } else {
        Alert.alert('Error', 'Failed to load profile');
    }
    } catch (error) {
      console.error('Error loading profile:', error);
   Alert.alert('Error', 'Failed to load profile');
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
    Alert.alert(
      isBlocked ? 'Unblock User' : 'Block User',
      isBlocked 
        ? 'Are you sure you want to unblock this user?'
        : 'Are you sure you want to block this user? You won\'t receive messages from them.',
      [
    { text: 'Cancel', style: 'cancel' },
 {
          text: isBlocked ? 'Unblock' : 'Block',
          style: isBlocked ? 'default' : 'destructive',
          onPress: async () => {
            try {
    if (isBlocked) {
                await messagingApi.unblockUser(userId);
         setIsBlocked(false);
            Alert.alert('Success', 'User unblocked');
              } else {
      await messagingApi.blockUser(userId, 'Blocked from profile view');
         setIsBlocked(true);
Alert.alert('Success', 'User blocked');
      }
     } catch (error) {
   Alert.alert('Error', 'Failed to update block status');
        }
          },
        },
 ]
    );
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
        <TouchableOpacity onPress={handleBlockUser} style={styles.headerMenuButton}>
        <Ionicons name="ellipsis-vertical" size={24} color={colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView}>
     {/* ?? REUSED: Profile Header Component (NO EDIT, NO STATS) */}
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
        currentCompany: profile.CurrentCompany,
  currentLocation: profile.CurrentLocation,
         yearsOfExperience: profile.YearsOfExperience,
        highestEducation: profile.HighestEducation,
        fieldOfStudy: profile.FieldOfStudy,
            institution: profile.Institution,
       primarySkills: profile.PrimarySkills,
  isOpenToWork: profile.IsOpenToWork,
        openToRefer: false, // Don't show "Open to Refer" for other users
  }}
          userType="JobSeeker"
    onProfileUpdate={null} // Read-only - no updates allowed
          showStats={false} // Hide stats column for privacy
        />

        {/* ?? Send Message Button (PROMINENT) */}
 <View style={styles.messageButtonContainer}>
          <TouchableOpacity
   style={[styles.messageButton, isBlocked && styles.messageButtonDisabled]}
  onPress={handleSendMessage}
   disabled={sendingMessage || isBlocked}
          >
   {sendingMessage ? (
            <ActivityIndicator size="small" color={colors.white} />
      ) : (
  <>
          <Ionicons name="chatbubbles" size={20} color={colors.white} />
              <Text style={styles.messageButtonText}>
      {isBlocked ? 'User Blocked' : 'Send Message'}
           </Text>
         </>
       )}
          </TouchableOpacity>
        </View>

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
 {profile.CurrentCompany && profile.CurrentCompany !== 'Private' && (
    <Text style={styles.experienceCompany}>{profile.CurrentCompany}</Text>
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

        {/* Privacy Notice */}
        <View style={styles.privacyNotice}>
          <Ionicons name="shield-checkmark-outline" size={16} color={colors.gray500} />
          <Text style={styles.privacyText}>
         This is a public profile view. Some information may be hidden for privacy.
       </Text>
        </View>
      </ScrollView>
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
});
