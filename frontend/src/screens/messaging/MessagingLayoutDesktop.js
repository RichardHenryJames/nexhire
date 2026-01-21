import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import useResponsive from '../../hooks/useResponsive';
import { typography } from '../../styles/theme';
import messagingApi from '../../services/messagingApi';
import webSocketService from '../../services/websocketService';
import ChatScreen from './ChatScreen';

// Main Desktop Messaging Layout
export default function MessagingLayoutDesktop() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const responsive = useResponsive();
  const { user, isAdmin, userType } = useAuth();

  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [showNewMessageModal, setShowNewMessageModal] = useState(false);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');

  const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);

  // Hide navigation header for desktop layout
  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  // Handle back navigation
  const handleBackPress = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      // Navigate to home if no history (e.g., direct URL access)
      navigation.navigate('MainTabs', { screen: 'Home' });
    }
  };

  // Load conversations
  const loadConversations = useCallback(async () => {
    try {
      const result = await messagingApi.getMyConversations();
      if (result.success) {
        const validConversations = (result.data || []).filter(
          conv => conv.LastMessagePreview && conv.LastMessagePreview.trim() !== ''
        );
        setConversations(validConversations);
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

  useFocusEffect(
    useCallback(() => {
      loadConversations();
    }, [loadConversations])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadConversations();
  }, [loadConversations]);

  const filteredConversations = conversations.filter((conv) =>
    conv.OtherUserName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const searchUsers = useCallback(async (query) => {
    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      setSearchingUsers(true);
      const result = await messagingApi.searchUsers(query);
      if (result.success) {
        setSearchResults(result.data || []);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Error searching users:', error);
      setSearchResults([]);
    } finally {
      setSearchingUsers(false);
    }
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (userSearchQuery) {
        searchUsers(userSearchQuery);
      }
    }, 300);
    return () => clearTimeout(debounce);
  }, [userSearchQuery, searchUsers]);

  const startNewConversation = async (selectedUser) => {
    try {
      const result = await messagingApi.createConversation(selectedUser.UserID);
      if (result.success) {
        setSelectedConversation({
          conversationId: result.data.ConversationID,
          otherUserName: selectedUser.UserName || `${selectedUser.FirstName || ''} ${selectedUser.LastName || ''}`.trim(),
          otherUserId: selectedUser.UserID,
          otherUserProfilePic: selectedUser.ProfilePictureURL,
        });
        setShowNewMessageModal(false);
        setUserSearchQuery('');
        setSearchResults([]);
        loadConversations();
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
    }
  };

  const handleConversationSelect = (conv) => {
    setSelectedConversation({
      conversationId: conv.ConversationID,
      otherUserName: conv.OtherUserName,
      otherUserId: conv.OtherUserID,
      otherUserProfilePic: conv.OtherUserProfilePic,
    });
  };

  const renderConversation = ({ item }) => {
    const hasUnread = item.UnreadCount > 0;
    const isSelected = selectedConversation?.conversationId === item.ConversationID;

    return (
      <TouchableOpacity
        style={[
          styles.conversationItem,
          isSelected && { backgroundColor: colors.primary + '15' },
        ]}
        onPress={() => handleConversationSelect(item)}
      >
        <View style={styles.avatar}>
          {item.OtherUserProfilePic ? (
            <Image source={{ uri: item.OtherUserProfilePic }} style={styles.avatarImage} />
          ) : (
            <View style={[styles.avatarPlaceholder, hasUnread && styles.avatarUnread]}>
              <Text style={styles.avatarText}>{item.OtherUserName?.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          {hasUnread && <View style={styles.unreadDot} />}
        </View>

        <View style={styles.conversationInfo}>
          <View style={styles.conversationHeader}>
            <Text style={[styles.userName, hasUnread && styles.userNameUnread]} numberOfLines={1}>
              {item.OtherUserName}
            </Text>
            <Text style={styles.timestamp}>{formatTimestamp(item.LastMessageAt)}</Text>
          </View>
          <Text style={[styles.messagePreview, hasUnread && styles.messagePreviewUnread]} numberOfLines={1}>
            {item.LastMessagePreview || 'No messages yet'}
          </Text>
        </View>

        {hasUnread && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>{item.UnreadCount}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, flexDirection: 'column', height: '100%', backgroundColor: colors.background }}>
      {/* Top Header Bar */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        paddingHorizontal: 16,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        minHeight: 56,
      }}>
        <TouchableOpacity
          onPress={handleBackPress}
          style={{ padding: 8, marginRight: 8 }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold' }}>Messages</Text>
      </View>

      {/* Main Content Area */}
      <View style={{ flex: 1, flexDirection: 'row', overflow: 'hidden' }}>
        {/* Left Panel - Conversations List */}
        <View style={{
          width: 350,
          minWidth: 300,
          maxWidth: 400,
          borderRightWidth: 1,
          borderRightColor: colors.border,
          flexDirection: 'column',
          backgroundColor: colors.surface,
        }}>
          {/* Search and New Message */}
          <View style={{
            padding: 12,
            paddingHorizontal: 16,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}>
            <View style={[styles.searchContainer, { backgroundColor: colors.background, flex: 1 }]}>
              <Ionicons name="search" size={18} color={colors.gray500} />
              <TextInput
                style={[styles.searchInput, { color: colors.text, outlineStyle: 'none' }]}
                placeholder="Search conversations..."
                placeholderTextColor={colors.gray500}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
            {isAdmin && (
              <TouchableOpacity
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: colors.primary + '15',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
                onPress={() => setShowNewMessageModal(true)}
              >
                <Ionicons name="add" size={24} color={colors.primary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Conversations List */}
          <FlatList
          data={filteredConversations}
          renderItem={renderConversation}
          keyExtractor={(item) => item.ConversationID?.toString()}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              {loading ? (
                <ActivityIndicator size="large" color={colors.primary} />
              ) : (
                <>
                  <Ionicons name="chatbubbles-outline" size={48} color={colors.gray400} />
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>No conversations</Text>
                  <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                    Start a new conversation
                  </Text>
                </>
              )}
            </View>
          }
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1 }}
        />
        </View>

        {/* Right Panel - Chat */}
        <View style={{ flex: 1 }}>
          <ChatScreen
            embedded={true}
            embeddedConversationId={selectedConversation?.conversationId}
            embeddedOtherUserName={selectedConversation?.otherUserName}
            embeddedOtherUserId={selectedConversation?.otherUserId}
            embeddedOtherUserProfilePic={selectedConversation?.otherUserProfilePic}
            onConversationUpdate={loadConversations}
            hideHeader={false}
          />
        </View>
      </View>

      {/* New Message Modal */}
      <Modal
        visible={showNewMessageModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNewMessageModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowNewMessageModal(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="add-circle" size={24} color={colors.primary} style={{ marginRight: 8 }} />
                <Text style={[styles.modalTitle, { color: colors.text }]}>New Message</Text>
              </View>
              <TouchableOpacity onPress={() => setShowNewMessageModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={[styles.searchContainer, { backgroundColor: colors.background, marginBottom: 16, borderWidth: 1, borderColor: colors.border }]}>
              <Ionicons name="search" size={18} color={colors.gray500} />
              <TextInput
                style={[styles.searchInput, { color: colors.text, outlineStyle: 'none' }]}
                placeholder="Search users..."
                placeholderTextColor={colors.gray500}
                value={userSearchQuery}
                onChangeText={setUserSearchQuery}
                autoFocus
              />
            </View>

            {searchingUsers ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 20 }} />
            ) : searchResults.length > 0 ? (
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.UserID?.toString()}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.userResultItem}
                    onPress={() => startNewConversation(item)}
                  >
                    {item.ProfilePictureURL ? (
                      <Image source={{ uri: item.ProfilePictureURL }} style={styles.userResultAvatar} />
                    ) : (
                      <View style={[styles.userResultAvatarPlaceholder, { backgroundColor: colors.primary + '20' }]}>
                        <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 16 }}>
                          {item.UserName?.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.userResultName, { color: colors.text }]}>
                        {item.UserName}
                      </Text>
                      {item.CurrentCompanyName && (
                        <Text style={[styles.userResultCompany, { color: colors.textSecondary }]}>
                          {item.CurrentCompanyName}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                )}
                style={{ maxHeight: 300 }}
              />
            ) : userSearchQuery.length >= 2 ? (
              <Text style={{ color: colors.textSecondary, textAlign: 'center', marginTop: 20 }}>
                No users found
              </Text>
            ) : (
              <Text style={{ color: colors.textSecondary, textAlign: 'center', marginTop: 20 }}>
                Type at least 2 characters to search
              </Text>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const createStyles = (colors, responsive = {}) => StyleSheet.create({
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatar: {
    position: 'relative',
    marginRight: 12,
  },
  avatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarUnread: {
    backgroundColor: colors.primary + '30',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
  },
  unreadDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.surface,
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
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
    flex: 1,
    marginRight: 8,
  },
  userNameUnread: {
    fontWeight: '700',
  },
  timestamp: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  messagePreview: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  messagePreviewUnread: {
    color: colors.text,
    fontWeight: '500',
  },
  unreadBadge: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  unreadBadgeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: 'bold',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: 20,
    height: 40,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 15,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  userResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  userResultAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  userResultAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userResultName: {
    fontSize: 15,
    fontWeight: '500',
  },
  userResultCompany: {
    fontSize: 13,
    marginTop: 2,
  },
});
