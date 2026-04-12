"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  TrendingUp,
  Star,
  Receipt,
  Newspaper,
  Settings,
  ChevronLeft,
  ChevronRight,
  Zap,
  BarChart2,
} from "lucide-react";
import { useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/markets", label: "Markets", icon: TrendingUp },
  { href: "/portfolio", label: "Portfolio", icon: BarChart2 },
  { href: "/watchlist", label: "Watchlist", icon: Star },
  { href: "/transactions", label: "Transactions", icon: Receipt },
  { href: "/news", label: "News", icon: Newspaper },
];

const BOTTOM_ITEMS = [
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-sidebar border-r border-sidebar-border transition-all duration-300 ease-in-out z-30",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo */}
      <div className={cn(
        "flex items-center gap-3 px-4 py-5 border-b border-sidebar-border",
        collapsed && "justify-center px-0"
      )}>
        <div className="shrink-0 w-9 h-9 flex items-center justify-center">
          <Image
            src="/logo.png"
            alt="TradeIQ Logo"
            width={36}
            height={36}
            className="object-contain"
            priority
          />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="text-sidebar-foreground font-bold text-base leading-tight">TradeIQ</p>
            <p className="text-sidebar-foreground/50 text-xs">Smart Trading</p>
          </div>
        )}
      </div>

      {/* Markets tag */}
      {!collapsed && (
        <div className="mx-3 mt-3 mb-1">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bull-muted">
            <span className="w-2 h-2 rounded-full bg-bull animate-pulse" />
            <span className="text-bull text-xs font-semibold">US MARKET OPEN</span>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          return (
            <Tooltip key={href}>
              <TooltipTrigger render={
                <Link
                  href={href}
                  className={cn(
                    "group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                    isActive
                      ? "bg-primary/15 text-primary border-r-2 border-primary"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                    collapsed && "justify-center px-0"
                  )}
                >
                  <Icon className={cn("w-4.5 h-4.5 shrink-0", isActive && "text-primary")} size={18} />
                  {!collapsed && <span>{label}</span>}
                </Link>
              } />
              {collapsed && (
                <TooltipContent side="right" className="font-medium">
                  {label}
                </TooltipContent>
              )}
            </Tooltip>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="px-2 pb-3 space-y-1 border-t border-sidebar-border pt-2">
        {!collapsed && (
          <div className="px-3 py-2 mb-1">
            <div className="flex items-center gap-2 text-sidebar-foreground/50 text-xs">
              <Zap className="w-3.5 h-3.5 text-chart-5" />
              <span>Pro Plan Active</span>
            </div>
          </div>
        )}

        {BOTTOM_ITEMS.map(({ href, label, icon: Icon }) => (
          <Tooltip key={href}>
            <TooltipTrigger render={
              <Link
                href={href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                  collapsed && "justify-center px-0"
                )}
              >
                <Icon size={18} />
                {!collapsed && <span>{label}</span>}
              </Link>
            } />
            {collapsed && (
              <TooltipContent side="right">{label}</TooltipContent>
            )}
          </Tooltip>
        ))}

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
            "text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground",
            collapsed && "justify-center px-0"
          )}
        >
          {collapsed ? (
            <ChevronRight size={18} />
          ) : (
            <>
              <ChevronLeft size={18} />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
