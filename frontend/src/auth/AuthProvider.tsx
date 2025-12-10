'use client';
import { useAuthUser } from '@/hooks/useAuthUser';
import { createContext, useContext, useEffect, useState } from 'react';

type User = {
  fullName: string;
  bio: string;
  nativeLanguage: string;
  learningLanguage: string;
  image: string;
  location: string;
  isOnBoarded: boolean;
  _id: string;
} | null;

type AuthContextType = {
  user: User;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
});

export const AuthProvider = ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) => {
  const [isHydrated, setIsHydrated] = useState(false);

  // Move hook call to the top - always call hooks in the same order
  const { user, isLoading } = useAuthUser();

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // During SSR or before hydration, return safe defaults
  if (!isHydrated) {
    return (
      <AuthContext.Provider
        value={{
          user,
          isLoading,
        }}
      >
        {children}
      </AuthContext.Provider>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');

  return ctx;
};
