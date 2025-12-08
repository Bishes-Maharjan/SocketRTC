import { useAuth } from "@/auth/AuthProvider";
import { useSocket } from "@/hooks/useSocket";
import { ChatRoom, Message } from "@/interfaces/allInterface";
import { getRoomMessageWithItsUnreadCount } from "@/lib/apis/chat.api";
import { formatMessageTime, getImage } from "@/lib/utils";
import { useChatStore } from "@/stores/useChatStore";
import { LoaderIcon, Video } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { MessageBubble } from "./MessageBubble";
import { TypingIndicator } from "./TypingIndicator";

export function ChatWindow({ chat }: { chat: ChatRoom }) {
  const { user } = useAuth();
  const router = useRouter();
  const { socket, joinRoom, leaveRoom, isConnected } = useSocket(); // Use shared socket
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const loadMoreObserverRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Zustand store
  const {
    getMessages,
    addMessage,
    addMessages,
    prependMessages,
    markMessagesAsRead,
    updateChatLastMessage,
    updateChatUnreadCount,
    setTyping,
    clearTyping,
    isTyping: checkIsTyping,
    loadingMessages,
    setLoadingMessages,
  } = useChatStore();

  const messages = getMessages(chat._id);
  const isLoading = loadingMessages[chat._id] ?? false;
  
  // Reactive typing indicator
  const typingUsers = useChatStore((state) => state.typingUsers);
  const typingSet = typingUsers[chat._id];
  const isTyping = typingSet && typingSet.size > 0
    ? Array.from(typingSet).some((userId) => userId !== user?._id)
    : false;

  // Load initial messages when chat changes
  useEffect(() => {
    if (!chat._id) return;

    setLoadingMessages(chat._id, true);
    setNewMessage("");
    setCurrentPage(1);
    setHasMore(true);

    // Check if we already have messages for this room
    const existingMessages = getMessages(chat._id);
    if (existingMessages.length > 0) {
      setLoadingMessages(chat._id, false);
      return;
    }

    // Load first page of messages
    getRoomMessageWithItsUnreadCount(chat._id, { limit: 20, page: 1 })
      .then((response) => {
        const { messages: fetchedMessages, hasMore: more, unreadCount } = response.data;
        
        // Messages come sorted newest first from API, but we want oldest first for display
        const sortedMessages = [...fetchedMessages].reverse();
        
        addMessages(chat._id, sortedMessages, 1, more);
        setHasMore(more);
        updateChatUnreadCount(chat._id, unreadCount);
        setLoadingMessages(chat._id, false);
      })
      .catch((error) => {
        console.error("Failed to load messages:", error);
        setLoadingMessages(chat._id, false);
      });
  }, [chat._id, addMessages, updateChatUnreadCount, setLoadingMessages, getMessages]);

  // Socket connection
  useEffect(() => {
    if(!socket || !isConnected || !chat._id) return ;
    const newSocket = socket

    // Join room - server will mark messages as read and emit 'messages-marked-read' event
    joinRoom(chat._id); 

    const handleReceiveMessage = (data: any) => {
      // Only handle messages for this specific chat room
      if (data.roomId !== chat._id) return;

      const newMsg: Message = {
        _id: data._id,
        sender: data.sender,
        to: data.to || user?._id || "",
        roomId: chat._id,
        message: data.message,
        isRead: data.isRead,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      };

      // Add message to store
      addMessage(chat._id, newMsg);
      
      // Update chat last message
      updateChatLastMessage(chat._id, newMsg);
      
      // If user is viewing this chat, mark as read and reset unread count
      updateChatUnreadCount(chat._id, 0);
    };

    const handleMessagesMarkedRead = (data: any) => {
      if (data.roomId === chat._id) {
        // Mark all messages as read in store
        markMessagesAsRead(chat._id, data.userId);
        
        // Update unread count
        if (data.userId === user?._id) {
          updateChatUnreadCount(chat._id, 0);
        }
      }
    };

    const handleUserTyping = (data: any) => {
      if (data.userId !== user?._id && data.roomId === chat._id) {
        setTyping(chat._id, data.userId, true);
      }
    };

    const handleUserStoppedTyping = (data: any) => {
      if (data.userId !== user?._id && data.roomId === chat._id) {
        clearTyping(chat._id, data.userId);
      }
    };

    const handleRejectCall = (data: any) => {
      // Check if the rejection is for us (we are the caller)
      if (data.to === user?._id && data.roomId === chat._id) {
        // Call was rejected by the recipient
        toast.error("Call rejected");
      }
    };

    newSocket.on("receive-message", handleReceiveMessage);
    newSocket.on("messages-marked-read", handleMessagesMarkedRead);
    newSocket.on("user-typing", handleUserTyping);
    newSocket.on("user-stopped-typing", handleUserStoppedTyping);
    newSocket.on("rejectCall", handleRejectCall);

    return () => {
      newSocket.off("receive-message", handleReceiveMessage);
      newSocket.off("messages-marked-read", handleMessagesMarkedRead);
      newSocket.off("user-typing", handleUserTyping);
      newSocket.off("user-stopped-typing", handleUserStoppedTyping);
      newSocket.off("rejectCall", handleRejectCall);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      leaveRoom(chat._id);
    };
      }, [chat._id, user?._id, updateChatLastMessage, updateChatUnreadCount, markMessagesAsRead, setTyping, clearTyping, addMessage, isConnected,socket ]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
    }
  }, [messages.length]);

  // Load more messages (pagination)
  const loadMoreMessages = async () => {
    if (!hasMore || isLoadingMore) return;

    setIsLoadingMore(true);
    const nextPage = currentPage + 1;

    try {
      const response = await getRoomMessageWithItsUnreadCount(chat._id, {
        limit: 20,
        page: nextPage,
      });

      const { messages: fetchedMessages, hasMore: more } = response.data;
      
      if (fetchedMessages.length > 0) {
        // Messages come sorted newest first, reverse for display
        const sortedMessages = [...fetchedMessages].reverse();
        
        // Prepend older messages
        prependMessages(chat._id, sortedMessages, more);
        setCurrentPage(nextPage);
        setHasMore(more);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error("Failed to load more messages:", error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Infinite scroll for loading old messages (scroll up)
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          const container = messagesContainerRef.current;
          const oldScrollHeight = container?.scrollHeight || 0;

          loadMoreMessages().then(() => {
            // Maintain scroll position after loading old messages
            setTimeout(() => {
              if (container) {
                const newScrollHeight = container.scrollHeight;
                container.scrollTop = newScrollHeight - oldScrollHeight;
              }
            }, 0);
          });
        }
      },
      { threshold: 0.8 }
    );

    const currentTarget = loadMoreObserverRef.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasMore, isLoadingMore]);

  // Find the most recent message sent by the current user that has been read
  const mostRecentReadMessage = messages
    .filter((msg) => msg.sender === user?._id && msg.isRead)
    .pop();

  const handleSendMessage = () => {
    if (!newMessage.trim() || !socket) return;

    const messageText = newMessage.trim();
    socket.emit("send-message", {
      roomId: chat._id,
      message: messageText,
    });
    setNewMessage("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
      // Stop typing when message is sent
      if (socket) {
        socket.emit("stop-typing", { roomId: chat._id });
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    }
  };

  const handleMessageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewMessage(value);

    // Emit typing event when user starts typing
    if (socket && value.trim().length > 0) {
      socket.emit("typing", { roomId: chat._id });
      
      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Stop typing after 2 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        if (socket) {
          socket.emit("stop-typing", { roomId: chat._id });
        }
      }, 2000);
    } else if (socket && value.trim().length === 0) {
      // Stop typing if input is cleared
      socket.emit("stop-typing", { roomId: chat._id });
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    }
  };

  const handleVideoCall = () => {
    if (!socket || !user?._id || !chat.members._id) return;

    const toUserId = chat.members._id;
    const fromUserId = user._id;

    // Emit call event
    socket.emit("call", {
      roomId: chat._id,
      to: toUserId,
      from: fromUserId,
    });

    // Navigate to video call page with initiator flag
    router.push(`/call/${chat._id}?initiator=true&recipient=${encodeURIComponent(chat.members.fullName)}`);
  };

  return (
    <>
      {/* Chat Header */}
      <div className="p-4 bg-base-100 border-b border-base-300 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative w-10 h-10 rounded-full overflow-hidden">
            {chat.members.image ? (
              <Image
                src={getImage(chat.members.image)}
                alt={chat.members.fullName}
                fill
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full bg-primary flex items-center justify-center text-primary-content font-semibold">
                {chat.members.fullName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <h2 className="font-semibold text-base-content">
              {chat.members.fullName}
            </h2>
            <p className="text-xs text-base-content/60">
              {chat.members.location}
            </p>
          </div>
        </div>
        <button
          onClick={handleVideoCall}
          className="btn btn-circle btn-primary btn-sm"
          title="Start video call"
        >
          <Video className="size-5" />
        </button>
      </div>

      {/* Messages Area */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 bg-base-200"
      >
        {/* Load More Observer */}
        <div ref={loadMoreObserverRef} className="py-2 text-center">
          {isLoadingMore && (
            <div className="text-xs text-base-content/60">Loading more...</div>
          )}
          {!hasMore && messages.length > 0 && (
            <div className="text-xs text-base-content/40">No more messages</div>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <LoaderIcon className="animate-spin size-10 text-primary" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-base-content/60">
              <p>No messages yet</p>
              <p className="text-sm mt-2">Start the conversation!</p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message, index) => (
              <div key={message._id || index}>
                <MessageBubble
                  message={message}
                  isOwn={message.sender === user?._id}
                />
                {mostRecentReadMessage && message._id === mostRecentReadMessage._id && (
                  <div className={`text-xs text-base-content/60 ${message.sender === user?._id ? "text-end" : "text-start"}`}>
                    seen, {formatMessageTime(message.updatedAt || message.createdAt)}
                  </div>
                )}
              </div>
            ))}
            {isTyping && (
              <div className="flex mb-4 justify-start">
                <div className="max-w-xs lg:max-w-md px-4 py-2 rounded-lg bg-base-100 text-base-content rounded-bl-none shadow-sm border border-base-300">
                  <TypingIndicator
                    label={`${chat.members.fullName} is typing`}
                    containerClassName="text-base-content/60"
                  />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Message Input */}
      <div className="p-4 bg-base-100 border-t border-base-300 flex-shrink-0">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={handleMessageChange}
            onKeyDown={handleKeyPress}
            placeholder="Type a message..."
            className="flex-1 input input-bordered focus:input-primary"
          />
          <button
            onClick={handleSendMessage}
            disabled={!newMessage.trim()}
            className="btn btn-primary"
          >
            Send
          </button>
        </div>
      </div>
    </>
  );
}
