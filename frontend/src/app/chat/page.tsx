"use client";
import { useAuth } from "@/auth/AuthProvider";
import { getAllChats } from "@/lib/apis/chat.api";
import { useChatStore } from "@/stores/useChatStore";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ChatsRedirectPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { chats, setChats, setLoadingChats } = useChatStore();

  useEffect(() => {
    if (!user?._id) return;

    // If we already have chats in store, redirect to first one
    if (chats.length > 0) {
      router.replace(`/chat/${chats[0]._id}`);
      return;
    }

    // Otherwise fetch chats and redirect
    setLoadingChats(true);
    getAllChats({ limit: 20, page: 1 })
      .then((response) => {
        const { chats: fetchedChats, hasMore } = response.data;
        setChats(fetchedChats, hasMore, 1);
        setLoadingChats(false);
        
        if (fetchedChats.length > 0) {
          router.replace(`/chat/${fetchedChats[0]._id}`);
        }
      })
      .catch((error) => {
        console.error("Failed to load chats:", error);
        setLoadingChats(false);
      });
  }, [user?._id, chats, router, setChats, setLoadingChats]);

  // Show loading state or no chats message
  return (
    <div className="flex h-[calc(100vh-4rem)] bg-base-200">
      {/* Left Panel - Empty chat list placeholder */}
      <div className="w-96 bg-base-100 border-r border-base-300 flex flex-col">
        <div className="p-4 bg-base-200 border-b border-base-300">
          <h1 className="text-xl font-semibold text-base-content">Chats</h1>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-base-content/60">Loading chats...</div>
        </div>
      </div>

      {/* Right Panel - No chat selected */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 flex items-center justify-center bg-base-200">
          <div className="text-center">
            <div className="text-6xl mb-4">💬</div>
            <h2 className="text-2xl font-semibold text-base-content mb-2">
              {chats.length === 0 ? "No chats yet" : "Redirecting..."}
            </h2>
            <p className="text-base-content/60">
              {chats.length === 0 
                ? "Start a conversation with someone!" 
                : "Loading your most recent chat..."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
