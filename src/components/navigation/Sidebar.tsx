"use client";

import Link from "next/link";
import {
  Home,
  Search,
  Film,
  MessageCircle,
  User,
  LogOut,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface NavItemProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  badge?: string;
  disabled?: boolean;
  collapsed?: boolean;
}

function NavItem({ href, icon, label, active, badge, disabled, collapsed }: NavItemProps) {
  const content = (
    <div
      className={cn(
        "flex items-center gap-4 px-3 py-3 my-0.5 rounded-lg transition-all",
        disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#efefef] dark:hover:bg-[#262626]',
        active ? "font-bold" : "font-normal",
        collapsed && "justify-center"
      )}
    >
      {icon}
      {!collapsed && (
        <>
          <span className="text-[16px]">{label}</span>
          {badge && (
            <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-semibold">
              {badge}
            </span>
          )}
        </>
      )}
    </div>
  );

  if (disabled) {
    return <div className="block">{content}</div>;
  }

  return (
    <Link href={href} className="block">
      {content}
    </Link>
  );
}

interface SidebarProps {
  collapsed?: boolean;
}

export function Sidebar({ collapsed = false }: SidebarProps = {}) {
  const pathname = usePathname();

  return (
    <aside 
      className={cn(
        "fixed left-0 top-0 h-screen border-r border-[#dbdbdb] dark:border-[#262626] bg-background px-3 pt-2 pb-5 flex-col hidden md:flex z-50",
        collapsed ? "w-[72px]" : "w-[245px]"
      )}
    >
      {/* Logo */}
      <div className={cn("px-3 pt-6 pb-4 mb-2", collapsed && "px-0 flex justify-center")}>
        <Link href="/">
          {collapsed ? (
            <div className="w-10 h-10 flex items-center justify-center">
              <span className="text-2xl font-normal" style={{ fontFamily: "'Billabong', cursive" }}>F</span>
            </div>
          ) : (
            <h1 className="text-4xl font-normal tracking-wide" style={{ fontFamily: "'Billabong', cursive" }}>Feeds</h1>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5">
        <NavItem
          href="/"
          icon={<Home className="h-6 w-6" strokeWidth={pathname === "/" ? 2.5 : 1.5} />}
          label="Home"
          active={pathname === "/"}
          collapsed={collapsed}
        />
        <NavItem
          href="/search"
          icon={<Search className="h-6 w-6" strokeWidth={pathname === "/search" ? 2.5 : 1.5} />}
          label="Search"
          active={pathname === "/search"}
          collapsed={collapsed}
        />
        <NavItem
          href="/videos"
          icon={<Film className="h-6 w-6" strokeWidth={1.5} />}
          label="Videos"
          badge="Coming Soon"
          disabled={true}
          collapsed={collapsed}
        />
        <NavItem
          href="/dm"
          icon={<MessageCircle className="h-6 w-6" strokeWidth={pathname?.startsWith("/dm") ? 2.5 : 1.5} />}
          label="Messages"
          active={pathname?.startsWith("/dm")}
          collapsed={collapsed}
        />
        <NavItem
          href="/profile"
          icon={<User className="h-6 w-6" strokeWidth={pathname === "/profile" ? 2.5 : 1.5} />}
          label="Profile"
          active={pathname === "/profile"}
          collapsed={collapsed}
        />
      </nav>

      {/* More at bottom */}
      <div className="mt-auto space-y-0.5">
        <UserSection collapsed={collapsed} />
      </div>
    </aside>
  );
}

function UserSection({ collapsed }: { collapsed: boolean }) {
  const handleSignOut = () => {
    window.location.href = "/handler/sign-out";
  };

  return (
    <div className={cn("flex flex-col gap-1", collapsed && "items-center")}>
      {/* Sign Out Button */}
      <button
        onClick={handleSignOut}
        className={cn(
          "flex items-center gap-4 px-3 py-3 my-0.5 rounded-lg transition-all hover:bg-[#efefef] dark:hover:bg-[#262626] w-full text-left",
          collapsed && "justify-center"
        )}
      >
        <LogOut className="h-6 w-6" strokeWidth={1.5} />
        {!collapsed && <span className="text-[16px]">Log out</span>}
      </button>
    </div>
  );
}
