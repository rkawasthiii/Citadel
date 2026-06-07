"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  Search,
  Video,
  MessageCircle,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";

interface NavItemProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

function NavItem({ href, icon, label, active, onClick }: NavItemProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      asChild
      className={`h-12 w-12 ${
        active ? "text-foreground" : "text-muted-foreground"
      }`}
      onClick={onClick}
    >
      <Link href={href}>
        {icon}
        <span className="sr-only">{label}</span>
      </Link>
    </Button>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [transitioning, setTransitioning] = useState(false);

  // Define route order for slide transitions
  const routes = ["/", "/search", "/create", "/dm", "/profile"];
  const currentIndex = routes.indexOf(pathname || "/");

  const handleNavigation = (href: string) => {
    if (pathname === href || transitioning) return;
    
    const targetIndex = routes.indexOf(href);
    setTransitioning(true);
    
    // Add a slight delay to allow for transition animation
    setTimeout(() => {
      router.push(href);
      setTransitioning(false);
    }, 50);
  };

  // Hide bottom nav on DM chat pages (when viewing a specific conversation) and onboarding page
  const isDMChatPage = pathname?.match(/^\/dm\/[^/]+$/);
  const isOnboardingPage = pathname === "/onboarding";
  if (isDMChatPage || isOnboardingPage) {
    return null;
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-[#dbdbdb] dark:border-[#262626] z-50 md:hidden">
      <div className="max-w-2xl mx-auto flex items-center justify-around py-1">
        <NavItem
          href="/"
          icon={<Home className="h-7 w-7" strokeWidth={pathname === "/" ? 2 : 1.5} />}
          label="Home"
          active={pathname === "/"}
          onClick={() => handleNavigation("/")}
        />
        <NavItem
          href="/search"
          icon={<Search className="h-7 w-7" strokeWidth={pathname === "/search" ? 2 : 1.5} />}
          label="Search"
          active={pathname === "/search"}
          onClick={() => handleNavigation("/search")}
        />
        <NavItem
          href="/dm"
          icon={<MessageCircle className={`h-7 w-7 ${pathname?.startsWith("/dm") ? "fill-current" : ""}`} strokeWidth={pathname?.startsWith("/dm") ? 2 : 1.5} />}
          label="Messages"
          active={pathname?.startsWith("/dm")}
          onClick={() => handleNavigation("/dm")}
        />
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="h-12 w-12 text-muted-foreground cursor-default"
            disabled
          >
            <Video className="h-7 w-7" strokeWidth={1.5} />
            <span className="sr-only">Videos</span>
          </Button>
          <span className="absolute top-0.5 right-0.5 bg-primary text-[7px] text-primary-foreground px-1 py-0.5 rounded-full font-medium whitespace-nowrap pointer-events-none">
            Soon
          </span>
        </div>
        <NavItem
          href="/profile"
          icon={<User className="h-7 w-7" strokeWidth={pathname === "/profile" ? 2 : 1.5} />}
          label="Profile"
          active={pathname === "/profile"}
          onClick={() => handleNavigation("/profile")}
        />
      </div>
    </nav>
  );
}
