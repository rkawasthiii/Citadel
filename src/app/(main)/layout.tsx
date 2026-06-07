import { redirect } from "next/navigation";
import { stackServerApp } from "@/stack";
import { UserProviderClient } from "@/lib/context/UserProviderClient";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { Sidebar } from "@/components/navigation/Sidebar";
import { BottomNav } from "@/components/navigation/BottomNav";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side auth check
  const user = await stackServerApp?.getUser();
  
  if (!user) {
    redirect("/sign-in");
  }

  // Check if user has completed onboarding
  const dbUser = await db.query.users.findFirst({
    where: eq(users.email, user.primaryEmail || ""),
  });

  // If user exists and hasn't completed onboarding, redirect to onboarding
  // Skip redirect if already on onboarding page
  const isOnboardingRoute = false; // Will be handled by pathname check in client

  if (dbUser && !dbUser.onboardingCompleted) {
    // We'll handle this in the client-side component to avoid infinite redirects
  }

  return (
    <UserProviderClient 
      onboardingCompleted={dbUser?.onboardingCompleted ?? false}
    >
      <div className="min-h-screen bg-background">
        <Sidebar />
        <main className="md:ml-[245px]">
          {children}
        </main>
        <BottomNav />
      </div>
    </UserProviderClient>
  );
}
