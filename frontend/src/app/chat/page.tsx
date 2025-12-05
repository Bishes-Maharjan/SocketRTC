"use client";
import { useAuth } from "@/auth/AuthProvider";
import { ChatRoomCard } from "@/components/Chat/ChatRoomCard";
import { ChatWindow } from "@/components/Chat/ChatWindow";
import { ChatRoom, ChatsResponse, Message, MessagesResponse } from "@/interfaces/allInterface";
import { getAllChats } from "@/lib/apis/chat.api";
import {
  InfiniteData,
  useInfiniteQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

export default function ChatsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedChat, setSelectedChat] = useState<ChatRoom | null>(null);
  const [typingRooms, setTypingRooms] = useState<Set<string>>(new Set());
  const typingTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const observerTarget = useRef<HTMLDivElement>(null);
  const globalSocketRef = useRef<Socket | null>(null);
  const selectedChatRef = useRef<ChatRoom | null>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery({
      queryKey: ["chats", user?._id],
      queryFn: ({ pageParam = 1 }) =>
        getAllChats({ limit: 20, page: pageParam }),
      getNextPageParam: (lastPage: ChatsResponse, allPages) => {
        if (lastPage.data.hasMore) {
          return allPages.length + 1;
        }
        return undefined;
      },
      enabled: !!user?._id,
      initialPageParam: 1,
    });

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

      // Update cache for chats list
      queryClient.setQueryData(
        ["chats", user?._id],
        (
          oldData: InfiniteData<ChatsResponse> | undefined
        ): InfiniteData<ChatsResponse> | undefined => {
          if (!oldData) return oldData;

          return {
            ...oldData,
            pages: oldData.pages.map((page) => ({
              ...page,
              data: {
                ...page.data,
                chats: page.data.chats.map((c: ChatRoom) => {
                  if (c._id === data.roomId) {
                    // Update the chat with new message
                    const existingMessages = c.messages || [];
                    // Check if message already exists (avoid duplicates)
                    const messageExists = existingMessages.some(
                      (m) => m._id === newMsg._id
                    );

                    if (messageExists) return c;

                    // Add new message at the beginning (most recent)
                    const updatedMessages = [newMsg, ...existingMessages];

                    // Update unread count:
                    // - Don't increment if message is from current user
                    // - Don't increment if message is already read (user is viewing the chat)
                    // - Increment if message is not from current user and not read
                    const isFromCurrentUser = newMsg.sender === user?._id;
                    // Use ref to get latest selectedChat without causing re-renders
                    const isCurrentlyViewing = selectedChatRef.current?._id === data.roomId;
                    const newUnreadCount =
                      !isFromCurrentUser && !newMsg.isRead && !isCurrentlyViewing
                        ? (c.unreadCount || 0) + 1
                        : c.unreadCount || 0;

                    return {
                      ...c,
                      messages: updatedMessages.slice(0, 1), // Keep only the most recent message
                      unreadCount: newUnreadCount,
                    };
                  }
                  return c;
                }),
              },
            })),
          };
        }
      );

      // ✅ Also update the messages cache for this room so messages are available when switching to it
      queryClient.setQueryData(
        ["messages", data.roomId],
        (
          oldData: InfiniteData<MessagesResponse> | undefined
        ): InfiniteData<MessagesResponse> | undefined => {
          // If cache doesn't exist yet, don't create it (let it be fetched when room is opened)
          if (!oldData) return oldData;

          // Check if message already exists in any page
          const messageExists = oldData.pages.some((page) =>
            page.data.messages.some((m) => m._id === newMsg._id)
          );

          if (messageExists) return oldData;

          // Add message to the first page (most recent messages)
          // Since messages are sorted newest first in the API, add to the beginning of the first page
          return {
            ...oldData,
            pages: oldData.pages.map((page, pageIndex) => {
              if (pageIndex === 0) {
                // Add to first page (most recent messages)
                return {
                  ...page,
                  data: {
                    ...page.data,
                    messages: [newMsg, ...page.data.messages],
                  },
                };
              }
              return page;
            }),
          };
        }
      );
    };

    // Handle messages marked as read
    const handleMessagesMarkedRead = (data: any) => {
      queryClient.setQueryData(
        ["chats", user?._id],
        (
          oldData: InfiniteData<ChatsResponse> | undefined
        ): InfiniteData<ChatsResponse> | undefined => {
          if (!oldData) return oldData;

          return {
            ...oldData,
            pages: oldData.pages.map((page) => ({
              ...page,
              data: {
                ...page.data,
                chats: page.data.chats.map((c: ChatRoom) =>
                  c._id === data.roomId && data.userId !== user?._id
                    ? { ...c, unreadCount: 0 }
                    : c
                ),
              },
            })),
          };
        }
      );
    };

    const handleUserTyping = (data: any) => {
      // Only show typing if it's not from current user
      if (data.userId !== user?._id && data.roomId) {
        setTypingRooms((prev) => new Set(prev).add(data.roomId));
        
        // Clear existing timeout for this room
        const existingTimeout = typingTimeoutsRef.current.get(data.roomId);
        if (existingTimeout) {
          clearTimeout(existingTimeout);
        }
        
        // Auto-clear typing indicator after 3 seconds
        const timeout = setTimeout(() => {
          setTypingRooms((prev) => {
            const newSet = new Set(prev);
            newSet.delete(data.roomId);
            return newSet;
          });
          typingTimeoutsRef.current.delete(data.roomId);
        }, 3000);
        
        typingTimeoutsRef.current.set(data.roomId, timeout);
      }
    };

    const handleUserStoppedTyping = (data: any) => {
      if (data.userId !== user?._id && data.roomId) {
        setTypingRooms((prev) => {
          const newSet = new Set(prev);
          newSet.delete(data.roomId);
          return newSet;
        });
        
        const timeout = typingTimeoutsRef.current.get(data.roomId);
        if (timeout) {
          clearTimeout(timeout);
          typingTimeoutsRef.current.delete(data.roomId);
        }
      }
    };

    socket.on("receive-message", handleReceiveMessage);
    socket.on("messages-marked-read", handleMessagesMarkedRead);
    socket.on("user-typing", handleUserTyping);
    socket.on("user-stopped-typing", handleUserStoppedTyping);

    return () => {
      socket.off("receive-message", handleReceiveMessage);
      socket.off("messages-marked-read", handleMessagesMarkedRead);
      socket.off("user-typing", handleUserTyping);
      socket.off("user-stopped-typing", handleUserStoppedTyping);
      socket.disconnect();
      globalSocketRef.current = null;
      // Clear all typing timeouts
      typingTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
      typingTimeoutsRef.current.clear();
    };
  }, [user?._id, queryClient]);

  // Keep selectedChatRef in sync with selectedChat state
  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
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
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const allChats = data?.pages.flatMap((page) => page.data.chats) || [];
  return (
    <div className="flex h-[calc(100vh-4rem)] bg-base-200">
      {/* Left Sidebar - Chat List */}
      <div className="w-96 bg-base-100 border-r border-base-300 flex flex-col">
        {/* Header */}
        <div className="p-4 bg-base-200 border-b border-base-300">
          <h1 className="text-xl font-semibold text-base-content">Chats</h1>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-base-content/60">Loading chats...</div>
            </div>
          ) : allChats.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-base-content/60">
                <p>No chats yet</p>
                <p className="text-sm mt-2">Start a conversation!</p>
              </div>
            </div>
          ) : (
            <>
              {allChats.map((chat) => (
                <ChatRoomCard
                  key={chat._id}
                  chat={chat}
                  us={user?._id || ""}
                  isSelected={selectedChat?._id === chat._id}
                  isTyping={typingRooms.has(chat._id)}
                  onClick={() => {
                    // Update selected chat and ensure it's the latest from cache
                    const cachedChats = queryClient.getQueryData<
                      InfiniteData<ChatsResponse>
                    >(["chats", user?._id]);
                    const latestChat = cachedChats?.pages
                      .flatMap((page) => page.data.chats)
                      .find((c: ChatRoom) => c._id === chat._id);
                    setSelectedChat(latestChat || chat);
                  }}
                />
              ))}
              <div ref={observerTarget} className="py-4 text-center">
                {isFetchingNextPage && (
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
  );
}
