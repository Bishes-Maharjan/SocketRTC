import { useAuth } from "@/auth/AuthProvider";
import { ChatRoom, Message, MessagesResponse } from "@/interfaces/allInterface";
import { getRoomMessageWithItsUnreadCount } from "@/lib/apis/chat.api";
import { getImage } from "@/lib/utils";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2Icon } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { MessageBubble } from "./MessageBubble";

export function ChatWindow({ chat }: { chat: ChatRoom }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const loadMoreObserverRef = useRef<HTMLDivElement>(null);
  const [realtimeMessages, setRealtimeMessages] = useState<Message[]>([]);
  const queryClient = useQueryClient();
  const isInitialLoadRef = useRef(true);
  const isFetchingOlderMessagesRef = useRef(false);
  const previousMessageCountRef = useRef(0);

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
    isInitialLoadRef.current = true;
    previousMessageCountRef.current = 0;
  }, [chat._id]);

  // Sync realtimeMessages with messages query cache updates
  // This ensures messages received via global socket are shown in ChatWindow
  useEffect(() => {
    if (!messagesData) return;

    const allFetchedMessages =
      messagesData.pages.flatMap((page) => page.data.messages) || [];
    const fetchedMessageIds = new Set(allFetchedMessages.map((m) => m._id));

    // Remove messages from realtimeMessages that are now in the fetched messages
    // This happens when messages arrive via global socket and update the cache
    setRealtimeMessages((prev) =>
      prev.filter((msg) => !fetchedMessageIds.has(msg._id))
    );
  }, [messagesData]);

  // Socket connection
  // In ChatWindow.tsx, update the socket connection effect:

  useEffect(() => {
    const newSocket = io("http://localhost:3001", {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    newSocket.on("connect", () => {
      console.log("Connected to socket");
      newSocket.emit("join-room", { roomId: chat._id });

      // ✅ Immediately update cache when joining room
      queryClient.setQueryData(["chats", user?._id], (oldData: any) => {
        if (!oldData) return oldData;

        return {
          ...oldData,
          pages: oldData.pages.map((page: any) => ({
            ...page,
            data: {
              ...page.data,
              chats: page.data.chats.map((c: ChatRoom) =>
                c._id === chat._id ? { ...c, unreadCount: 0 } : c
              ),
            },
          })),
        };
      });
    });

    const handleReceiveMessage = (data: any) => {
      const newMsg: Message = {
        _id: data._id,
        sender: data.sender,
        to: user?._id || "",
        roomId: chat._id,
        message: data.message,
        isRead: data.isRead,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      };

      // Update messages query cache - only if message doesn't exist
      queryClient.setQueryData(["messages", chat._id], (oldData: any) => {
        if (!oldData) return oldData;

        // Check all pages for existing message
        const existingMessageIds = new Set(
          oldData.pages.flatMap((page: any) =>
            page.data.messages.map((m: Message) => m._id).filter(Boolean)
          )
        );

        if (existingMessageIds.has(newMsg._id)) {
          return oldData; // Message already exists, don't add duplicate
        }

        // Add to first page (most recent messages)
        return {
          ...oldData,
          pages: oldData.pages.map((page: any, index: number) => {
            if (index === 0) {
              // Check if message already exists in this page
              const pageMessageIds = new Set(
                page.data.messages.map((m: Message) => m._id).filter(Boolean)
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

      // ✅ Optimistically update the chat list with new message
      queryClient.setQueryData(["chats", user?._id], (oldData: any) => {
        if (!oldData) return oldData;

        return {
          ...oldData,
          pages: oldData.pages.map((page: any) => ({
            ...page,
            data: {
              ...page.data,
              chats: page.data.chats.map((c: ChatRoom) => {
                if (c._id === chat._id) {
                  const existingIds = new Set(
                    (c.messages || []).map((m: Message) => m._id)
                  );
                  // Don't add duplicate messages
                  if (existingIds.has(newMsg._id)) {
                    return c;
                  }
                  return {
                    ...c,
                    messages: [newMsg], // Keep only latest message (matching backend response)
                    unreadCount: 0, // Keep at 0 since we're in active chat
                  };
                }
                return c;
              }),
            },
          })),
        };
      });

      // Only add to realtimeMessages if not already in fetched messages
      const fetchedIds = new Set(
        messagesData?.pages
          .flatMap((page) => page.data.messages)
          .map((m) => m._id) || []
      );
      if (!fetchedIds.has(newMsg._id)) {
        setRealtimeMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m._id));
          if (existingIds.has(newMsg._id)) return prev;
          return [...prev, newMsg];
        });
      }
    };

    const handleMessagesMarkedRead = (data: any) => {
      console.log("🟢 Messages marked as read:", data);

      // ✅ Update cache for the specific room
      queryClient.setQueryData(["chats", user?._id], (oldData: any) => {
        if (!oldData) return oldData;

        return {
          ...oldData,
          pages: oldData.pages.map((page: any) => ({
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
      });
    };

    newSocket.on("receive-message", handleReceiveMessage);
    newSocket.on("messages-marked-read", handleMessagesMarkedRead);

    setSocket(newSocket);

    return () => {
      newSocket.off("receive-message", handleReceiveMessage);
      newSocket.off("messages-marked-read", handleMessagesMarkedRead);
      newSocket.emit("leave-room", { roomId: chat._id });
      newSocket.disconnect();
    };
  }, [chat._id, user?._id, queryClient, messagesData]);

  // Infinite scroll for loading old messages (scroll up)
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          const container = messagesContainerRef.current;
          const oldScrollHeight = container?.scrollHeight || 0;
          const oldScrollTop = container?.scrollTop || 0;

          // Mark that we're fetching older messages to prevent scroll to bottom
          isFetchingOlderMessagesRef.current = true;

          fetchNextPage().then(() => {
            // Maintain scroll position after loading old messages
            setTimeout(() => {
              if (container) {
                const newScrollHeight = container.scrollHeight;
                const scrollDifference = newScrollHeight - oldScrollHeight;
                // Maintain scroll position relative to the top
                container.scrollTop = oldScrollTop + scrollDifference;
              }
              // Reset the flag after a short delay
              setTimeout(() => {
                isFetchingOlderMessagesRef.current = false;
              }, 100);
            }, 0);
          });
        }
      },
      { threshold: 0.1 }
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

  // Get all fetched messages and reverse them (oldest first, newest last)
  const fetchedMessages =
    messagesData?.pages.flatMap((page) => page.data.messages).reverse() || [];

  // Create a map to deduplicate messages by _id
  const messageMap = new Map<string, Message>();

  // Add fetched messages first (they take priority)
  fetchedMessages.forEach((msg) => {
    if (msg._id) {
      messageMap.set(msg._id, msg);
    }
  });

  // Add realtime messages that aren't already in fetched messages
  realtimeMessages.forEach((msg) => {
    if (msg._id && !messageMap.has(msg._id)) {
      messageMap.set(msg._id, msg);
    }
  });

  // Convert map to array and sort by createdAt (oldest first)
  const allMessages = Array.from(messageMap.values()).sort((a, b) => {
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  // Scroll to bottom on new messages and initial load (but NOT when loading older messages)
  useEffect(() => {
    const currentMessageCount = allMessages.length;
    const isNewMessageAtBottom =
      realtimeMessages.length > 0 ||
      (currentMessageCount > previousMessageCountRef.current &&
        !isFetchingOlderMessagesRef.current);

    // Only scroll to bottom if:
    // 1. Initial load
    // 2. New realtime messages arrived
    // 3. New messages were added at the bottom (not when loading older messages)
    if (isInitialLoadRef.current || isNewMessageAtBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
      isInitialLoadRef.current = false;
    }

    previousMessageCountRef.current = currentMessageCount;
  }, [realtimeMessages, allMessages.length]);

  const handleSendMessage = () => {
    if (!newMessage.trim() || !socket) return;

    socket.emit("send-message", {
      roomId: chat._id,
      message: newMessage.trim(),
    });

    setNewMessage("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
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
        <>
          {/* Load More Observer - placed at top for loading older messages */}
          <div ref={loadMoreObserverRef} className="py-2 text-center">
            {isFetchingNextPage && (
              <Loader2Icon className="flex items-center justify-items-center" />
            )}
          </div>

          {allMessages.map((message) => (
            <MessageBubble
              key={message._id}
              message={message}
              isOwn={message.sender === user?._id}
            />
          ))}
          <div ref={messagesEndRef} />
        </>
      </div>

      {/* Message Input */}
      <div className="p-4 bg-base-100 border-t border-base-300 flex-shrink-0">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
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
