"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Bot,
  Building2,
  ChartNoAxesCombined,
  DatabaseZap,
  FolderSearch,
  LayoutDashboard,
  Search,
  Settings,
  Users,
} from "lucide-react";
import styles from "./agency-shell.module.css";

const navigationItems = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard", status: "live" },
  { href: "/leads", icon: Users, label: "Leads", status: "live" },
  { href: "/listings", icon: Building2, label: "Listings", status: "live" },
  { href: "/saved-searches", icon: FolderSearch, label: "Saved searches", status: "live" },
  { href: "/ai-tools", icon: Bot, label: "AI tools", status: "live" },
  { href: "/analytics", icon: ChartNoAxesCombined, label: "Analytics", status: "live" },
  { href: "/settings", icon: Settings, label: "Settings", status: "live" },
];

export function AgencyShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className={styles.root}>
      <div className={styles.layout}>
        <aside className={styles.sidebar} aria-label="Agency navigation">
          <div className={styles.brand}>
            <span className={styles.brandMark}>PropertyFlow</span>
            <span className={styles.brandName}>Agency OS</span>
          </div>

          <div className={styles.tenantCard}>
            <span className={styles.tenantLabel}>Workspace</span>
            <strong className={styles.tenantName}>Demo Thailand Realty</strong>
            <div className={styles.roleRow}>
              <span className={styles.rolePill}>manager</span>
              <span className={styles.rolePill}>multi-tenant</span>
            </div>
          </div>

          <nav className={styles.nav}>
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isLive = item.status === "live";
              const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

              return isLive ? (
                <Link
                  className={`${styles.navItem} ${isActive ? styles.navItemActive : styles.navItemLive}`}
                  href={item.href}
                  key={item.href}
                >
                  <Icon size={17} />
                  <span>{item.label}</span>
                  <span className={styles.navBadge}>Live</span>
                </Link>
              ) : (
                <span
                  aria-disabled="true"
                  className={`${styles.navItem} ${styles.navItemMuted}`}
                  key={item.href}
                >
                  <Icon size={17} />
                  <span>{item.label}</span>
                  <span className={styles.navBadge}>Next</span>
                </span>
              );
            })}
          </nav>
        </aside>

        <div className={styles.main}>
          <header className={styles.topbar}>
            <div className={styles.searchStub}>
              <Search size={16} />
              <span>Search leads, saved searches, listings...</span>
            </div>
            <div className={styles.topbarActions}>
              <span className={styles.actionButton}>
                <DatabaseZap size={16} />
                API connected
              </span>
              <span className={styles.actionButton}>
                <Bell size={16} />7 follow-ups
              </span>
            </div>
          </header>
          {children}
        </div>
      </div>
    </div>
  );
}
