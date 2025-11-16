import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Image,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import messagingApi from '../../services/messagingApi';
import { colors } from '../../styles/theme';

export default function ConversationsScreen() {
  const navigation = useNavigation();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNewMessageModal, setShowNewMessageModal] = useState(false);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');

  // Load conversations
  const loadConversations = useCallback(async () => {
    try {
      const result = await messagingApi.getMyConversations();
 if (result.success) {
      setConversations(result.data || []);
      }
      
      // Load unread count
      const unreadResult = await messagingApi.getUnreadCount();
      if (unreadResult.success) {
        setUnreadCount(unreadResult.data.TotalUnread || 0);
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Refresh handler
  const onRefresh = useCallback(() => {
    setRefreshing(true);
  loadConversations();
  }, [loadConversations]);

  // Filter conversations by search query
  const filteredConversations = conversations.filter((conv) =>
    conv.OtherUserName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Render single conversation item
  const renderConversation = ({ item }) => {
    const hasUnread = item.UnreadCount > 0;
    
    return (
      <TouchableOpacity
      style={styles.conversationItem}
  onPress={() => navigation.navigate('Chat', { 
          conversationId: item.ConversationID,
          otherUserName: item.OtherUserName,
          otherUserId: item.OtherUserID,
})}
      >
        {/* Profile Picture */}
  <View style={styles.avatar}>
          {item.OtherUserProfilePic ? (
     <Image
          source={{ uri: item.OtherUserProfilePic }}
  style={styles.avatarImage}
    />
      ) : (
 <View style={[styles.avatarPlaceholder, hasUnread && styles.avatarUnread]}>
   <Text style={styles.avatarText}>
          {item.OtherUserName?.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          {hasUnread && <View style={styles.unreadDot} />}
        </View>

      {/* Conversation Info */}
      <View style={styles.conversationInfo}>
       <View style={styles.conversationHeader}>
            <Text style={[styles.userName, hasUnread && styles.userNameUnread]}>
              {item.OtherUserName}
     </Text>
            <Text style={styles.timestamp}>
          {formatTimestamp(item.LastMessageAt)}
         </Text>
     </View>
 <Text
style={[styles.messagePreview, hasUnread && styles.messagePreviewUnread]}
      numberOfLines={1}
          >
  {item.LastMessagePreview || 'No messages yet'}
          </Text>
        </View>

     {/* Unread Badge */}
        {hasUnread && (
          <View style={styles.unreadBadge}>
         <Text style={styles.unreadBadgeText}>{item.UnreadCount}</Text>
      </View>
        )}
      </TouchableOpacity>
    );
  };

  // Format timestamp
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // ?? NEW: Search users for new conversation
  const searchUsers = useCallback(async (query) => {
 if (!query || query.trim().length < 2) {
    setSearchResults([]);
      return;
    }

    try {
  setSearchingUsers(true);
   console.log('?? Searching for users:', query); // DEBUG LOG
   
      // ?? UPDATED: Use real API endpoint instead of filtering conversations
      const result = await messagingApi.searchUsers(query);
      
      console.log('?? Search results:', result); // DEBUG LOG
      console.log('?? First user data:', result.data?.[0]); // DEBUG: Check first user's data
      
      if (result.success) {
        setSearchResults(result.data || []);
  } else {
        setSearchResults([]);
      }
    } catch (error) {
   console.error('? Error searching users:', error);
      setSearchResults([]);
    } finally {
      setSearchingUsers(false);
    }
  }, []);

  // ?? MISSING: Debounce user search - THIS WAS THE ISSUE!
  useEffect(() => {
    const timer = setTimeout(() => {
      if (userSearchQuery) {
        searchUsers(userSearchQuery);
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [userSearchQuery, searchUsers]);

  // Handle user selection from search results
  const handleSelectUser = async (selectedUser) => {
    try {
      setShowNewMessageModal(false);
      setUserSearchQuery('');
      setSearchResults([]);

      // ?? UPDATED: Navigate to ViewProfile instead of creating conversation immediately
      navigation.navigate('ViewProfile', {
        userId: selectedUser.UserID,
  userName: selectedUser.UserName,
      });
    } catch (error) {
      console.error('Error navigating to profile:', error);
      Alert.alert('Error', 'Failed to open profile');
  }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
}

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
   <Text style={styles.headerTitle}>Messages</Text>
        {unreadCount > 0 && (
          <View style={styles.headerBadge}>
    <Text style={styles.headerBadgeText}>{unreadCount}</Text>
          </View>
    )}
     
      {/* ?? NEW: Add New Message Button */}
        <TouchableOpacity 
 style={styles.newMessageButton}
          onPress={() => setShowNewMessageModal(true)}
        >
          <Ionicons name="create-outline" size={24} color={colors.white} />
  </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={colors.gray500} style={styles.searchIcon} />
        <TextInput
   style={styles.searchInput}
          placeholder="Search conversations..."
    value={searchQuery}
    onChangeText={setSearchQuery}
          placeholderTextColor={colors.gray400}
        />
      </View>

      {/* Conversations List */}
      <FlatList
      data={filteredConversations}
        renderItem={renderConversation}
        keyExtractor={(item) => item.ConversationID}
        refreshControl={
<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
  ListEmptyComponent={
 <View style={styles.emptyContainer}>
  <Ionicons name="chatbubbles-outline" size={64} color={colors.gray300} />
            <Text style={styles.emptyText}>No conversations yet</Text>
    <Text style={styles.emptySubtext}>
              Tap the + button to start a new conversation
         </Text>
     </View>
        }
      />
      
 {/* ?? NEW: New Message Modal */}
      <Modal
        visible={showNewMessageModal}
        animationType="slide"
    presentationStyle="pageSheet"
onRequestClose={() => {
          setShowNewMessageModal(false);
 setUserSearchQuery('');
  setSearchResults([]);
        }}
>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
      <TouchableOpacity onPress={() => {
              setShowNewMessageModal(false);
       setUserSearchQuery('');
  setSearchResults([]);
      }}>
    <Ionicons name="close" size={24} color={colors.text} />
   </TouchableOpacity>
 <Text style={styles.modalTitle}>New Message</Text>
        <View style={{ width: 24 }} />
          </View>
          
       <View style={styles.modalSearchContainer}>
   <Ionicons name="search" size={20} color={colors.gray500} style={styles.searchIcon} />
        <TextInput
    style={styles.modalSearchInput}
          placeholder="Search users by name..."
 value={userSearchQuery}
   onChangeText={setUserSearchQuery}
      placeholderTextColor={colors.gray400}
       autoFocus
        />
          </View>
   
    {searchingUsers ? (
<View style={styles.modalLoadingContainer}>
<ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.modalLoadingText}>Searching...</Text>
       </View>
 ) : searchResults.length > 0 ? (
        <FlatList
       data={searchResults}
      keyExtractor={(item) => item.UserID}
       renderItem={({ item }) => (
       <TouchableOpacity
          style={styles.userResultItem}
       onPress={() => handleSelectUser(item)}
     activeOpacity={0.7}
         >
          <View style={styles.userResultAvatar}>
  {item.ProfilePictureURL ? (
     <Image
       source={{ uri: item.ProfilePictureURL }}
       style={styles.userResultAvatarImage}
  />
       ) : (
      <View style={styles.userResultAvatarPlaceholder}>
        <Text style={styles.userResultAvatarText}>
           {item.UserName?.charAt(0).toUpperCase()}
           </Text>
 </View>
    )}
        </View>
        <Text style={styles.userResultName}>{item.UserName}</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.gray400} />
       </TouchableOpacity>
 )}
      />
       ) : userSearchQuery.trim().length > 0 ? (
    <View style={styles.modalEmptyState}>
 <Ionicons name="search-outline" size={64} color={colors.gray300} />
       <Text style={styles.modalEmptyText}>No users found</Text>
              <Text style={styles.modalEmptySubtext}>
  Try a different search term
              </Text>
          </View>
 ) : (
   <View style={styles.modalEmptyState}>
 <Ionicons name="people-outline" size={64} color={colors.gray300} />
    <Text style={styles.modalEmptyText}>Search for users</Text>
          <Text style={styles.modalEmptySubtext}>
    Enter a name to find someone to message
       </Text>
       </View>
   )}
      </View>
   </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.primary,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.white,
    flex: 1,
  },
  headerBadge: {
    backgroundColor: colors.error,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginRight: 12,
  },
  headerBadgeText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: 'bold',
  },
  newMessageButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
backgroundColor: colors.gray100,
 borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.gray900,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 12,
    position: 'relative',
  },
  avatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.gray300,
    justifyContent: 'center',
  alignItems: 'center',
  },
  avatarUnread: {
    backgroundColor: colors.primary,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.white,
  },
  unreadDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.error,
    borderWidth: 2,
    borderColor: colors.white,
  },
  conversationInfo: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
 marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray900,
  },
  userNameUnread: {
    fontWeight: 'bold',
    color: colors.gray900,
  },
  timestamp: {
    fontSize: 12,
    color: colors.gray500,
  },
  messagePreview: {
    fontSize: 14,
    color: colors.gray600,
  },
  messagePreviewUnread: {
    fontWeight: '600',
    color: colors.gray900,
  },
  unreadBadge: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  unreadBadgeText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.gray600,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.gray500,
    marginTop: 8,
    textAlign: 'center',
 paddingHorizontal: 40,
  },
  // ?? NEW: Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: colors.white,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  modalTitle: {
 fontSize: 18,
 fontWeight: 'bold',
    color: colors.gray900,
  },
  modalSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
 paddingHorizontal: 20,
    paddingVertical: 12,
  backgroundColor: colors.gray100,
 borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.gray900,
  },
  modalLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalLoadingText: {
    fontSize: 16,
    color: colors.gray600,
    marginTop: 12,
  },
  userResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  userResultAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
},
  userResultAvatarImage: {
    width: 48,
  height: 48,
    borderRadius: 24,
  },
  userResultAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userResultAvatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.white,
  },
  userResultName: {
  flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray900,
  },
  modalEmptyState: {
    flex: 1,
    justifyContent: 'center',
 alignItems: 'center',
    paddingHorizontal: 40,
  },
  modalEmptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.gray600,
    marginTop: 16,
  },
  modalEmptySubtext: {
    fontSize: 14,
    color: colors.gray500,
  marginTop: 8,
  textAlign: 'center',
  },
});
