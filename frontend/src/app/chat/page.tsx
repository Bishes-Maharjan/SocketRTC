"use client";
import { useAuth } from "@/auth/AuthProvider";
import { ChatRoomCard } from "@/components/Chat/ChatRoomCard";
import { ChatWindow } from "@/components/Chat/ChatWindow";
import { ChatRoom, ChatsResponse, Message } from "@/interfaces/allInterface";
import { getAllChats } from "@/lib/apis/chat.api";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

export default function ChatsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedChat, setSelectedChat] = useState<ChatRoom | null>(null);
  const observerTarget = useRef<HTMLDivElement>(null);
  const globalSocketRef = useRef<Socket | null>(null);
  const joinedRoomsRef = useRef<Set<string>>(new Set());

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

  // Global WebSocket connection - create once
  useEffect(() => {
    if (!user?._id) return;

    const globalSocket = io("http://localhost:3001", {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    globalSocketRef.current = globalSocket;

    globalSocket.on("connect", () => {
      console.log("Global socket connected for chat list updates");
      // Rooms will be joined by the separate effect when data is available
    });

    return () => {
      globalSocket.disconnect();
      globalSocketRef.current = null;
      joinedRoomsRef.current.clear();
    };
  }, [user?._id]);

  // Join new rooms when data changes
  useEffect(() => {
    if (!data || !globalSocketRef.current?.connected) return;

    const allChats = data.pages.flatMap((page) => page.data.chats);
    allChats.forEach((chat) => {
      if (!joinedRoomsRef.current.has(chat._id)) {
        globalSocketRef.current?.emit("join-room", { roomId: chat._id });
        joinedRoomsRef.current.add(chat._id);
      }
    });
  }, [data]);

  // Set up message handlers
  useEffect(() => {
    if (!user?._id || !globalSocketRef.current) return;

    const globalSocket = globalSocketRef.current;

    // Listen for messages in any room
    const handleReceiveMessage = (data: any) => {
      const newMsg: Message = {
        _id: data._id,
        sender: data.sender,
        to: user._id,
        roomId: data.roomId,
        message: data.message,
        isRead: data.isRead,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      };

      const isCurrentUserSender = newMsg.sender === user._id;
      const isUserViewingThisRoom = selectedChat?._id === newMsg.roomId;

      // Update the messages query cache for this room
      queryClient.setQueryData(["messages", newMsg.roomId], (oldData: any) => {
        if (!oldData || !newMsg._id) return oldData;

        const existingMessageIds = new Set(
          oldData.pages.flatMap((page: any) =>
            page.data.messages
              .map((m: Message) => m._id)
              .filter((id: string) => id) // Filter out undefined/null IDs
          )
        );

        // Don't add duplicate messages
        if (existingMessageIds.has(newMsg._id)) {
          return oldData;
        }

        // Add new message to the first page (most recent messages)
        return {
          ...oldData,
          pages: oldData.pages.map((page: any, index: number) => {
            if (index === 0) {
              // Double-check this page doesn't already have the message
              const pageMessageIds = new Set(
                page.data.messages
                  .map((m: Message) => m._id)
                  .filter((id: string) => id)
              );
              if (pageMessageIds.has(newMsg._id)) {
                return page; // Already exists in this page
              }
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
      });

      // Update the chat list cache
      queryClient.setQueryData(["chats", user._id], (oldData: any) => {
        if (!oldData) return oldData;

        return {
          ...oldData,
          pages: oldData.pages.map((page: any) => ({
            ...page,
            data: {
              ...page.data,
              chats: page.data.chats.map((c: ChatRoom) => {
                if (c._id === newMsg.roomId) {
                  // Update the chat with new message
                  const existingMessageIds = new Set(
                    (c.messages || []).map((m: Message) => m._id)
                  );

                  // Don't add duplicate messages
                  if (existingMessageIds.has(newMsg._id)) {
                    return c;
                  }

                  const updatedChat: ChatRoom = {
                    ...c,
                    messages: [newMsg, ...(c.messages || [])].slice(0, 1), // Keep only latest message
                    // Track unread count locally: increment if not sender and not viewing this room
                    // Note: Backend marks as read when joining room, but we track locally based on view state
                    unreadCount:
                      isCurrentUserSender || isUserViewingThisRoom
                        ? 0
                        : (c.unreadCount || 0) + 1,
                  };
                  return updatedChat;
                }
                return c;
              }),
            },
          })),
        };
      });

      // Update selectedChat if it's the current room
      if (selectedChat?._id === newMsg.roomId) {
        setSelectedChat((prev) => {
          if (!prev) return prev;
          const existingIds = new Set(prev.messages?.map((m) => m._id) || []);
          if (existingIds.has(newMsg._id)) return prev;
          return {
            ...prev,
            messages: [newMsg, ...(prev.messages || [])],
            unreadCount: 0,
          };
        });
      }
    };

    // Listen for messages marked as read
    const handleMessagesMarkedRead = (data: any) => {
      // Only update if the current user marked messages as read AND they're viewing the room
      // This prevents resetting unread counts when global socket joins rooms
      if (data.userId === user._id && selectedChat?._id === data.roomId) {
        queryClient.setQueryData(["chats", user._id], (oldData: any) => {
          if (!oldData) return oldData;

          return {
            ...oldData,
            pages: oldData.pages.map((page: any) => ({
              ...page,
              data: {
                ...page.data,
                chats: page.data.chats.map((c: ChatRoom) =>
                  c._id === data.roomId
                    ? {
                        ...c,
                        // Update messages to mark them as read
                        messages: c.messages.map((msg) =>
                          msg.sender !== user._id ? { ...msg, isRead: true } : msg
                        ),
                        unreadCount: 0, // Reset unread count when user views the room
                      }
                    : c
                ),
              },
            })),
          };
        });

        // Update messages query cache to mark messages as read
        queryClient.setQueryData(["messages", data.roomId], (oldData: any) => {
          if (!oldData) return oldData;

          return {
            ...oldData,
            pages: oldData.pages.map((page: any) => ({
              ...page,
              data: {
                ...page.data,
                messages: page.data.messages.map((msg: Message) =>
                  msg.sender !== user._id ? { ...msg, isRead: true } : msg
                ),
              },
            })),
          };
        });

        // Update selectedChat
        setSelectedChat((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            unreadCount: 0,
            messages: prev.messages.map((msg) =>
              msg.sender !== user._id ? { ...msg, isRead: true } : msg
            ),
          };
        });
      }
    };

    globalSocket.on("receive-message", handleReceiveMessage);
    globalSocket.on("messages-marked-read", handleMessagesMarkedRead);

    return () => {
      globalSocket.off("receive-message", handleReceiveMessage);
      globalSocket.off("messages-marked-read", handleMessagesMarkedRead);
    };
  }, [user?._id, queryClient, selectedChat?._id]);
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

  // Keep selectedChat in sync with cache updates
  useEffect(() => {
    if (selectedChat && allChats.length > 0) {
      const updatedChat = allChats.find((c) => c._id === selectedChat._id);
      if (updatedChat) {
        setSelectedChat(updatedChat);
      }
    }
  }, [allChats, selectedChat?._id]);

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
                  onClick={() => {
                    setSelectedChat(chat);
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
