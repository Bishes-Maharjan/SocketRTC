"use client";
import { useAuth } from "@/auth/AuthProvider";
import { ChatRoomCard } from "@/components/Chat/ChatRoomCard";
import { ChatWindow } from "@/components/Chat/ChatWindow";
import { ChatRoom, Message } from "@/interfaces/allInterface";
import { getAllChats } from "@/lib/apis/chat.api";
import { useChatStore } from "@/stores/useChatStore";
import { useRouter } from "next/navigation";
import React from "react";
import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import toast, { Toaster } from "react-hot-toast";

export default function ChatsPage({ searchParams }: { searchParams: Promise<{ chatId: string }> }) {
  const { user } = useAuth();
  const router = useRouter();
  const [selectedChat, setSelectedChat] = useState<ChatRoom | null>(null);
  const { chatId } = React.use(searchParams);
  const observerTarget = useRef<HTMLDivElement>(null);
  const globalSocketRef = useRef<Socket | null>(null);
  const selectedChatRef = useRef<ChatRoom | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Zustand store
  const {
    chats,
    chatsHasMore,
    loadingChats,
    setChats,
    addChats,
    addMessage,
    updateChatLastMessage,
    updateChatUnreadCount,
    updateChat,
    setTyping,
    clearTyping,
    setLoadingChats,
    getChat,
  } = useChatStore();

  // Load initial chats
  useEffect(() => {
    if (!user?._id) return;

    setLoadingChats(true);
    getAllChats({ limit: 20, page: 1 })
      .then((response) => {
        const { chats: fetchedChats, hasMore } = response.data;
        setChats(fetchedChats, hasMore, 1);
        setCurrentPage(1);
        setLoadingChats(false);
      })
      .catch((error) => {
        console.error("Failed to load chats:", error);
        setLoadingChats(false);
      });
  }, [user?._id, setChats, setLoadingChats]);

  // Global socket connection to listen to messages for chat list updates
  // This socket connects to user's personal room (automatically joined on connection)
  // It does NOT join chat rooms - only ChatWindow joins chat rooms
  useEffect(() => {
    if (!user?._id) return;

    const socket = io("http://localhost:3001", {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    globalSocketRef.current = socket;

    socket.on("connect", () => {
      console.log("Global socket connected for chat list updates");
      // User is automatically joined to their personal room on backend connection
      // No need to join chat rooms here - only ChatWindow joins chat rooms
    });

    // Handle receiving messages for any room (via user's personal room)
    const handleReceiveMessage = (data: any) => {
      const newMsg: Message = {
        _id: data._id,
        sender: data.sender,
        to: data.to || user?._id || "",
        roomId: data.roomId,
        message: data.message,
        isRead: data.isRead,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      };

      // Add message to store only if not currently viewing this room
      const isCurrentlyViewing = selectedChatRef.current?._id === data.roomId;
      if (!isCurrentlyViewing) {
        addMessage(data.roomId, newMsg);
      }

      // Update chat last message
      updateChatLastMessage(data.roomId, newMsg);

      // Update unread count:
      // - Don't increment if message is from current user
      // - Don't increment if message is already read (user is viewing the chat)
      // - Increment if message is not from current user and not read
      const isFromCurrentUser = newMsg.sender === user?._id;
      const isCurrentlyViewingAfterAdd = selectedChatRef.current?._id === data.roomId;
      
      if (!isFromCurrentUser && !newMsg.isRead && !isCurrentlyViewingAfterAdd) {
        // Get current unread count and increment
        const chat = getChat(data.roomId);
        const currentUnread = chat?.unreadCount || 0;
        updateChatUnreadCount(data.roomId, currentUnread + 1);
      } else if (isFromCurrentUser || isCurrentlyViewingAfterAdd) {
        // Reset unread count if viewing or if it's our own message
        updateChatUnreadCount(data.roomId, 0);
      }
    };

    // Handle messages marked as read
    const handleMessagesMarkedRead = (data: any) => {
      if (data.userId !== user?._id) {
        // Another user read messages - reset unread count
        updateChatUnreadCount(data.roomId, 0);
      }
    };

    const handleUserTyping = (data: any) => {
      if (data.userId !== user?._id && data.roomId) {
        setTyping(data.roomId, data.userId, true);
      }
    };

    const handleUserStoppedTyping = (data: any) => {
      if (data.userId !== user?._id && data.roomId) {
        clearTyping(data.roomId, data.userId);
      }
    };

    const handleCalling = (data: any) => {
      // Check if the call is for us
      if (data.to === user?._id) {
        const chatPartner = chats.find((c: ChatRoom) => c._id === data.roomId);
        const callerName = chatPartner?.members.fullName || "Someone";

        // Show toast with pickup and reject buttons
        toast(
          (t) => (
            <div className="flex flex-col gap-2">
              <p className="font-semibold">{callerName} is calling you</p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    toast.dismiss(t.id);
                    // Navigate to video call page
                    router.push(`/call/${data.roomId}`);
                  }}
                  className="btn btn-primary btn-sm"
                >
                  Pick Up
                </button>
                <button
                  onClick={() => {
                    toast.dismiss(t.id);
                    // Send reject call
                    if (globalSocketRef.current) {
                      globalSocketRef.current.emit("rejectCall", {
                        to: data.from,
                        from: user?._id,
                        roomId: data.roomId,
                      });
                    }
                  }}
                  className="btn btn-error btn-sm"
                >
                  Reject
                </button>
              </div>
            </div>
          ),
          {
            duration: 30000, // 30 seconds
            position: "top-center",
            style: {
              background: "hsl(var(--b1))",
              color: "hsl(var(--bc))",
              padding: "16px",
              borderRadius: "8px",
            },
          }
        );
      }
    };

    const handleRejectCall = (data: any) => {
      // Check if the rejection is for us (we are the caller)
      if (data.to === user?._id) {
        toast.error("Call denied", {
          position: "top-center",
        });
        // Leave the video call room if we're on the call page
        // The VideoPage component will handle cleanup
      }
    };

    socket.on("receive-message", handleReceiveMessage);
    socket.on("messages-marked-read", handleMessagesMarkedRead);
    socket.on("user-typing", handleUserTyping);
    socket.on("user-stopped-typing", handleUserStoppedTyping);
    socket.on("calling", handleCalling);
    socket.on("rejectCall", handleRejectCall);

    return () => {
      socket.off("receive-message", handleReceiveMessage);
      socket.off("messages-marked-read", handleMessagesMarkedRead);
      socket.off("user-typing", handleUserTyping);
      socket.off("user-stopped-typing", handleUserStoppedTyping);
      socket.off("calling", handleCalling);
      socket.off("rejectCall", handleRejectCall);
      socket.disconnect();
      globalSocketRef.current = null;
    };
  }, [user?._id, addMessage, updateChatLastMessage, updateChatUnreadCount, setTyping, clearTyping, getChat, chats, router]);

  // Keep selectedChatRef in sync with selectedChat state
  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  // Initialize and update selectedChat from URL chatId when chats are loaded or chatId changes
  useEffect(() => {
    if (chatId && chats.length > 0) {
      const chatFromUrl = chats.find((c: ChatRoom) => c._id === chatId);
      if (chatFromUrl && selectedChat?._id !== chatId) {
        setSelectedChat(chatFromUrl);
      }
    } else if (!chatId && selectedChat) {
      // Clear selection if chatId is removed from URL
      setSelectedChat(null);
    }
  }, [chatId, chats, selectedChat]);

  // Load more chats (pagination)
  const loadMoreChats = async () => {
    if (!chatsHasMore || isLoadingMore) return;

    setIsLoadingMore(true);
    const nextPage = currentPage + 1;

    try {
      const response = await getAllChats({ limit: 20, page: nextPage });
      const { chats: fetchedChats, hasMore } = response.data;
      
      if (fetchedChats.length > 0) {
        addChats(fetchedChats, hasMore, nextPage);
        setCurrentPage(nextPage);
      }
    } catch (error) {
      console.error("Failed to load more chats:", error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Infinite scroll for loading more chats
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && chatsHasMore && !isLoadingMore) {
          loadMoreChats();
        }
      },
      {
        threshold: 0.1,
        rootMargin: "100px",
      }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [chatsHasMore, isLoadingMore]);

  // Get typing status for chats - reactive
  const typingUsers = useChatStore((state) => state.typingUsers);
  
  const isChatTyping = (roomId: string) => {
    const typingSet = typingUsers[roomId];
    if (!typingSet || typingSet.size === 0) return false;
    return Array.from(typingSet).some((userId) => userId !== user?._id);
  };

  return (
    <>
      <Toaster />
      <div className="flex h-[calc(100vh-4rem)] bg-base-200">
        <div className="w-96 bg-base-100 border-r border-base-300 flex flex-col">

        {/* Header */}
        <div className="p-4 bg-base-200 border-b border-base-300">
          <h1 className="text-xl font-semibold text-base-content">Chats</h1>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto">
          {loadingChats ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-base-content/60">Loading chats...</div>
            </div>
          ) : chats.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-base-content/60">
                <p>No chats yet</p>
                <p className="text-sm mt-2">Start a conversation!</p>
              </div>
            </div>
          ) : (
            <>
              {chats.map((chat) => (
                <ChatRoomCard
                  key={chat._id}
                  chat={chat}
                  us={user?._id || ""}
                  isSelected={selectedChat?._id === chat._id || chatId === chat._id}
                  isTyping={isChatTyping(chat._id)}
                  onClick={() => {
                    // Get latest chat from store
                    const latestChat = getChat(chat._id) || chat;
                    setSelectedChat(latestChat);
                    // Update URL with chatId
                    router.push(`/chat?chatId=${chat._id}`);
                  }}
                />
              ))}
              <div ref={observerTarget} className="py-4 text-center">
                {isLoadingMore && (
                  <div className="text-base-content/60 text-sm">
                    Loading more...
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
  

      {/* Right Panel - Chat Window */}
      <div className="flex-1 flex flex-col">
        {selectedChat ? (
          <ChatWindow chat={selectedChat} />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-base-200">
            <div className="text-center">
              <div className="text-6xl mb-4">💬</div>
              <h2 className="text-2xl font-semibold text-base-content mb-2">
                Choose a chat
              </h2>
              <p className="text-base-content/60">
                Select a conversation from the left to start messaging
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
