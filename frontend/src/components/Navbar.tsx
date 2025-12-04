"use client";

import { useAuthUser } from "@/hooks/useAuthUser";
import { useLogout } from "@/hooks/useLogout";
import { getNotificationCount } from "@/lib/notification";
import { getImage } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { BellIcon, LogOutIcon, ShipWheelIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import PageLoader from "./PageLoader";
import ThemeSelector from "./ThemeSelector";

const Navbar = () => {
  const { user: authUser } = useAuthUser();
  const location = usePathname();
  const isChatPage = location?.startsWith("/chat");

  const { data: notifications = 0 } = useQuery({
    queryKey: ["notification"],
    queryFn: getNotificationCount,
  });

  const { logout: logoutMutation, isPending } = useLogout();
  if (isPending) return <PageLoader />;
  return (
    <nav className="sticky top-0 z-50 bg-base-100/80 backdrop-blur-md border-b border-base-200">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 w-full">
          {/* Logo Section - Always visible on mobile, hidden on lg screens ONLY when sidebar is present (non-chat pages) */}
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
            {/* Notifications */}
            <Link href="/notifications" className="flex-shrink-0">
              <div className="indicator">
                {notifications !== 0 && (
                  <span className="indicator-item badge badge-error badge-xs">
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
                    src={getImage(authUser.provider, authUser.image)}
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
