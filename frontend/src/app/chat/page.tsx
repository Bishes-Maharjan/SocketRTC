"use client";
import { useAuth } from "@/auth/AuthProvider";
import { ChatRoomCard } from "@/components/Chat/ChatRoomCard";
import { ChatWindow } from "@/components/Chat/ChatWindow";
import { ChatRoom, ChatsResponse } from "@/interfaces/allInterface";
import { getAllChats } from "@/lib/apis/chat.api";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

export default function ChatsPage() {
  const { user } = useAuth();
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
    <div className="h-[calc(100vh-4rem)] overflow-hidden flex">
      {" "}
      {/* Left Sidebar - Chat List */}
      <div className="w-96 bg-base-100 border-r border-base-300 flex flex-col">
        {/* Header */}
        <div className="p-4 bg-base-200 border-b border-base-300">
          <h1 className="text-xl font-semibold">Chats</h1>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <span className="loading loading-spinner loading-lg"></span>
            </div>
          ) : allChats.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-base-content opacity-60">
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
                  onClick={() => setSelectedChat(chat)}
                />
              ))}
              <div ref={observerTarget} className="py-4 text-center">
                {isFetchingNextPage && (
                  <span className="loading loading-spinner loading-md"></span>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      {/* Right Panel - Chat Window */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedChat ? (
          <ChatWindow chat={selectedChat} />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-base-200">
            <div className="text-center">
              <div className="text-6xl mb-4">💬</div>
              <h2 className="text-2xl font-semibold mb-2">Choose a chat</h2>
              <p className="text-base-content opacity-60">
                Select a conversation from the left to start messaging
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
