"use client";
import { useAuth } from "@/auth/AuthProvider";
import {
  ChatRoom,
  ChatsResponse,
  Message,
  MessagesResponse,
} from "@/interfaces/allInterface";
import {
  getAllChats,
  getRoomMessageWithItsUnreadCount,
  readMessagesForRoom,
} from "@/lib/apis/chat.api";
import { formatMessageTime, getImage } from "@/lib/utils";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

export default function ChatsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedChat, setSelectedChat] = useState<ChatRoom | null>(null);
  const observerTarget = useRef<HTMLDivElement>(null);

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

  const { mutate: readMessages } = useMutation({
    mutationKey: ["readUnreadChats"],
    mutationFn: readMessagesForRoom,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chats", user?._id] });
      queryClient.invalidateQueries({ queryKey: ["chatNotification"] });
    },
  });
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
    <div className="flex h-screen bg-gray-100">
      {/* Left Sidebar - Chat List */}
      <div className="w-96 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <h1 className="text-xl font-semibold text-gray-800">Chats</h1>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-gray-500">Loading chats...</div>
            </div>
          ) : allChats.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-500">
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
                    readMessages(chat._id);
                    setSelectedChat(chat);
                  }}
                />
              ))}
              <div ref={observerTarget} className="py-4 text-center">
                {isFetchingNextPage && (
                  <div className="text-gray-500 text-sm">Loading more...</div>
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
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <div className="text-6xl mb-4">💬</div>
              <h2 className="text-2xl font-semibold text-gray-700 mb-2">
                Choose a chat
              </h2>
              <p className="text-gray-500">
                Select a conversation from the left to start messaging
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Chat Room Card Component
function ChatRoomCard({
  chat,
  us,
  isSelected,
  onClick,
}: {
  chat: ChatRoom;
  us: string;
  isSelected: boolean;
  onClick: () => void;
}) {
  const lastMessage = chat.messages[0];

  return (
    <div
      onClick={onClick}
      className={`p-4 border-b border-gray-100 cursor-pointer transition-colors hover:bg-gray-50 ${
        isSelected ? "bg-gray-100" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="relative w-12 h-12 rounded-full overflow-hidden flex-shrink-0">
          {chat.members.image ? (
            <Image
              src={getImage(chat.members.provider, chat.members.image)}
              alt={chat.members.fullName}
              fill
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full bg-blue-500 flex items-center justify-center text-white font-semibold text-lg">
              {chat.members.fullName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold text-gray-900 truncate">
              {chat.members.fullName}
            </h3>
            {lastMessage && (
              <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                {formatMessageTime(lastMessage.createdAt)}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            {lastMessage && (
              <p
                className={`text-sm truncate ${
                  lastMessage.isRead
                    ? "text-gray-500"
                    : "text-gray-900 font-semibold"
                }`}
              >
                {lastMessage.sender == us
                  ? "You: "
                  : `${chat.members.fullName}: `}
                {lastMessage.message}
              </p>
            )}

            {chat.unreadCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold text-white bg-green-500 rounded-full flex-shrink-0">
                {chat.unreadCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Chat Window Component
function ChatWindow({ chat }: { chat: ChatRoom }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const loadMoreObserverRef = useRef<HTMLDivElement>(null);
  const [realtimeMessages, setRealtimeMessages] = useState<Message[]>([]);

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
        limit: 20,
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

  // Socket connection
  useEffect(() => {
    const newSocket = io("http://localhost:3001", {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    newSocket.on("connect", () => {
      console.log("Connected to socket");
      newSocket.emit("join-room", { roomId: chat._id });
    });

    newSocket.on("receive-message", (data) => {
      const newMsg: Message = {
        _id: Date.now().toString(),
        sender: data.sender,
        to: user?._id || "",
        roomId: chat._id,
        message: data.message,
        isRead: false,
        createdAt: data.timeStamp,
        updatedAt: data.timeStamp,
      };
      setRealtimeMessages((prev) => [...prev, newMsg]);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [chat._id, user?._id]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [realtimeMessages]);

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

  const allMessages = [
    ...(messagesData?.pages.flatMap((page) => page.data.messages).reverse() ||
      []),
    ...realtimeMessages,
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
      <div className="p-4 bg-white border-b border-gray-200 flex items-center gap-3">
        <div className="relative w-10 h-10 rounded-full overflow-hidden">
          {chat.members.image ? (
            <Image
              src={chat.members.image}
              alt={chat.members.fullName}
              fill
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full bg-blue-500 flex items-center justify-center text-white font-semibold">
              {chat.members.fullName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div>
          <h2 className="font-semibold text-gray-900">
            {chat.members.fullName}
          </h2>
          <p className="text-xs text-gray-500">{chat.members.location}</p>
        </div>
      </div>

      {/* Messages Area */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 bg-gray-50"
      >
        {/* Load More Observer */}
        <div ref={loadMoreObserverRef} className="py-2 text-center">
          {isFetchingNextPage && (
            <div className="text-xs text-gray-500">
              Loading older messages...
            </div>
          )}
          {!hasNextPage && allMessages.length > 0 && (
            <div className="text-xs text-gray-400">No more messages</div>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-500">Loading messages...</div>
          </div>
        ) : allMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500">
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
      <div className="p-4 bg-white border-t border-gray-200">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:border-green-500"
          />
          <button
            onClick={handleSendMessage}
            disabled={!newMessage.trim()}
            className="px-6 py-2 bg-green-500 text-white rounded-full font-semibold hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </>
  );
}

// Message Bubble Component
function MessageBubble({
  message,
  isOwn,
}: {
  message: Message;
  isOwn: boolean;
}) {
  return (
    <div className={`flex mb-4 ${isOwn ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
          isOwn
            ? "bg-green-500 text-white rounded-br-none"
            : "bg-white text-gray-900 rounded-bl-none shadow-sm"
        }`}
      >
        <p className="break-words">{message.message}</p>
        <span
          className={`text-xs mt-1 block ${
            isOwn ? "text-green-100" : "text-gray-500"
          }`}
        >
          {formatMessageTime(message.createdAt)}
        </span>
      </div>
    </div>
  );
}
