import {
  Bot,
  BookOpenText,
  Building2,
  ChartNoAxesCombined,
  FolderSearch,
  LayoutDashboard,
  MapPinned,
  Rocket,
  Settings,
  Users
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { TenantSubscriptionPlan } from "@propertyflow/contracts";

export interface AgencyNavigationItem {
  href: string;
  icon: LucideIcon;
  label: string;
  status: "live" | "next";
  plans: readonly TenantSubscriptionPlan[];
}

const allPlans: readonly TenantSubscriptionPlan[] = ["starter", "growth", "enterprise"];
const crmPlans: readonly TenantSubscriptionPlan[] = ["growth", "enterprise"];

export const agencyNavigationItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard", plans: allPlans, status: "live" },
  { href: "/setup", icon: Rocket, label: "Starter setup", plans: allPlans, status: "live" },
  { href: "/knowledge", icon: BookOpenText, label: "Knowledge", plans: allPlans, status: "live" },
  { href: "/listings", icon: Building2, label: "Listings", plans: allPlans, status: "live" },
  { href: "/projects", icon: MapPinned, label: "Projects", plans: allPlans, status: "live" },
  { href: "/settings", icon: Settings, label: "Settings", plans: allPlans, status: "live" },
  { href: "/leads", icon: Users, label: "Leads", plans: crmPlans, status: "live" },
  { href: "/saved-searches", icon: FolderSearch, label: "Saved searches", plans: crmPlans, status: "live" },
  { href: "/ai-tools", icon: Bot, label: "AI tools", plans: crmPlans, status: "live" },
  { href: "/analytics", icon: ChartNoAxesCombined, label: "Analytics", plans: crmPlans, status: "live" }
] satisfies AgencyNavigationItem[];

const agencyTopbarQuickLinks = [
  { href: "/setup", label: "Starter setup", plans: allPlans },
  { href: "/knowledge", label: "Knowledge", plans: allPlans },
  { href: "/listings", label: "Inventory", plans: allPlans },
  { href: "/projects", label: "Projects", plans: allPlans },
  { href: "/settings", label: "Widget setup", plans: allPlans },
  { href: "/leads", label: "Lead queue", plans: crmPlans },
  { href: "/saved-searches", label: "Saved demand", plans: crmPlans },
  { href: "/ai-tools", label: "AI tools", plans: crmPlans }
] as const;

export function getAgencyNavigationItems(plan: TenantSubscriptionPlan): AgencyNavigationItem[] {
  return agencyNavigationItems.filter((item) => item.plans.includes(plan));
}

export function getAgencyTopbarQuickLinks(plan: TenantSubscriptionPlan) {
  return agencyTopbarQuickLinks.filter((link) => link.plans.includes(plan));
}

export function isAgencyNavigationItemActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
