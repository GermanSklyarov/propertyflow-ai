import {
  Bot,
  BookOpenText,
  Building2,
  ChartNoAxesCombined,
  FolderSearch,
  LayoutDashboard,
  MapPinned,
  Settings,
  Users
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface AgencyNavigationItem {
  href: string;
  icon: LucideIcon;
  label: string;
  status: "live" | "next";
}

export const agencyNavigationItems = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard", status: "live" },
  { href: "/leads", icon: Users, label: "Leads", status: "live" },
  { href: "/listings", icon: Building2, label: "Listings", status: "live" },
  { href: "/projects", icon: MapPinned, label: "Projects", status: "live" },
  { href: "/saved-searches", icon: FolderSearch, label: "Saved searches", status: "live" },
  { href: "/knowledge", icon: BookOpenText, label: "Knowledge", status: "live" },
  { href: "/ai-tools", icon: Bot, label: "AI tools", status: "live" },
  { href: "/analytics", icon: ChartNoAxesCombined, label: "Analytics", status: "live" },
  { href: "/settings", icon: Settings, label: "Settings", status: "live" }
] satisfies AgencyNavigationItem[];

export const agencyTopbarQuickLinks = [
  { href: "/leads", label: "Lead queue" },
  { href: "/listings", label: "Inventory" },
  { href: "/projects", label: "Projects" },
  { href: "/saved-searches", label: "Saved demand" },
  { href: "/knowledge", label: "Knowledge" },
  { href: "/ai-tools", label: "AI tools" }
] as const;

export function isAgencyNavigationItemActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
