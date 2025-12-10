"use client";
import { useAuth } from "@/auth/AuthProvider";
import { ChatRoomCard } from "@/components/Chat/ChatRoomCard";
import { ChatWindow } from "@/components/Chat/ChatWindow";
import { useSocket } from "@/hooks/useSocket";
import { ChatRoom, Message } from "@/interfaces/allInterface";
import { getAllChats } from "@/lib/apis/chat.api";
import { useChatStore } from "@/stores/useChatStore";
import { useRouter } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { Socket } from "socket.io-client";

export default function ChatsPage({ searchParams }: { searchParams: Promise<{ chatId: string }> }) {
  const { user } = useAuth();
  const router = useRouter();
  const { chatId } = React.use(searchParams);
  // Derive selected chat from URL and store
  
  const observerTarget = useRef<HTMLDivElement>(null);
  const globalSocketRef = useRef<Socket | null>(null);
  const selectedChatRef = useRef<ChatRoom | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const { socket, isConnected } = useSocket(); // Use shared socket
  
  // Zustand store
  const {
    chats,
    chatsHasMore,
    loadingChats,
    setChats,
    addChats,
    setLoadingChats,
    setCurrentRoomId,
  } = useChatStore();

  // Update current room in store whenever URL changes
  useEffect(() => {
    setCurrentRoomId(chatId || null);
  }, [chatId, setCurrentRoomId]);
  
  const selectedChat = React.useMemo(() => {
    return chats.find((c) => c._id === chatId) || null;
  }, [chats, chatId]);
  
  // Load initial chats
  useEffect(() => {
    if (!user?._id) return;

    if (!user?._id) return;

    // Don't refetch if we already have chats (prevents spinner on navigation)
    if (chats.length > 0) {
      setLoadingChats(false); // Ensure loading is false
      return;
    }

    setLoadingChats(true);
    getAllChats({ limit: 20, page: 1 }) // server side func, loading chat window with latest msg and unread count for initial load
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

    if (!socket || !user?._id || !isConnected) return;


    globalSocketRef.current = socket;

    // Handle receiving messages for any room (via user's personal room)
    const handleReceiveMessage = (data: Message) => {
      // Get fresh state avoiding closure staleness
      const { currentRoomId, addMessage, updateChatLastMessage, updateChatUnreadCount, getChat } = useChatStore.getState();

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
      // We check against the store's currentRoomId which is synced with URL
      const isCurrentlyViewing = currentRoomId === data.roomId;
      
      if (!isCurrentlyViewing) {
        addMessage(data.roomId, newMsg);
      }

      // Update chat last message
      updateChatLastMessage(data.roomId, newMsg);

      // Update unread count logic
      const isFromCurrentUser = newMsg.sender === user?._id;
      
      if (!isFromCurrentUser && !newMsg.isRead) {
        // Message is FOR us and we haven't read it
        const chat = getChat(data.roomId);
        const currentUnread = chat?.unreadCount || 0;
        updateChatUnreadCount(data.roomId, currentUnread + 1);
      } else if (isFromCurrentUser) {
        updateChatUnreadCount(data.roomId, 0);
      } else if (newMsg.isRead && isCurrentlyViewing) {
        updateChatUnreadCount(data.roomId, 0);
      }
    };

    // Handle messages marked as read
    const handleMessagesMarkedRead = (data: {userId: string; roomId: string}) => {
      if (data.userId !== user?._id) {
        useChatStore.getState().updateChatUnreadCount(data.roomId, 0);
      }
    };

    const handleUserTyping = (data: {userId: string; roomId: string}) => {
      if (data.userId !== user?._id && data.roomId) {
        useChatStore.getState().setTyping(data.roomId, data.userId, true);
      }
    };

    const handleUserStoppedTyping = (data: {userId: string; roomId: string}) => {
      if (data.userId !== user?._id && data.roomId) {
        const store = useChatStore.getState();
        store.setTyping(data.roomId, data.userId, false);
        store.clearTyping(data.roomId, data.userId);
      }
    };

    // Note: 'calling' event is now handled globally in root-client-layout.tsx

    const handleRejectCall = (data: {to: string}) => {
      if (data.to === user?._id) {
        toast.error("Call denied", { position: "top-center" });
      }
    };

    socket.on("receive-message", handleReceiveMessage);
    socket.on("messages-marked-read", handleMessagesMarkedRead);
    socket.on("user-typing", handleUserTyping);
    socket.on("user-stopped-typing", handleUserStoppedTyping);
    socket.on("rejectCall", handleRejectCall);

    return () => {
      socket.off("receive-message", handleReceiveMessage);
      socket.off("messages-marked-read", handleMessagesMarkedRead);
      socket.off("user-typing", handleUserTyping);
      socket.off("user-stopped-typing", handleUserStoppedTyping);
      socket.off("rejectCall", handleRejectCall);
      globalSocketRef.current = null;
    };
  }, [user?._id, socket, isConnected]); 

  // Keep selectedChatRef in sync with selectedChat state for socket handlers
  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

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
    const isTyping = typingSet && typingSet.size > 0
    ? Array.from(typingSet).some((userId) => userId !== user?._id)
    : false;
    return isTyping;
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
                    // Update URL with chatId - this will update selectedChat via derivation
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
