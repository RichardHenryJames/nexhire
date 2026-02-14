import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import messagingApi from "../../services/messagingApi";
import webSocketService from "../../services/websocketService";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import useResponsive from '../../hooks/useResponsive';
import { showToast } from '../../components/Toast';

// Regex patterns for detecting links in messages
const URL_REGEX = /(https?:\/\/[^\s]+)/g;
const MARKDOWN_LINK_REGEX = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;

// Helper to parse text and make URLs clickable (supports markdown links)
const parseMessageContent = (content, isMine, colors) => {
  if (!content) return null;
  
  const result = [];
  
  // Combined regex for bold (**text**), markdown images ![alt](url), and markdown links [text](url)
  const combinedRegex = /(\*\*([^*]+)\*\*)|(!\[([^\]]*)\]\((https?:\/\/[^)]+)\))|(\[([^\]]+)\]\((https?:\/\/[^)]+)\))/g;
  
  let lastIndex = 0;
  let match;
  
  while ((match = combinedRegex.exec(content)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      result.push(content.substring(lastIndex, match.index));
    }
    
    if (match[1]) {
      // Bold text: **text**
      result.push(
        <Text key={`bold-${match.index}`} style={{ fontWeight: '700' }}>
          {match[2]}
        </Text>
      );
    } else if (match[3]) {
      // Markdown image: ![alt](url) - render as inline image
      result.push(
        <Image
          key={`img-${match.index}`}
          source={{ uri: match[5] }}
          style={{ width: 16, height: 16, marginRight: 4 }}
          resizeMode="contain"
        />
      );
    } else if (match[6]) {
      // Markdown link: [text](url)
      result.push(
        <Text
          key={`link-${match.index}`}
          style={{
            color: isMine ? '#E0E7FF' : colors.primary,
            textDecorationLine: 'underline',
          }}
          onPress={() => Linking.openURL(match[8])}
        >
          {match[7]}
        </Text>
      );
    }
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text
  if (lastIndex < content.length) {
    result.push(content.substring(lastIndex));
  }
  
  // If no matches, check for plain URLs as fallback
  if (result.length === 0) {
    const parts = content.split(URL_REGEX);
    return parts.map((part, index) => {
      if (URL_REGEX.test(part)) {
        URL_REGEX.lastIndex = 0;
        return (
          <Text
            key={index}
            style={{
              color: isMine ? '#E0E7FF' : colors.primary,
              textDecorationLine: 'underline',
            }}
            onPress={() => Linking.openURL(part)}
          >
            {part}
          </Text>
        );
      }
      return part;
    });
  }
  
  return result;
};

// Helper for web - returns JSX elements with clickable links and bold
const parseMessageContentWeb = (content, isMine, colors) => {
  if (!content) return null;
  
  const result = [];
  
  // Combined regex for bold (**text**), markdown images ![alt](url), and markdown links [text](url)
  const combinedRegex = /(\*\*([^*]+)\*\*)|(!\[([^\]]*)\]\((https?:\/\/[^)]+)\))|(\[([^\]]+)\]\((https?:\/\/[^)]+)\))/g;
  
  let lastIndex = 0;
  let match;
  
  while ((match = combinedRegex.exec(content)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      result.push(content.substring(lastIndex, match.index));
    }
    
    if (match[1]) {
      // Bold text: **text**
      result.push(
        <strong key={`bold-${match.index}`}>{match[2]}</strong>
      );
    } else if (match[3]) {
      // Markdown image: ![alt](url) - render as inline image
      result.push(
        <img
          key={`img-${match.index}`}
          src={match[5]}
          alt={match[4] || ''}
          style={{ width: 16, height: 16, marginRight: 4, verticalAlign: 'middle' }}
        />
      );
    } else if (match[6]) {
      // Markdown link: [text](url)
      result.push(
        <a
          key={`link-${match.index}`}
          href={match[8]}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: isMine ? '#E0E7FF' : colors.primary,
            textDecoration: 'underline',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {match[7]}
        </a>
      );
    }
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text
  if (lastIndex < content.length) {
    result.push(content.substring(lastIndex));
  }
  
  // If no matches, check for plain URLs as fallback
  if (result.length === 0) {
    const parts = content.split(URL_REGEX);
    return parts.map((part, index) => {
      if (URL_REGEX.test(part)) {
        URL_REGEX.lastIndex = 0;
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: isMine ? '#E0E7FF' : colors.primary,
              textDecoration: 'underline',
              wordBreak: 'break-all',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </a>
        );
      }
      return part;
    });
  }
  
  return result;
};

