'use client';

import { useAuth } from '@/auth/AuthProvider';
import IncomingCallModal from '@/components/IncomingCallModal';
import Navbar from '@/components/Navbar';
import PageLoader from '@/components/PageLoader';
import Sidebar from '@/components/Sidebar';
import { useSocket } from '@/hooks/useSocket';
import { getUser } from '@/lib/apis/friend.api';
import { getImage } from '@/lib/utils';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import LoginPage from './login/page';
import OnboardingPage from './onboard/page';
import HomePage from './page';

interface IncomingCall {
  from: string;
  to: string;
  roomId: string;
  callerName: string;
  image: string;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // const router = useRouter(); // Unused
  const { user, isLoading } = useAuth();
  const { socket, isConnected } = useSocket();
  const [isMounted, setIsMounted] = useState(false);
  
  // Incoming call state
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);

  // Prevent hydration mismatch by only rendering after mount
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Handle incoming call rejection
  const handleRejectCall = useCallback(() => {
    if (incomingCall && socket) {
      socket.emit('rejectCall', {
        to: incomingCall.from,
        from: user?._id,
        roomId: incomingCall.roomId,
      });
    }
    setIncomingCall(null);
  }, [incomingCall, socket, user?._id]);

  // Handle picking up call
  const handlePickUp = useCallback(() => {
    setIncomingCall(null);
  }, []);

  // Global incoming call listener
  useEffect(() => {
    if (!socket || !isConnected || !user?._id) return;

    const handleCalling = async (data: { from: string; to: string; roomId: string; callerName?: string }) => {
      // Check if the call is for us
      if (data.to === user._id) {
        // Don't show if already on call page
        if (pathname?.startsWith('/call')) return;
        
        async function getUserImage(userId: string) {
          const res = await getUser(userId);
          return res.image;
        }

        const image = await getUserImage(data.from);

        setIncomingCall({
          from: data.from,
          to: data.to,
          roomId: data.roomId,
          callerName: data.callerName || 'Someone',
          image
        });
      }
    };

    socket.on('calling', handleCalling);

    return () => {
      socket.off('calling', handleCalling);
    };
  }, [socket, isConnected, user?._id, pathname]);

  // Define page conditions
  const isAuthPage = ['/login', '/signup'].includes(pathname);
  const isChatPage = pathname?.startsWith('/chat');
  const isOnboardPage = pathname?.startsWith('/onboard');
  const isCallPage = pathname?.startsWith('/call');
  const isHomePage = pathname === '/';

  // Define public routes that don't require authentication
  const publicRoutes = ['/login', '/signup', '/oauth-success'];
  const isPublicRoute = publicRoutes.includes(pathname);

  const shouldShowSidebar = !isAuthPage && !isChatPage && !isOnboardPage && !isCallPage;
  const shouldShowNavbar = !isAuthPage && !isOnboardPage && !isCallPage;

  // Show loading state while mounting or auth is being determined
  if (!isMounted || isLoading) {
    return <PageLoader />;
  }

  // For auth pages when user is not authenticated - allow access
  if (isAuthPage && !user) {
    return <>{children}</>;
  }

  // If user is authenticated but on auth pages - redirect to home
  if (user && isAuthPage) {
    return <HomePage />;
  }

  // If user is authenticated but not onboarded, and not on auth pages
  if (user && user.isOnBoarded === false && !isAuthPage && !isOnboardPage) {
    return <OnboardingPage />;
  }

  // For public routes, allow access regardless of auth status
  if (isPublicRoute) {
    return <>{children}</>;
  }

  // For protected routes, redirect to login if not authenticated
  // BUT only for known app routes, let unknown routes fall through to not-found
  const knownProtectedRoutes = [
    '/notifications',
    '/onboard',
    '/chat',
    '/friends',
    '/call',
  ];
  const isKnownProtectedRoute =
    knownProtectedRoutes.some((route) => pathname.startsWith(route)) ||
    isHomePage;

  if (!user && isKnownProtectedRoute) {
    return <LoginPage />;
  }

  // For unknown routes, let them pass through so not-found.tsx can handle them
  if (!user && !isKnownProtectedRoute) {
    return <>{children}</>;
  }

  // Render with sidebar layout for authenticated users on appropriate pages
  if (shouldShowSidebar && user) {
    return (
      <>
        {/* Global Incoming Call Modal */}
        <IncomingCallModal
          isOpen={!!incomingCall}
          callerName={incomingCall?.callerName || 'Someone'}
          roomId={incomingCall?.roomId || ''}
          // callerId={incomingCall?.from || ''} // Unused
          image={getImage(incomingCall?.image)}
          onPickUp={handlePickUp}
          onReject={handleRejectCall}
        />
        
        <div className="flex h-screen bg-gray-50">
          <Sidebar />
          <div className="flex-1 flex flex-col overflow-hidden">
            <Navbar />
            <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50">
              {children}
            </main>
          </div>
        </div>
      </>
    );
  }

  // Render without sidebar (for chat pages and onboarding)
  return (
    <>
      {/* Global Incoming Call Modal */}
      <IncomingCallModal
        isOpen={!!incomingCall}
        callerName={incomingCall?.callerName || 'Someone'}
        roomId={incomingCall?.roomId || ''}
        // callerId={incomingCall?.from || ''} // Unused
        image={getImage(incomingCall?.image)}
        onPickUp={handlePickUp}
        onReject={handleRejectCall}
      />
      
      <div className="flex flex-col min-h-screen bg-gray-50">
        {shouldShowNavbar && <Navbar />}
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </div>
    </>
  );
}
