import { useAuth } from "@/auth/AuthProvider";
import {
  ChatRoom,
  ChatsResponse,
  Message,
  MessagesResponse,
} from "@/interfaces/allInterface";
import { getRoomMessageWithItsUnreadCount } from "@/lib/apis/chat.api";
import { formatMessageTime, getImage } from "@/lib/utils";
import { InfiniteData, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { MessageBubble } from "./MessageBubble";
import { TypingIndicator } from "./TypingIndicator";
import { LoaderIcon, LoaderPinwheel } from "lucide-react";

export function ChatWindow({ chat }: { chat: ChatRoom }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const loadMoreObserverRef = useRef<HTMLDivElement>(null);
  const [realtimeMessages, setRealtimeMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const queryClient = useQueryClient();

  const {
    data: messagesData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ["messages", chat._id],
    queryFn: ({ pageParam = 1 }) =>
      getRoomMessageWithItsUnreadCount(chat._id, {
        limit: 8,
        page: pageParam,
      }),
    getNextPageParam: (lastPage: MessagesResponse, allPages) => {
      if (lastPage.data.hasMore) {
        return allPages.length + 1;
      }
      return undefined;
    },
    enabled: !!chat._id,
    initialPageParam: 1,
  });

  // Reset realtime messages when chat changes
  useEffect(() => {
    setRealtimeMessages([]);
    setNewMessage("");
    setIsTyping(false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    // ✅ Check messages cache and chat list cache for any messages that might need to be synced
    // This handles the case where a message was received/sent while viewing another room
    const messagesCache = queryClient.getQueryData<InfiniteData<MessagesResponse>>([
      "messages",
      chat._id,
    ]);
    
    const chatsCache = queryClient.getQueryData<InfiniteData<ChatsResponse>>([
      "chats",
      user?._id,
    ]);
    
    if (chatsCache) {
      const chatFromList = chatsCache.pages
        .flatMap((page) => page.data.chats)
        .find((c: ChatRoom) => c._id === chat._id);

      if (chatFromList?.messages && chatFromList.messages.length > 0) {
        const lastMessage = chatFromList.messages[0];
        
        // Check if this message is already in the messages cache
        const messageInCache = messagesCache?.pages.some((page) =>
          page.data.messages.some((m) => m._id === lastMessage._id)
        );

        // If message is not in messages cache but cache exists, add it to cache
        if (!messageInCache && messagesCache && lastMessage) {
          queryClient.setQueryData(
            ["messages", chat._id],
            (oldData: InfiniteData<MessagesResponse> | undefined): InfiniteData<MessagesResponse> | undefined => {
              if (!oldData) return oldData;
              
              return {
                ...oldData,
                pages: oldData.pages.map((page, pageIndex) => {
                  if (pageIndex === 0) {
                    return {
                      ...page,
                      data: {
                        ...page.data,
                        messages: [lastMessage, ...page.data.messages],
                      },
                    };
                  }
                  return page;
                }),
              };
            }
          );
        }
      }
    }
  }, [chat._id, user?._id, queryClient]);

  // Socket connection
  // In ChatWindow.tsx, update the socket connection effect:

  useEffect(() => {
    const newSocket = io("http://localhost:3001", {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    newSocket.on("connect", () => {
      console.log("ChatWindow socket connected");
      // Join active room (server will mark messages as read on join)
      newSocket.emit("join-room", { roomId: chat._id });

      // ✅ Immediately update cache when joining room - reset unread count
      queryClient.setQueryData(
        ["chats", user?._id],
        (oldData: InfiniteData<ChatsResponse> | undefined): InfiniteData<ChatsResponse> | undefined => {
          if (!oldData) return oldData;

          return {
            ...oldData,
            pages: oldData.pages.map((page) => ({
              ...page,
              data: {
                ...page.data,
                chats: page.data.chats.map((c: ChatRoom) =>
                  c._id === chat._id ? { ...c, unreadCount: 0 } : c
                ),
              },
            })),
          };
        }
      );
    });

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

      // ✅ Update the chat list cache with new message
      queryClient.setQueryData(
        ["chats", user?._id],
        (oldData: InfiniteData<ChatsResponse> | undefined): InfiniteData<ChatsResponse> | undefined => {
          if (!oldData) return oldData;

          return {
            ...oldData,
            pages: oldData.pages.map((page) => ({
              ...page,
              data: {
                ...page.data,
                chats: page.data.chats.map((c: ChatRoom) => {
                  if (c._id === chat._id) {
                    const existingMessages = c.messages || [];
                    // Check if message already exists (avoid duplicates)
                    const messageExists = existingMessages.some(
                      (m) => m._id === newMsg._id
                    );
                    if (messageExists) return c;

                    // Update with new message (keep only most recent for list view)
                    // Since user is viewing this chat, mark as read
                    return {
                      ...c,
                      messages: [newMsg], // Only keep the most recent message for the list
                      unreadCount: 0, // Keep at 0 since we're in active chat
                    };
                  }
                  return c;
                }),
              },
            })),
          };
        }
      );

      // ✅ Update the messages cache for this room so messages persist when switching rooms
      queryClient.setQueryData(
        ["messages", chat._id],
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

      // Add to realtime messages for this chat window
      // Check against both fetched messages and existing realtime messages to avoid duplicates
      setRealtimeMessages((prev) => {
        // Avoid duplicates by ID
        if (prev.some((m) => m._id === newMsg._id)) return prev;

        // Also check if this message is already in fetched messages
        const messagesData = queryClient.getQueryData<InfiniteData<MessagesResponse>>([
          "messages",
          chat._id,
        ]);
        const fetchedMessageIds = new Set(
          messagesData?.pages
            .flatMap((page) => page.data.messages)
            .map((m) => m._id) || []
        );
        if (fetchedMessageIds.has(newMsg._id)) return prev;

        // Remove any optimistic temp message that matches sender and text
        const filteredPrev = prev.filter(
          (m) =>
            !m._id.startsWith("temp-") ||
            m.sender !== newMsg.sender ||
            m.message !== newMsg.message
        );

        return [...filteredPrev, newMsg];
      });
    };

    const handleMessagesMarkedRead = (data: any) => {
      console.log("🟢 Messages marked as read:", data);

      // ✅ Update cache for the specific room
      queryClient.setQueryData(
        ["chats", user?._id],
        (oldData: InfiniteData<ChatsResponse> | undefined): InfiniteData<ChatsResponse> | undefined => {
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

      // ✅ Also update the messages cache to mark messages as read
      // This is important when joining a room - all messages should be marked as read
      if (data.roomId === chat._id) {
        // When current user joins, mark all messages as read (backend already marked them)
        // When another user reads, mark messages sent by current user as read
        const isCurrentUserJoining = data.userId === user?._id;

        queryClient.setQueryData(
          ["messages", chat._id],
          (oldData: InfiniteData<MessagesResponse> | undefined): InfiniteData<MessagesResponse> | undefined => {
            if (!oldData) return oldData;

            return {
              ...oldData,
              pages: oldData.pages.map((page) => ({
                ...page,
                data: {
                  ...page.data,
                  messages: page.data.messages.map((msg: Message) => {
                    if (isCurrentUserJoining) {
                      // Current user joined - mark all messages as read
                      return { ...msg, isRead: true };
                    } else {
                      // Another user read - mark messages sent by current user as read
                      return {
                        ...msg,
                        isRead: msg.sender === user?._id ? true : msg.isRead,
                      };
                    }
                  }),
                },
              })),
            };
          }
        );

        // ✅ Also update realtimeMessages to mark them as read
        setRealtimeMessages((prev) =>
          prev.map((msg) => {
            if (isCurrentUserJoining) {
              // Current user joined - mark all messages as read
              return { ...msg, isRead: true };
            } else {
              // Another user read - mark messages sent by current user as read
              return {
                ...msg,
                isRead: msg.sender === user?._id ? true : msg.isRead,
              };
            }
          })
        );
      }
    };

    const handleUserTyping = (data: any) => {
      // Only show typing indicator if it's not from current user
      if (data.userId !== user?._id && data.roomId === chat._id) {
        setIsTyping(true);
        // Clear existing timeout
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        // Auto-clear typing indicator after 3 seconds
        typingTimeoutRef.current = setTimeout(() => {
          setIsTyping(false);
        }, 3000);
      }
    };

    const handleUserStoppedTyping = (data: any) => {
      if (data.userId !== user?._id && data.roomId === chat._id) {
        setIsTyping(false);
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = null;
        }
      }
    };

    newSocket.on("receive-message", handleReceiveMessage);
    newSocket.on("messages-marked-read", handleMessagesMarkedRead);
    newSocket.on("user-typing", handleUserTyping);
    newSocket.on("user-stopped-typing", handleUserStoppedTyping);

    setSocket(newSocket);

    return () => {
      newSocket.off("receive-message", handleReceiveMessage);
      newSocket.off("messages-marked-read", handleMessagesMarkedRead);
      newSocket.off("user-typing", handleUserTyping);
      newSocket.off("user-stopped-typing", handleUserStoppedTyping);
      newSocket.emit("leave-room", { roomId: chat._id });
      newSocket.disconnect();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [chat._id, user?._id, queryClient]);

  // Scroll to bottom on new messages and initial load
  useEffect(() => {
    if (messagesData || realtimeMessages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
    }
  }, [realtimeMessages, messagesData]);

  // Infinite scroll for loading old messages (scroll up)
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          const container = messagesContainerRef.current;
          const oldScrollHeight = container?.scrollHeight || 0;

          fetchNextPage().then(() => {
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
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const fetchedMessages =
    messagesData?.pages.flatMap((page) => page.data.messages).reverse() || [];
  const fetchedMessageIds = new Set(fetchedMessages.map((m) => m._id));

  // Combine fetched and realtime messages, ensuring no duplicates
  // Use a Map to deduplicate by message ID, keeping the most recent version
  const messageMap = new Map<string, Message>();

  // Add fetched messages first
  fetchedMessages.forEach((msg) => {
    messageMap.set(msg._id, msg);
  });

  // Add realtime messages, dropping optimistic temp messages if real arrived
  realtimeMessages.forEach((msg) => {
    if (msg._id.startsWith("temp-")) {
      // If a real message with same sender+text exists, skip temp
      const realExists = Array.from(messageMap.values()).some(
        (m) => m.sender === msg.sender && m.message === msg.message
      );
      if (realExists) return;
    }
    messageMap.set(msg._id, msg);
  });

  // Convert back to array and sort by createdAt
  const allMessages = Array.from(messageMap.values()).sort((a, b) => {
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  // Find the most recent message sent by the current user that has been read
  const mostRecentReadMessage = allMessages
    .filter((msg) => msg.sender === user?._id && msg.isRead)
    .pop(); // Get the last one (most recent) since array is sorted ascending

  const handleSendMessage = () => {
    if (!newMessage.trim() || !socket) return;

    const messageText = newMessage.trim();
    socket.emit("send-message", {
      roomId: chat._id,
      message: messageText,
    });

    // Optimistically add sent message to realtime messages
    const optimisticMessage: Message = {
      _id: `temp-${Date.now()}`,
      sender: user?._id || "",
      to: chat.members._id,
      roomId: chat._id,
      message: messageText,
      isRead: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setRealtimeMessages((prev) => [...prev, optimisticMessage]);
    setNewMessage("");

    // Update chat list cache optimistically
    queryClient.setQueryData(
      ["chats", user?._id],
      (oldData: InfiniteData<ChatsResponse> | undefined): InfiniteData<ChatsResponse>  | undefined => {
        if (!oldData) return oldData;

        return {
          ...oldData,
          pages: oldData.pages.map((page) => ({
            ...page,
            data: {
              ...page.data,
              chats: page.data.chats.map((c: ChatRoom) => {
                if (c._id === chat._id) {
                  return {
                    ...c,
                    messages: [optimisticMessage],
                    unreadCount: 0,
                  };
                }
                return c;
              }),
            },
          })),
        };
      }
    );
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

  return (
    <>
      {/* Chat Header */}
      <div className="p-4 bg-base-100 border-b border-base-300 flex items-center gap-3 flex-shrink-0">
        <div className="relative w-10 h-10 rounded-full overflow-hidden">
          {chat.members.image ? (
            <Image
              src={getImage(chat.members.provider, chat.members.image)}
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

      {/* Messages Area */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 bg-base-200"
      >
        {/* Load More Observer */}
        <div ref={loadMoreObserverRef} className="py-2 text-center">
          {!hasNextPage && allMessages.length > 0 && (
            <div className="text-xs text-base-content/40">No more messages</div>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-full">
           <LoaderIcon className="animate-spin size-10 text-primary" />
          </div>
        ) : allMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-base-content/60">
              <p>No messages yet</p>
              <p className="text-sm mt-2">Start the conversation!</p>
            </div>
          </div>
        ) : (
          <>
            {allMessages.map((message, index) => (
              <div key={message._id || index}>
                <MessageBubble
                  message={message}
                  isOwn={message.sender === user?._id}
                />
                {mostRecentReadMessage && message._id === mostRecentReadMessage._id && (
                  <div className={`text-xs text-base-content/60 ${message.sender === user?._id ? "text-end" : "text-start"}`}>
                    seen, {formatMessageTime(message.updatedAt)}
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