export default function ChatScreen({ 
  // Props for embedded mode (desktop WhatsApp-style layout)
  embedded = false,
  embeddedConversationId,
  embeddedOtherUserName,
  embeddedOtherUserId,
  embeddedOtherUserProfilePic,
  onConversationUpdate,
  hideHeader = false,
}) {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const { colors } = useTheme();
  const responsive = useResponsive();
  const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);
  const flatListRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Use props if embedded, otherwise use route.params
  const routeParams = route?.params || {};
  const conversationId = embedded ? embeddedConversationId : routeParams.conversationId;
  const otherUserName = embedded ? embeddedOtherUserName : routeParams.otherUserName;
  const otherUserId = embedded ? embeddedOtherUserId : routeParams.otherUserId;
  const otherUserProfilePic = embedded ? embeddedOtherUserProfilePic : routeParams.otherUserProfilePic;

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [signalRConnected, setSignalRConnected] = useState(false);
  const [usePolling, setUsePolling] = useState(false);
  const [otherUserProfile, setOtherUserProfile] = useState(
    otherUserProfilePic ? { profilePictureUrl: otherUserProfilePic } : null
  );
  const [showMenu, setShowMenu] = useState(false); // For web dropdown

  const connectionStatusRef = useRef({ connected: false, polling: false });
  const currentUserId = user?.userId || user?.UserID;

  const scrollToBottom = () => {
    if (Platform.OS === "web" && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    } else if (flatListRef.current) {
      flatListRef.current.scrollToOffset({ offset: 0, animated: true });
    }
  };

  const loadMessages = useCallback(
    async (pageNum = 1, append = false) => {
      // Guard: Don't load if no conversation selected
      if (!conversationId) return;
      
      try {
        if (pageNum === 1) setLoading(true);
        else setLoadingMore(true);

        const result = await messagingApi.getMessages(
          conversationId,
          pageNum,
          50
        );

        if (result.success) {
          const newMessages = result.data || [];
          if (append) {
            setMessages((prev) => [...prev, ...newMessages]);
          } else {
            setMessages(newMessages);
          }
          setHasMore(newMessages.length === 50);
          setPage(pageNum);
        }
      } catch (error) {
        console.error("Error loading messages:", error);
        showToast("Failed to load messages", "error");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [conversationId]
  );

  // Load other user's profile for picture
  const loadOtherUserProfile = useCallback(async () => {
    try {
      // Try to get profile picture from first message or fetch from API
      if (messages.length > 0) {
        const otherUserMessage = messages.find(
          (m) => m.SenderUserID !== currentUserId
        );
        if (otherUserMessage && otherUserMessage.SenderProfilePic) {
          setOtherUserProfile({
            profilePictureUrl: otherUserMessage.SenderProfilePic,
          });
        }
      }
    } catch (error) {
      console.error("Error loading other user profile:", error);
    }
  }, [messages, currentUserId]);

  useEffect(() => {
    loadOtherUserProfile();
  }, [messages, loadOtherUserProfile]);

  useEffect(() => {
    // Guard: Don't run if no conversation is selected (desktop embedded mode initial state)
    if (!conversationId) return;
    
    let isMounted = true;
    let pollingInterval = null;

    loadMessages(1);

    const markAsReadOnOpen = async () => {
      try {
        await messagingApi.markConversationAsRead(conversationId);
        if (isMounted) {
          setMessages((prev) =>
            prev.map((msg) => ({
              ...msg,
              IsRead: msg.SenderUserID !== currentUserId ? true : msg.IsRead,
            }))
          );
        }
      } catch (error) {
        console.error("Error marking conversation as read:", error);
      }
    };

    markAsReadOnOpen();

    const connectSignalR = async () => {
      try {
        const token = localStorage.getItem("refopen_token");
        if (!token) {
          connectionStatusRef.current.polling = true;
          if (isMounted) setUsePolling(true);
          return;
        }

        await webSocketService.connect(token);
        connectionStatusRef.current.connected = true;
        if (isMounted) setSignalRConnected(true);
      } catch (error) {
        console.error("? SignalR connection failed:", error);
        connectionStatusRef.current.polling = true;
        if (isMounted) {
          setUsePolling(true);
          setSignalRConnected(false);
        }
      }
    };

    connectSignalR();

    const handleNewMessage = (message) => {
      if (message.ConversationID === conversationId && isMounted) {
        setMessages((prev) => {
          const exists = prev.find((m) => m.MessageID === message.MessageID);
          if (exists) return prev;
          return [message, ...prev];
        });

        if (message.SenderUserID !== currentUserId) {
          messagingApi
            .markMessageAsRead(message.MessageID)
            .catch(console.error);
        }
        setTimeout(scrollToBottom, 100);
      }
    };

    const handleConversationRead = (data) => {
      if (data.conversationId === conversationId && isMounted) {
        setMessages((prev) =>
          prev.map((msg) => ({
            ...msg,
            IsRead: msg.SenderUserID === currentUserId ? true : msg.IsRead,
            ReadAt:
              msg.SenderUserID === currentUserId ? data.readAt : msg.ReadAt,
          }))
        );
      }
    };

    webSocketService.onNewMessage(handleNewMessage);
    webSocketService.onConversationRead(handleConversationRead);

    setTimeout(() => {
      if (connectionStatusRef.current.polling && isMounted) {
        pollingInterval = setInterval(async () => {
          try {
            const result = await messagingApi.getMessages(
              conversationId,
              1,
              50
            );
            if (result.success && isMounted) {
              const newMessages = result.data || [];
              setMessages((prev) => {
                const prevIds = prev.map((m) => m.MessageID).join(",");
                const newIds = newMessages.map((m) => m.MessageID).join(",");
                if (prevIds !== newIds) {
                  const latestMessage = newMessages[0];
                  if (
                    latestMessage &&
                    latestMessage.SenderUserID !== currentUserId
                  ) {
                    setTimeout(scrollToBottom, 100);
                  }
                  return newMessages;
                }
                return prev;
              });
            }
          } catch (error) {
            console.error("? Polling error:", error);
          }
        }, 3000);
      }
    }, 2000);

    return () => {
      isMounted = false;
      if (connectionStatusRef.current.connected) {
        webSocketService.disconnect();
      }
      webSocketService.off("newMessage");
      webSocketService.off("conversationRead");
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [conversationId, currentUserId, loadMessages]);

  const handleSend = async () => {
    if (!messageText.trim()) return;

    const textToSend = messageText.trim();
    setMessageText("");

    const optimisticMessageId = `temp_${Date.now()}_${Math.random()}`;
    const optimisticMessage = {
      MessageID: optimisticMessageId,
      ConversationID: conversationId,
      SenderUserID: currentUserId,
      Content: textToSend,
      MessageType: "Text",
      IsRead: false,
      IsDeleted: false,
      CreatedAt: new Date().toISOString(),
      SenderName: user.firstName + " " + user.lastName,
      SenderProfilePic: user.profilePictureUrl,
      _sending: true,
    };

    setMessages((prev) => [optimisticMessage, ...prev]);
    setSending(true);
    setTimeout(scrollToBottom, 50);

    try {
      const result = await messagingApi.sendMessage(conversationId, textToSend);
      if (result.success) {
        const realMessage = result.data;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.MessageID === optimisticMessageId
              ? { ...realMessage, _sending: false }
              : msg
          )
        );
        // Notify parent to refresh conversation list (for embedded mode)
        onConversationUpdate?.();
      }
    } catch (error) {
      console.error("? Error sending message:", error);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.MessageID === optimisticMessageId
            ? { ...msg, _sending: false, _failed: true }
            : msg
        )
      );
      Alert.alert("Failed to send", "Message could not be sent.", [
        {
          text: "Delete",
          onPress: () =>
            setMessages((prev) =>
              prev.filter((m) => m.MessageID !== optimisticMessageId)
            ),
        },
        {
          text: "Retry",
          onPress: () => {
            setMessages((prev) =>
              prev.filter((m) => m.MessageID !== optimisticMessageId)
            );
            setMessageText(textToSend);
          },
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore && messages.length > 0) {
      loadMessages(page + 1, true);
    }
  };

  const handleDeleteMessage = (messageId, senderId) => {
    const isMine = senderId === currentUserId;
    Alert.alert(
      "Delete Message",
      "How would you like to delete this message?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete for me",
          onPress: () => deleteMessage(messageId, "Sender"),
        },
        isMine && {
          text: "Delete for everyone",
          style: "destructive",
          onPress: () => deleteMessage(messageId, "Both"),
        },
      ].filter(Boolean)
    );
  };

  const deleteMessage = async (messageId, deleteFor) => {
    try {
      const result = await messagingApi.deleteMessage(messageId, deleteFor);
      if (result.success) {
        setMessages((prev) =>
          prev.filter((msg) => msg.MessageID !== messageId)
        );
        showToast("Message deleted", "success");
      }
    } catch (error) {
      console.error("Error deleting message:", error);
      showToast("Failed to delete message", "error");
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now - date) / 86400000);

    if (diffDays === 0) {
      return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return date.toLocaleDateString("en-US", { weekday: "short" });
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    }
  };

  const renderMessage = ({ item }) => {
    const isMine = item.SenderUserID === currentUserId;
    const isSending = item._sending === true;
    const isFailed = item._failed === true;

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onLongPress={() =>
          !isSending && handleDeleteMessage(item.MessageID, item.SenderUserID)
        }
        style={[
          styles.messageContainer,
          isMine ? styles.myMessageContainer : styles.theirMessageContainer,
        ]}
      >
        {!isMine && <Text style={styles.senderName}>{otherUserName}</Text>}
        <View
          style={[
            styles.messageBubble,
            isMine ? styles.myMessageBubble : styles.theirMessageBubble,
            isSending && styles.messageSending,
            isFailed && styles.messageFailed,
          ]}
        >
          <Text
            style={[
              styles.messageText,
              isMine ? styles.myMessageText : styles.theirMessageText,
              (isSending || isFailed) && styles.messageTextFaded,
            ]}
          >
            {parseMessageContent(item.Content, isMine, colors)}
          </Text>
          <View style={styles.messageFooter}>
            <Text
              style={[
                styles.messageTime,
                isMine ? styles.myMessageTime : styles.theirMessageTime,
              ]}
            >
              {formatTime(item.SentAt || item.CreatedAt)}
            </Text>
            {isMine && (
              <View style={styles.readReceiptContainer}>
                {isFailed ? (
                  <Ionicons
                    name="alert-circle"
                    size={14}
                    color={colors.danger}
                    style={styles.readReceipt}
                  />
                ) : isSending ? (
                  <ActivityIndicator
                    size="small"
                    color={colors.gray400}
                    style={styles.sendingIndicator}
                  />
                ) : item.IsRead ? (
                  <Ionicons
                    name="checkmark-done"
                    size={14}
                    color={colors.primary}
                    style={styles.readReceipt}
                  />
                ) : (
                  <Ionicons
                    name="checkmark-done"
                    size={14}
                    color={colors.gray400}
                    style={styles.readReceipt}
                  />
                )}
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Handle back navigation - works even after hard refresh
  const handleBackPress = () => {
    // Check if we can go back in the navigation history
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      // If no history (e.g., after hard refresh), navigate to Messages screen
      navigation.navigate('Main', { screen: 'MainTabs', params: { screen: 'Messages' } });
    }
  };

  // Early returns for loading/no conversation states - placed AFTER all hooks
  if (!user || !currentUserId) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.emptyText}>Loading user data...</Text>
      </View>
    );
  }

  // For embedded mode - show placeholder when no conversation selected
  if (embedded && !conversationId) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background, height: '100%', justifyContent: 'center', alignItems: 'center' }]}>
        <Ionicons name="chatbubbles-outline" size={80} color={colors.gray400} />
        <Text style={[styles.emptyTitle, { color: colors.text, marginTop: 16 }]}>Select a conversation</Text>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          Choose from your existing conversations or start a new one
        </Text>
      </View>
    );
  }

  // WEB LAYOUT
  if (Platform.OS === "web") {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: embedded ? "100%" : "100vh",
          backgroundColor: colors.background,
          alignItems: responsive.isDesktop && !embedded ? "center" : "stretch",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            maxWidth: responsive.isDesktop && !embedded ? 900 : "100%",
            height: "100%",
            overflow: "hidden",
          }}
        >
        <div
        style={{
  display: "flex",
         alignItems: "center",
  padding: "12px 16px",
          backgroundColor: colors.surface,
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
     zIndex: 10,
         position: "sticky",
            top: 0,
          }}
        >
          {/* Only show back button if not embedded (desktop split view) */}
          {!embedded && (
          <TouchableOpacity
          onPress={handleBackPress}
            style={{ padding: 4, marginRight: 12 }}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          )}

          {/* Clickable Profile Section */}
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              cursor: "pointer",
            }}
            onClick={() =>
              navigation.navigate("ViewProfile", { 
                userId: otherUserId,
                userName: otherUserName,
                userProfilePic: otherUserProfile?.profilePictureUrl || otherUserProfilePic
              })
            }
          >
            {/* Profile Picture */}
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: colors.gray300,
                marginRight: 12,
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {otherUserProfile?.profilePictureUrl ? (
                <img
                  src={otherUserProfile.profilePictureUrl}
                  alt={otherUserName}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <Ionicons name="person" size={24} color={colors.gray500} />
              )}
            </div>

            {/* Name Only */}
            <div style={{ flex: 1 }}>
              <div
                style={{ fontSize: 16, fontWeight: "600", color: colors.text, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}
              >
                {otherUserName}
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            flex: 1,
            overflow: "auto",
            display: "flex",
            flexDirection: "column-reverse",
            padding: "8px",
            backgroundColor: colors.background,
          }}
        >
          {loading ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
              }}
            >
              <ActivityIndicator size="large" color={colors.primary} />
              <div
                style={{ fontSize: 14, color: colors.gray500, marginTop: 16 }}
              >
                Loading messages...
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
              }}
            >
              <Ionicons
                name="chatbubbles-outline"
                size={64}
                color={colors.gray300}
              />
              <div
                style={{
                  fontSize: 18,
                  fontWeight: "600",
                  color: colors.gray600,
                  marginTop: 16,
                }}
              >
                No messages yet
              </div>
              <div
                style={{ fontSize: 14, color: colors.gray500, marginTop: 8 }}
              >
                Send a message to start the conversation
              </div>
            </div>
          ) : (
            <>
              <div ref={messagesEndRef} />
              {messages.map((item) => {
                const isMine = item.SenderUserID === currentUserId;
                const isSending = item._sending === true;
                const isFailed = item._failed === true;

                return (
                  <div
                    key={item.MessageID}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: isMine ? "flex-end" : "flex-start",
                      marginBottom: "4px",
                      maxWidth: "65%",
                      alignSelf: isMine ? "flex-end" : "flex-start",
                    }}
                  >
                    {!isMine && (
                      <div
                        style={{
                          fontSize: 16,
                          color: colors.gray600,
                          marginBottom: 2,
                          marginLeft: 8,
                          fontWeight: "600",
                          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                        }}
                      >
                        {otherUserName}
                      </div>
                    )}
                    <div
                      onContextMenu={(e) => {
                        e.preventDefault();
                        if (!isSending)
                          handleDeleteMessage(
                            item.MessageID,
                            item.SenderUserID
                          );
                      }}
                      style={{
                        backgroundColor: isMine ? colors.primary : colors.surface,
                        borderRadius: "12px",
                        padding: "8px 12px",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                        position: "relative",
                        minWidth: "60px",
                        opacity: isSending ? 0.7 : isFailed ? 0.5 : 1,
                        border: isFailed
                          ? `1px solid ${colors.danger}`
                          : "none",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 14,
                          lineHeight: "20px",
                          color: isMine ? colors.white : colors.text,
                          wordWrap: "break-word",
                          whiteSpace: "pre-wrap",
                          marginBottom: "4px",
                          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                        }}
                      >
                        {parseMessageContentWeb(item.Content, isMine, colors)}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "flex-end",
                          gap: "4px",
                          marginTop: "2px",
                        }}
                      >
                        <span
                          style={{
                            fontSize: 11,
                            color: isMine ? colors.gray100 : colors.gray500,
                            lineHeight: 1,
                          }}
                        >
                          {formatTime(item.SentAt || item.CreatedAt)}
                        </span>
                        {isMine && (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                            }}
                          >
                            {isFailed ? (
                              <Ionicons
                                name="alert-circle"
                                size={16}
                                color={colors.danger}
                              />
                            ) : isSending ? (
                              <div style={{ width: 16, height: 16 }}>
                                <ActivityIndicator
                                  size="small"
                                  color={colors.gray100}
                                />
                              </div>
                            ) : item.IsRead ? (
                              <Ionicons
                                name="checkmark-done"
                                size={16}
                                color={colors.gray100}
                              />
                            ) : (
                              <Ionicons
                                name="checkmark-done"
                                size={16}
                                color={colors.gray300}
                              />
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {loadingMore && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    padding: "16px",
                  }}
                >
                  <ActivityIndicator size="small" color={colors.primary} />
                </div>
              )}
            </>
          )}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "8px 12px",
            backgroundColor: colors.surface,
            borderTop: `1px solid ${colors.border}`,
            position: "sticky",
            bottom: 0,
          }}
        >
          <TextInput
            style={{
              flex: 1,
              backgroundColor: colors.background,
              borderRadius: 24,
              paddingHorizontal: 16,
              paddingVertical: 10,
              fontSize: 15,
              maxHeight: 100,
              marginRight: 8,
              outline: "none",
              border: "none",
              color: colors.text,
            }}
            placeholder="Type a message"
            placeholderTextColor={colors.gray400}
            value={messageText}
            onChangeText={setMessageText}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor:
                messageText.trim() && !sending
                  ? colors.primary
                  : colors.gray300,
              justifyContent: "center",
              alignItems: "center",
              transition: "background-color 0.2s",
            }}
            onPress={handleSend}
            disabled={!messageText.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Ionicons name="send" size={20} color={colors.white} />
            )}
          </TouchableOpacity>
        </div>
        </div>
      </div>
    );
  }

  // MOBILE LAYOUT
  return (
    <View style={styles.container}>
      <View style={styles.innerContainer}>
      {!hideHeader && (
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleBackPress}
          style={styles.backButton}
        >
       <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>

        {/* Clickable Profile Section */}
        <TouchableOpacity
          style={{ flex: 1, flexDirection: "row", alignItems: "center" }}
          onPress={() =>
            navigation.navigate("ViewProfile", { 
              userId: otherUserId,
              userName: otherUserName,
              userProfilePic: otherUserProfile?.profilePictureUrl || otherUserProfilePic
            })
          }
        >
          {/* Profile Picture */}
          <View style={styles.profilePicture}>
            {otherUserProfile?.profilePictureUrl ? (
              <Image
                source={{ uri: otherUserProfile.profilePictureUrl }}
                style={styles.profileImage}
              />
            ) : (
              <Ionicons name="person" size={24} color={colors.gray500} />
            )}
          </View>

          {/* Name Only */}
          <View style={styles.headerInfo}>
            <Text style={styles.headerName}>{otherUserName}</Text>
          </View>
        </TouchableOpacity>
      </View>
      )}

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.MessageID}
        inverted
        contentContainerStyle={styles.messagesList}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.loadingMore}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.emptySubtext}>Loading messages...</Text>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons
                name="chatbubbles-outline"
                size={64}
                color={colors.gray300}
              />
              <Text style={styles.emptyText}>No messages yet</Text>
              <Text style={styles.emptySubtext}>
                Send a message to start the conversation
              </Text>
            </View>
          )
        }
      />

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Type a message"
          placeholderTextColor={colors.gray400}
          value={messageText}
          onChangeText={setMessageText}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            (!messageText.trim() || sending) && styles.sendButtonDisabled,
          ]}
          onPress={handleSend}
          disabled={!messageText.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Ionicons name="send" size={20} color={colors.white} />
          )}
        </TouchableOpacity>
      </View>
      </View>
    </View>
  );
}

