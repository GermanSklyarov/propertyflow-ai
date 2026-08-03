import {
  Bot,
  BookOpenText,
  Building2,
  ChartNoAxesCombined,
  FolderSearch,
  LayoutDashboard,
  MapPinned,
  MessageCircle,
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
  plans: readonly TenantSubscriptionPlan[];
}

export interface AgencyUpgradeCta {
  description: string;
  href: string;
  label: string;
  title: string;
}

const allPlans: readonly TenantSubscriptionPlan[] = ["starter", "growth", "enterprise"];
const crmPlans: readonly TenantSubscriptionPlan[] = ["growth", "enterprise"];

export const agencyNavigationItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard", plans: crmPlans },
  { href: "/setup", icon: Rocket, label: "Starter setup", plans: allPlans },
  { href: "/knowledge", icon: BookOpenText, label: "Knowledge", plans: allPlans },
  { href: "/listings", icon: Building2, label: "Listings", plans: crmPlans },
  { href: "/projects", icon: MapPinned, label: "Projects", plans: crmPlans },
  { href: "/widget-demo", icon: MessageCircle, label: "Widget demo", plans: allPlans },
  { href: "/settings", icon: Settings, label: "Settings", plans: allPlans },
  { href: "/leads", icon: Users, label: "Leads", plans: crmPlans },
  { href: "/saved-searches", icon: FolderSearch, label: "Saved searches", plans: crmPlans },
  { href: "/ai-tools", icon: Bot, label: "AI tools", plans: crmPlans },
  { href: "/analytics", icon: ChartNoAxesCombined, label: "Analytics", plans: crmPlans }
] satisfies AgencyNavigationItem[];

const agencyTopbarQuickLinks = [
  { href: "/setup", label: "Starter setup", plans: allPlans },
  { href: "/knowledge", label: "Knowledge", plans: allPlans },
  { href: "/widget-demo", label: "Preview widget", plans: allPlans },
  { href: "/settings", label: "Widget setup", plans: allPlans },
  { href: "/listings", label: "Inventory", plans: crmPlans },
  { href: "/projects", label: "Projects", plans: crmPlans },
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

export function getAgencyUpgradeCta(plan: TenantSubscriptionPlan): AgencyUpgradeCta | null {
  if (plan !== "starter") {
    return null;
  }

  return {
    description: "Growth unlocks lead handoff, assignment, and pipeline work.",
    href: "/setup?plan=growth",
    label: "Start Growth",
    title: "Turn Concierge conversations into CRM leads"
  };
}

export function isAgencyNavigationItemActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
