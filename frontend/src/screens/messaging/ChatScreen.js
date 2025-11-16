import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import messagingApi from "../../services/messagingApi";
import webSocketService from "../../services/websocketService"; // This is now SignalR!
import { useAuth } from "../../contexts/AuthContext";
import { colors } from "../../styles/theme";

export default function ChatScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const flatListRef = useRef(null);

  const { conversationId, otherUserName, otherUserId } = route.params;

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [signalRConnected, setSignalRConnected] = useState(false); // ?? Track SignalR status
  const [usePolling, setUsePolling] = useState(false); // ?? Fallback to polling if SignalR fails

  // ?? DEBUG: Check user object
  console.log("?? ChatScreen - User object:", user);
  console.log("?? ChatScreen - User ID:", user?.userId || user?.UserID);

  // ?? FIX: Check both userId and UserID (capitalization)
  const currentUserId = user?.userId || user?.UserID;

  if (!user || !currentUserId) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.emptyText}>Loading user data...</Text>
      </View>
    );
  }

  // Load messages
  const loadMessages = useCallback(
    async (pageNum = 1, append = false) => {
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
        Alert.alert("Error", "Failed to load messages");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [conversationId]
  );

  // Initial load
  useEffect(() => {
    loadMessages(1);

    // ?? Mark conversation as read ONCE when opening
    const markAsReadOnOpen = async () => {
      try {
        await messagingApi.markConversationAsRead(conversationId);
        console.log("? Conversation marked as read");

        // Update local state to show all messages as read
        setMessages((prev) =>
          prev.map((msg) => ({
            ...msg,
            IsRead: msg.SenderUserID !== currentUserId ? true : msg.IsRead,
          }))
        );
      } catch (error) {
        console.error("Error marking conversation as read:", error);
      }
    };

    markAsReadOnOpen();

    // ?? NEW: Connect to SignalR ONLY when entering chat
    // This saves connections for SignalR Free Tier limits!
    const connectSignalR = async () => {
      try {
        console.log("🔄 Attempting SignalR connection...");

        // ?? FIX: Use localStorage directly instead of API method
        const token = localStorage.getItem("refopen_token");

        if (!token) {
          console.warn("⚠️ No auth token found, falling back to polling");
          setUsePolling(true);
          return;
        }

        await webSocketService.connect(token);
        setSignalRConnected(true);
        console.log("✅ SignalR connected - Real-time messaging enabled");
      } catch (error) {
        console.error("❌ SignalR connection failed:", error);
        console.warn("⚠️ Falling back to polling mode (refresh every 3 seconds)");
        setUsePolling(true);
        setSignalRConnected(false);
      }
    };

    connectSignalR();

    // ? Listen for new messages in real-time (only if SignalR connected)
    const handleNewMessage = (message) => {
      console.log("✅ New message received via SignalR:", message);

      if (message.ConversationID === conversationId) {
        // ✅ CHECK: Don't add if message already exists (prevent duplicates)
        setMessages((prev) => {
          const exists = prev.find(m => m.MessageID === message.MessageID);
          if (exists) {
            console.log("⚠️ Message already exists, skipping duplicate");
            return prev;
          }
          
          // ✅ ADD message to top of list
          console.log("✅ Adding new message to UI");
          return [message, ...prev];
        });

        // Auto-mark as read if it's not from me
        if (message.SenderUserID !== currentUserId) {
          messagingApi
            .markMessageAsRead(message.MessageID)
            .catch(console.error);
        }

        // Scroll to bottom
        setTimeout(() => {
          flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
        }, 100);
      }
    };

    // ? Listen for read receipts
    const handleConversationRead = (data) => {
      console.log("✅ Conversation read event via SignalR:", data);

      if (data.conversationId === conversationId) {
        // Update all my messages to read
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

    // Attach SignalR listeners (only if not using polling)
    if (!usePolling) {
      webSocketService.onNewMessage(handleNewMessage);
      webSocketService.onConversationRead(handleConversationRead);
    }

    // ?? FALLBACK: Polling mechanism (3-second intervals)
    let pollingInterval = null;

    if (usePolling) {
      console.log("🔄 Starting polling mode - checking every 3 seconds");

      pollingInterval = setInterval(async () => {
        try {
          const result = await messagingApi.getMessages(conversationId, 1, 50);

          if (result.success) {
            const newMessages = result.data || [];

            // Only update if messages changed
            setMessages((prev) => {
              const prevIds = prev.map((m) => m.MessageID).join(",");
              const newIds = newMessages.map((m) => m.MessageID).join(",");

              if (prevIds !== newIds) {
                console.log("✅ Polling: New messages detected, updating UI");

                // Check if there's a new message from the other user
                const latestMessage = newMessages[0];
                if (
                  latestMessage &&
                  latestMessage.SenderUserID !== currentUserId
                ) {
                  setTimeout(() => {
                    flatListRef.current?.scrollToOffset({
                      offset: 0,
                      animated: true,
                    });
                  }, 100);
                }

                return newMessages;
              }

              return prev;
            });
          }
        } catch (error) {
          console.error("❌ Polling error:", error);
        }
      }, 3000); // Poll every 3 seconds
    }

    // ?? CLEANUP: Disconnect SignalR and stop polling when leaving chat
    return () => {
      console.log("🧹 Cleaning up chat connections...");

      if (signalRConnected) {
        console.log("🔌 Disconnecting SignalR on chat exit");
        webSocketService.disconnect();
        webSocketService.off("newMessage");
        webSocketService.off("conversationRead");
      }

      if (pollingInterval) {
        console.log("🛑 Stopping polling interval");
        clearInterval(pollingInterval);
      }
    };
  }, [
    conversationId,
    currentUserId,
    loadMessages,
    signalRConnected,
    usePolling,
  ]);

  // Send message - OPTIMISTIC UI
  const handleSend = async () => {
    if (!messageText.trim()) return;

    const textToSend = messageText.trim();
    setMessageText(""); // Clear input immediately
    
    // ✅ CREATE OPTIMISTIC MESSAGE (shows immediately)
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
      _sending: true, // Flag to show loading indicator
    };

    // ✅ ADD TO UI IMMEDIATELY (OPTIMISTIC)
    setMessages((prev) => [optimisticMessage, ...prev]);
    setSending(true);

    // Scroll to bottom
    setTimeout(() => {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    }, 50);

    try {
      // ✅ SEND TO BACKEND (async, in background)
      const result = await messagingApi.sendMessage(conversationId, textToSend);

      if (result.success) {
        // ✅ REPLACE optimistic message with real message from server
        const realMessage = result.data;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.MessageID === optimisticMessageId
              ? { ...realMessage, _sending: false }
              : msg
          )
        );
        console.log("✅ Message sent successfully");
      }
    } catch (error) {
      console.error("❌ Error sending message:", error);
      
      // ✅ MARK MESSAGE AS FAILED
      setMessages((prev) =>
        prev.map((msg) =>
          msg.MessageID === optimisticMessageId
            ? { ...msg, _sending: false, _failed: true }
            : msg
        )
      );
      
      Alert.alert(
        "Failed to send",
        "Message could not be sent. Tap to retry.",
        [
          { text: "Delete", onPress: () => {
            setMessages(prev => prev.filter(m => m.MessageID !== optimisticMessageId));
          }},
          { text: "Retry", onPress: () => {
            setMessages(prev => prev.filter(m => m.MessageID !== optimisticMessageId));
            setMessageText(textToSend);
          }}
        ]
      );
    } finally {
      setSending(false);
    }
  };

  // Load more messages (pagination)
  const handleLoadMore = () => {
    if (!loadingMore && hasMore && messages.length > 0) {
      loadMessages(page + 1, true);
    }
  };

  // Mark message as read when viewing
  const markAsRead = async (messageId, isRead) => {
    if (isRead) return; // Already read

    try {
      await messagingApi.markMessageAsRead(messageId);

      // Update local state
      setMessages((prev) =>
        prev.map((msg) =>
          msg.MessageID === messageId ? { ...msg, IsRead: true } : msg
        )
      );
    } catch (error) {
      console.error("Error marking as read:", error);
    }
  };

  // Delete message
  const handleDeleteMessage = (messageId, senderId) => {
    const isMine = senderId === currentUserId; // ?? FIX: Use currentUserId

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
        // Remove from local state
        setMessages((prev) =>
          prev.filter((msg) => msg.MessageID !== messageId)
        );
        Alert.alert("Success", "Message deleted");
      }
    } catch (error) {
      console.error("Error deleting message:", error);
      Alert.alert("Error", "Failed to delete message");
    }
  };

  // Format timestamp
  const formatTime = (timestamp) => {
    if (!timestamp) return "";

    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now - date) / 86400000);

    if (diffDays === 0) {
      // Today - show time
      return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } else if (diffDays === 1) {
      // Yesterday
      return "Yesterday";
    } else if (diffDays < 7) {
      // This week - show day name
      return date.toLocaleDateString("en-US", { weekday: "short" });
    } else {
      // Older - show date
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    }
  };

  // Render message bubble
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
        {/* ?? Show sender name for their messages */}
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
            {item.Content}
          </Text>

          {/* ? Time and Read Receipt Row */}
          <View style={styles.messageFooter}>
            <Text
              style={[
                styles.messageTime,
                isMine ? styles.myMessageTime : styles.theirMessageTime,
              ]}
            >
              {formatTime(item.SentAt || item.CreatedAt)}
            </Text>

            {/* ?? Read receipt / sending indicator (only for my messages) */}
            {isMine && (
              <View style={styles.readReceiptContainer}>
                {isFailed ? (
                  // ❌ Failed indicator
                  <Ionicons
                    name="alert-circle"
                    size={14}
                    color="#FF5252"
                    style={styles.readReceipt}
                  />
                ) : isSending ? (
                  // ⏳ Sending indicator (clock)
                  <ActivityIndicator 
                    size="small" 
                    color="rgba(255,255,255,0.6)" 
                    style={styles.sendingIndicator}
                  />
                ) : item.IsRead ? (
                  // ✅ Blue double check (Read)
                  <Ionicons
                    name="checkmark-done"
                    size={14}
                    color="#4FC3F7"
                    style={styles.readReceipt}
                  />
                ) : (
                  // ✓✓ Gray double check (Delivered)
                  <Ionicons
                    name="checkmark-done"
                    size={14}
                    color="rgba(255,255,255,0.6)"
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

  // Render date separator
  const renderDateSeparator = (date) => (
    <View style={styles.dateSeparator}>
      <Text style={styles.dateSeparatorText}>{formatDateSeparator(date)}</Text>
    </View>
  );

  const formatDateSeparator = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now - date) / 86400000);

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";

    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={colors.white} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerInfo}
          onPress={() =>
            navigation.navigate("ViewProfile", { userId: otherUserId })
          }
        >
          <Text style={styles.headerName}>{otherUserName}</Text>
          <Text style={styles.headerStatus}>
            {signalRConnected
              ? "Real-time messaging"
              : usePolling
              ? "Polling mode"
              : "Tap to view profile"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            Alert.alert("Conversation Options", "Choose an action", [
              { text: "Cancel", style: "cancel" },
              {
                text: "Archive",
                onPress: () => {
                  messagingApi.archiveConversation(conversationId, true);
                  navigation.goBack();
                },
              },
              {
                text: "Block User",
                style: "destructive",
                onPress: () => {
                  Alert.alert(
                    "Block User",
                    "Are you sure you want to block this user?",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Block",
                        style: "destructive",
                        onPress: async () => {
                          try {
                            await messagingApi.blockUser(otherUserId);
                            Alert.alert("Success", "User blocked");
                            navigation.goBack();
                          } catch (error) {
                            Alert.alert("Error", "Failed to block user");
                          }
                        },
                      },
                    ]
                  );
                },
              },
            ]);
          }}
          style={styles.menuButton}
        >
          <Ionicons name="ellipsis-vertical" size={24} color={colors.white} />
        </TouchableOpacity>
      </View>

      {/* Messages List (inverted for bottom-up) */}
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
          <View style={styles.emptyContainer}>
            <Ionicons
              name="chatbubbles-outline"
              size={64}
              color={colors.gray300}
            />
            <Text style={styles.emptyText}>No messages yet</Text>
            <Text style={styles.emptySubtext}>
              Start the conversation by sending a message
            </Text>
          </View>
        }
      />

      {/* Message Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.white,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.primary,
  },
  backButton: {
    padding: 4,
    marginRight: 8,
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.white,
  },
  headerStatus: {
    fontSize: 12,
    color: colors.white,
    opacity: 0.8,
  },
  menuButton: {
    padding: 4,
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  messageContainer: {
    marginVertical: 4,
    maxWidth: "80%",
  },
  myMessageContainer: {
    alignSelf: "flex-end", // ? RIGHT side for my messages
  },
  theirMessageContainer: {
    alignSelf: "flex-start", // ? LEFT side for their messages
  },
  senderName: {
    fontSize: 12,
    color: colors.gray600,
    marginBottom: 4,
    marginLeft: 12,
    fontWeight: "500",
  },
  messageBubble: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    maxWidth: "100%",
  },
  messageSending: {
    opacity: 0.7, // Slightly faded while sending
  },
  messageFailed: {
    opacity: 0.5,
    borderWidth: 1,
    borderColor: '#FF5252',
  },
  myMessageBubble: {
    backgroundColor: colors.primary, // Blue background for my messages
    borderBottomRightRadius: 4,
  },
  theirMessageBubble: {
    backgroundColor: colors.gray200, // Gray background for their messages
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  messageTextFaded: {
    opacity: 0.8, // Slightly faded for sending messages
  },
  myMessageText: {
    color: colors.white,
  },
  theirMessageText: {
    color: colors.gray900,
  },
  messageFooter: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    justifyContent: "flex-end",
  },
  messageTime: {
    fontSize: 10, // ? Smaller font for time
    fontWeight: "400",
  },
  myMessageTime: {
    color: "rgba(255,255,255,0.7)", // ? Semi-transparent white
  },
  theirMessageTime: {
    color: colors.gray500, // ? Gray for their messages
  },
  readReceipt: {
    marginLeft: 3,
  },
  readReceiptContainer: {
    marginLeft: 3,
  },
  sendingIndicator: {
    width: 14,
    height: 14,
  },
  dateSeparator: {
    alignItems: "center",
    marginVertical: 16,
  },
  dateSeparatorText: {
    fontSize: 12,
    color: colors.gray500,
    backgroundColor: colors.gray100,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
  },
  input: {
    flex: 1,
    backgroundColor: colors.gray100,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 100,
    marginRight: 8,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    backgroundColor: colors.gray300,
  },
  loadingMore: {
    paddingVertical: 16,
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
    transform: [{ scaleY: -1 }], // Flip back since list is inverted
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.gray600,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.gray500,
    marginTop: 8,
    textAlign: "center",
    paddingHorizontal: 40,
  },
});
