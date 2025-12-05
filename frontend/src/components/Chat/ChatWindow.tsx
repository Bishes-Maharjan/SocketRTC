import { useAuth } from "@/auth/AuthProvider";
import { ChatRoom, Message, MessagesResponse } from "@/interfaces/allInterface";
import { getRoomMessageWithItsUnreadCount } from "@/lib/apis/chat.api";
import { getImage } from "@/lib/utils";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
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
  }, [chat._id]);

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

      // ✅ Optimistically update the chat list with new message
      queryClient.setQueryData(["chats", user?._id], (oldData: any) => {
        if (!oldData) return oldData;

        return {
          ...oldData,
          pages: oldData.pages.map((page: any) => ({
            ...page,
            data: {
              ...page.data,
              chats: page.data.chats.map((c: ChatRoom) =>
                c._id === chat._id
                  ? {
                      ...c,
                      messages: [newMsg, ...(c.messages || [])],
                      unreadCount: 0, // Keep at 0 since we're in active chat
                    }
                  : c
              ),
            },
          })),
        };
      });

      setRealtimeMessages((prev) => [...prev, newMsg]);
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

  const allMessages = [
    ...fetchedMessages,
    ...realtimeMessages.filter((msg) => !fetchedMessageIds.has(msg._id)),
  ];

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
        {/* Load More Observer */}
        <div ref={loadMoreObserverRef} className="py-2 text-center">
          {!hasNextPage && allMessages.length > 0 && (
            <div className="text-xs text-base-content/40">No more messages</div>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-base-content/60">Loading messages...</div>
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
              <MessageBubble
                key={message._id || index}
                message={message}
                isOwn={message.sender === user?._id}
              />
            ))}
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
