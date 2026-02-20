import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  InteractionManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import SubScreenHeader from '../../components/SubScreenHeader';
import ScreenWrapper from '../../components/ScreenWrapper';
import useResponsive from '../../hooks/useResponsive';
import { typography } from '../../styles/theme';
import messagingApi from '../../services/messagingApi';
import MessagingLayoutDesktop from './MessagingLayoutDesktop';
import { showToast } from '../../components/Toast';

// Helper to strip markdown from message preview
const stripMarkdown = (text) => {
  if (!text) return '';
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')  // Remove **bold**
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');  // Remove [link](url) -> link
};

// Wrapper component to handle desktop vs mobile layout
export default function ConversationsScreen() {
  const responsive = useResponsive();

  // On desktop web, use WhatsApp-style split view layout
  if (Platform.OS === 'web' && responsive.isDesktop) {
    return <MessagingLayoutDesktop />;
  }

  // On mobile/tablet, use the standard single-screen layout
  return <ConversationsScreenMobile />;
}

function ConversationsScreenMobile() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { user, isAdmin, userType } = useAuth();
  const responsive = useResponsive();
  const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);
  
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNewMessageModal, setShowNewMessageModal] = useState(false);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  
  // Pagination state for infinite scroll
  const [loadingMore, setLoadingMore] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 50, hasMore: true });
  
  // Refs to prevent duplicate load-more triggers (like JobsScreen)
  const isLoadingMoreRef = useRef(false);
  const lastLoadedPageRef = useRef(0);

  // Load conversations
  const loadConversations = useCallback(async () => {
    try {
      // Reset pagination refs for fresh load
      lastLoadedPageRef.current = 0;
      isLoadingMoreRef.current = false;
      
      // Reset pagination state immediately
      setPagination(prev => ({ ...prev, page: 1, hasMore: true }));
      
      // Fetch both in parallel for faster loading
      const [result, unreadResult] = await Promise.all([
        messagingApi.getMyConversations(1, pagination.pageSize),
        messagingApi.getUnreadCount()
      ]);
      
      if (result.success) {
        // Filter out conversations with no messages
        const validConversations = (result.data || []).filter(
          conv => conv.LastMessagePreview && conv.LastMessagePreview.trim() !== ''
        );
        setConversations(validConversations);
        
        // Update pagination state
        const meta = result.meta || {};
        setPagination(prev => ({
          ...prev,
          page: 1,
          hasMore: meta.hasMore !== undefined ? Boolean(meta.hasMore) : (validConversations.length === prev.pageSize)
        }));
      }

      if (unreadResult.success) {
        setUnreadCount(unreadResult.data.TotalUnread || 0);
      }
    } catch (error) {
    console.error('Error loading conversations:', error);
    } finally {
    setLoading(false);
      setRefreshing(false);
    }
  }, [pagination.pageSize]);

  // Load more conversations (infinite scroll)
  const loadMoreConversations = useCallback(async () => {
    // Use ref for loading check to avoid stale closure
    if (isLoadingMoreRef.current) return;
    if (!pagination.hasMore) return;
    
    const nextPage = pagination.page + 1;
    
    // Prevent fetching same page twice
    if (lastLoadedPageRef.current >= nextPage) return;
    
    try {
      isLoadingMoreRef.current = true;
      setLoadingMore(true);
      const result = await messagingApi.getMyConversations(nextPage, pagination.pageSize);
      
      if (result.success) {
        const newConversations = (result.data || []).filter(
          conv => conv.LastMessagePreview && conv.LastMessagePreview.trim() !== ''
        );
        
        setConversations(prev => [...prev, ...newConversations]);
        
        const meta = result.meta || {};
        const hasMore = meta.hasMore !== undefined ? Boolean(meta.hasMore) : (newConversations.length === pagination.pageSize);
        
        setPagination(prev => ({
          ...prev,
          page: nextPage,
          hasMore: newConversations.length === 0 ? false : hasMore
        }));
        
        if (newConversations.length > 0) {
          lastLoadedPageRef.current = nextPage;
        }
      }
    } catch (error) {
      console.error('Error loading more conversations:', error);
    } finally {
      setLoadingMore(false);
      isLoadingMoreRef.current = false;
    }
  }, [pagination.hasMore, pagination.page, pagination.pageSize]);

  // ⚡ Prefetch on mount (deferred so HomeScreen renders first)
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      loadConversations();
    });
    return () => task.cancel();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh whenever the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadConversations();
    }, [loadConversations])
  );

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
          otherUserProfilePic: item.OtherUserProfilePic,
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
  {stripMarkdown(item.LastMessagePreview) || 'No messages yet'}
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
   
      // ?? UPDATED: Use real API endpoint instead of filtering conversations
      const result = await messagingApi.searchUsers(query);
      
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
      showToast('Failed to open profile', 'error');
  }
  };

  // Handle back navigation
  const handleBack = () => {
    const navState = navigation.getState();
    const routes = navState?.routes || [];
    const currentIndex = navState?.index || 0;
    
    // If we have more than 1 route in the stack, go back normally
    if (routes.length > 1 && currentIndex > 0) {
      navigation.goBack();
    } else {
      // Hard refresh scenario - navigate to Home tab
      navigation.navigate('Main', {
        screen: 'MainTabs',
        params: {
          screen: 'Home'
        }
      });
    }
  };

  // Same structure as JobsScreen - search header fixed, list scrolls
  return (
    <ScreenWrapper withKeyboard>
    <View style={styles.container}>
      {/* Header */}
      <SubScreenHeader
        title="Messages"
        fallbackTab="Home"
        rightContent={isAdmin ? (
          <TouchableOpacity onPress={() => setShowNewMessageModal(true)} style={styles.headerButton}>
            <Ionicons name="add" size={24} color={colors.text} />
          </TouchableOpacity>
        ) : null}
      />

      {/* Search Bar - Fixed at top (like JobsScreen searchHeader) */}
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

      {/* Conversations List Container (like JobsScreen's flex:1 wrapper) */}
      <View style={{ flex: 1 }}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={filteredConversations}
            renderItem={renderConversation}
            keyExtractor={(item) => item.ConversationID}
            style={styles.conversationsList}
            contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            onEndReached={loadMoreConversations}
            onEndReachedThreshold={0.3}
            windowSize={11}
            maxToRenderPerBatch={10}
            initialNumToRender={15}
            removeClippedSubviews={Platform.OS !== 'web'}
            ListFooterComponent={loadingMore ? (
              <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : null}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="chatbubbles-outline" size={64} color={colors.gray300} />
                <Text style={styles.emptyText}>No conversations yet</Text>
                {isAdmin && (
                  <Text style={styles.emptySubtext}>
                    Tap the + button to start a new conversation
                  </Text>
                )}
              </View>
            }
          />
        )}
      </View>
      
      {/* New Message Modal */}
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
            <View style={styles.modalTitleContainer}>
              <Ionicons name="add-circle" size={24} color={colors.primary} style={{ marginRight: 8 }} />
              <Text style={styles.modalTitle}>New Message</Text>
            </View>
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
    </ScreenWrapper>
  );
}

const createStyles = (colors, responsive = {}) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  // Custom header (like ProfileScreen's stickyHeader)
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    // Make header sticky on web
    position: Platform.OS === 'web' ? 'sticky' : 'relative',
    top: 0,
    zIndex: 11,
  },
  headerButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.gray100,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    // Make header sticky on web (like HomeScreen's headerCompact)
    position: Platform.OS === 'web' ? 'sticky' : 'relative',
    top: 0,
    zIndex: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    outlineStyle: 'none',
  },
  conversationsList: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  userNameUnread: {
    fontWeight: 'bold',
    color: colors.text,
  },
  timestamp: {
    fontSize: 12,
    color: colors.textMuted,
  },
  messagePreview: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  messagePreviewUnread: {
    fontWeight: '600',
    color: colors.text,
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
    color: colors.textSecondary,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  modalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.gray100,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    outlineStyle: 'none',
  },
  modalLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalLoadingText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 12,
  },
  userResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
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
    color: colors.text,
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
    color: colors.textSecondary,
    marginTop: 16,
  },
  modalEmptySubtext: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 8,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 100,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
});
