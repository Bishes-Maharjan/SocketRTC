"use client";

import {
  getChatById,
  getRoomMessageWithItsUnreadCount,
} from "@/lib/apis/chat.api";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
export interface User {
  _id: string;
  fullName: string;
  image: string;
  nativeLanguage: string;
  learningLanguage: string;
  location: string;
  provider: string;
  bio: string;
}

export interface Message {
  _id: string;
  sender: string;
  to: string;
  roomId: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ChatRoom {
  _id: string;
  members: User;
  messages: Message[];
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChatsResponse {
  data: {
    chats: ChatRoom[];
    hasMore: boolean;
  };
}

export interface MessagesResponse {
  data: {
    messages: Message[];
    unreadCount: number;
    hasMore: boolean;
  };
}

export default function ChatPage() {
  const params = useParams<{ id: string }>();
  const roomId = params.id;
  const {
    data: messagesData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ["messages", roomId],
    queryFn: ({ pageParam = 1 }) =>
      getRoomMessageWithItsUnreadCount(roomId, {
        limit: 20,
        page: pageParam,
      }),
    getNextPageParam: (lastPage: MessagesResponse, allPages) => {
      if (lastPage.data.hasMore) {
        return allPages.length + 1;
      }
      return undefined;
    },
    enabled: !!roomId,
    initialPageParam: 1,
  });

  const { data: chat } = useQuery({
    queryKey: ["chat", roomId],
    queryFn: () => getChatById(roomId),
  });
  const fetchedMessages = messagesData?.pages.flatMap((msg) => msg.data);
  console.log(chat);
  return <div>Chat ID: {params.id}</div>;
}