const createStyles = (colors, responsive = {}) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    // Fix for mobile web where 100vh includes address bar
    ...(Platform.OS === 'web' ? {
      height: '100%',
      minHeight: 0,
    } : {}),
    ...(Platform.OS === 'web' && responsive.isDesktop ? {
      alignItems: 'center',
    } : {}),
  },
  innerContainer: {
    width: '100%',
    maxWidth: Platform.OS === 'web' && responsive.isDesktop ? 900 : '100%',
    flex: 1,
    // Fix for mobile web
    ...(Platform.OS === 'web' ? {
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
    } : {}),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.surface,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    elevation: 4,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    zIndex: 10,
    flexShrink: 0,
    minHeight: 56,
  },
  backButton: { padding: 4, marginRight: 12 },
  profilePicture: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.gray300,
    marginRight: 12,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  profileImage: { width: "100%", height: "100%", resizeMode: "cover" },
  headerInfo: { flex: 1 },
  headerName: { fontSize: 16, fontWeight: "600", color: colors.text, fontFamily: "System" },
  menuButton: { padding: 4 },
  messagesList: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: colors.background,
  },
  messageContainer: { marginVertical: 2, maxWidth: "75%" },
  myMessageContainer: { alignSelf: "flex-end" },
  theirMessageContainer: { alignSelf: "flex-start" },
  senderName: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 2,
    marginLeft: 8,
    fontWeight: "600",
    fontFamily: "System",
  },
  messageBubble: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    maxWidth: "100%",
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  messageSending: { opacity: 0.7 },
  messageFailed: { opacity: 0.5, borderWidth: 1, borderColor: colors.danger },
  myMessageBubble: { backgroundColor: colors.primary },
  theirMessageBubble: { backgroundColor: colors.surface },
  messageText: { fontSize: 14, lineHeight: 20, color: colors.text, fontFamily: "System" },
  messageTextFaded: { opacity: 0.8 },
  myMessageText: { color: colors.white },
  theirMessageText: { color: colors.text },
  messageFooter: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    justifyContent: "flex-end",
    gap: 4,
  },
  messageTime: { fontSize: 11, fontWeight: "400" },
  myMessageTime: { color: colors.gray100 },
  theirMessageTime: { color: colors.textSecondary },
  readReceipt: { marginLeft: 3 },
  readReceiptContainer: { marginLeft: 3 },
  sendingIndicator: { width: 16, height: 16 },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    marginRight: 8,
    color: colors.text,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: { backgroundColor: colors.gray300 },
  loadingMore: { paddingVertical: 16, alignItems: "center" },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
    transform: [{ scaleY: -1 }],
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.textSecondary,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
    textAlign: "center",
    paddingHorizontal: 40,
  },
});
