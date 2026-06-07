"use client";

import { createContext, useContext, ReactNode, useEffect, useState } from "react";
import { useUser as useStackUser } from "@stackframe/stack";
import { usePathname, useRouter } from "next/navigation";

interface AppUser {
  id: string;
  email: string;
  username: string;
  name: string;
  avatar?: string | null;
  bio?: string | null;
  institution?: string | null;
  profileType: string;
  isActive: boolean;
  onboardingCompleted: boolean;
  createdAt?: string;
}

interface UserContextType {
  user: { id: string; displayName?: string | null; primaryEmail?: string | null; profileImageUrl?: string | null } | null;
  appUser: AppUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  syncUser: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

interface UserProviderClientProps {
  children: ReactNode;
  onboardingCompleted?: boolean;
}

export function UserProviderClient({ 
  children, 
  onboardingCompleted: initialOnboardingCompleted = true 
}: UserProviderClientProps) {
  // User is guaranteed to exist here (server-side check in layout)
  const stackUser = useStackUser();
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [syncing, setSyncing] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const user = stackUser;
  const isAuthenticated = !!user;

  const syncUser = async () => {
    if (!user) {
      setAppUser(null);
      return;
    }

    setSyncing(true);
    try {
      const res = await fetch("/api/auth/sync");
      if (res.ok) {
        const data = await res.json();
        setAppUser(data.user);
      }
    } catch (error) {
      console.error("Failed to sync user:", error);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (user) {
      syncUser();
    } else {
      setAppUser(null);
    }
  }, [user?.id]);

  // Handle onboarding redirect
  useEffect(() => {
    const isOnboardingPage = pathname === "/onboarding";
    const needsOnboarding = appUser ? !appUser.onboardingCompleted : !initialOnboardingCompleted;
    
    if (user && needsOnboarding && !isOnboardingPage) {
      router.push("/onboarding");
    }
  }, [appUser, initialOnboardingCompleted, pathname, router, user]);

  return (
    <UserContext.Provider value={{ user, appUser, loading: syncing, isAuthenticated, syncUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProviderClient");
  }
  return context;
}

export { useStackApp } from "@stackframe/stack";
