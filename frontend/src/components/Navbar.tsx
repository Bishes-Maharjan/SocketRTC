"use client";

import { useAuthUser } from "@/hooks/useAuthUser";
import { useLogout } from "@/hooks/useLogout";
import { useSocket } from "@/hooks/useSocket";
import { unReadChatNotification } from "@/lib/apis/chat.api";
import { getNotificationCount } from "@/lib/apis/notification.api";
import { getImage } from "@/lib/utils";
import { useChatStore } from "@/stores/useChatStore";
import { useQuery } from "@tanstack/react-query";
import { BellIcon, LogOutIcon, MessageSquareIcon, ShipWheelIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import PageLoader from "./PageLoader";
import ThemeSelector from "./ThemeSelector";

const Navbar = () => {
  const { user: authUser } = useAuthUser();
  const location = usePathname();
  const { unReadCount, setUnReadCount } = useChatStore();
  const isChatPage = location?.startsWith("/chat");
  const { socket, isConnected } = useSocket();
  const { data: notifications = 0 } = useQuery({
    queryKey: ["notification"],
    queryFn: getNotificationCount,
  });

  const { logout: logoutMutation, isPending } = useLogout();

  useEffect(() => {
    console.log("Navbar useEffect - socket:", socket, "authUser:", authUser?._id, "isConnected:", isConnected);
    
    // Wait for BOTH socket to exist AND connection to be established
    if (!socket || !authUser?._id || !isConnected) {
      console.log("Waiting for socket connection...");
      return;
    }

    console.log("Socket is ready! Setting up listeners in Navbar");

    // Fetch initial unread count
    const fetchInitialUnreadCount = async () => {
      try {
        const count = await unReadChatNotification();
        useChatStore.setState({ unReadCount: count });
      } catch (error) {
        console.error('Failed to fetch unread count:', error);
      }
    };
    
    fetchInitialUnreadCount();

    // Listen for incoming messages (from personal room: user:${userId})
    const handleReceiveMessage = (data: {to: string; isRead: boolean, message: string}) => {
      console.log('NAVBAR MESSAGE RECEIVED', data.message, data.to, data.isRead);
      if (!data.isRead && data.to === authUser._id) {
        setUnReadCount(1);
      }
    };

    socket.on('receive-message', handleReceiveMessage);

    // Cleanup function to remove listener
    return () => {
      console.log("Cleaning up socket listeners in Navbar");
      socket.off('receive-message', handleReceiveMessage);
    };
  }, [socket, authUser?._id, isConnected, setUnReadCount]); // ✅ Add isConnected back

  if (isPending) return <PageLoader />;
  
  return (
    <nav className="sticky top-0 z-50 bg-base-100/80 backdrop-blur-md border-b border-base-200">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 w-full">
          {/* Logo Section */}
          <div className="flex-shrink-0">
            <Link
              href="/"
              className={`flex items-center gap-2.5 transition-opacity duration-200 ${
                isChatPage
                  ? "opacity-100"
                  : "lg:opacity-0 lg:pointer-events-none"
              }`}
            >
              <ShipWheelIcon className="size-8 text-primary shrink-0" />
              <span className="text-xl sm:text-2xl font-bold font-mono bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary tracking-wider">
                Streamify
              </span>
            </Link>
          </div>

          {/* Center spacer */}
          <div className="flex-1" />

          {/* Right-side actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Chats (hidden on chat page) */}
            {!isChatPage && (
              <Link href="/chat" className="flex-shrink-0">
                <div className="indicator">
                  {unReadCount > 0 && (
                    <span className="indicator-item badge badge-success badge-xs">
                      {unReadCount}
                    </span>
                  )}
                  <button className="btn btn-ghost btn-circle btn-sm sm:btn-md hover:bg-base-200 transition-colors" title="Chats">
                    <MessageSquareIcon className="h-5 w-5 sm:h-6 sm:w-6 text-base-content/70" />
                  </button>
                </div>
              </Link>
            )}
            {/* Notifications */}
            <Link href="/notifications" className="flex-shrink-0">
              <div className="indicator">
                {notifications !== 0 && (
                  <span className="indicator-item badge badge-success badge-xs">
                    {notifications}
                  </span>
                )}
                <button className="btn btn-ghost btn-circle btn-sm sm:btn-md hover:bg-base-200 transition-colors">
                  <BellIcon className="h-5 w-5 sm:h-6 sm:w-6 text-base-content/70" />
                </button>
              </div>
            </Link>

            {/* Theme Selector */}
            <div className="flex-shrink-0">
              <ThemeSelector />
            </div>

            {/* Avatar */}
            {authUser?.image && (
              <div className="avatar flex-shrink-0">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full ring-2 ring-base-300 hover:ring-primary transition-all duration-200">
                  <Image
                    src={getImage(authUser.image)}
                    alt="User Avatar"
                    width={36}
                    height={36}
                    className="rounded-full object-cover"
                  />
                </div>
              </div>
            )}

            {/* Logout */}
            <button
              className="btn btn-ghost btn-circle btn-sm sm:btn-md hover:bg-base-200 transition-colors flex-shrink-0"
              onClick={() => logoutMutation()}
              title="Logout"
            >
              <LogOutIcon className="h-5 w-5 sm:h-6 sm:w-6 text-base-content/70" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;