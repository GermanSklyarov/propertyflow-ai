"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  DatabaseZap,
  LogOut,
  Search,
} from "lucide-react";
import type { TenantSubscriptionPlan } from "@propertyflow/contracts";
import {
  getAgencyNavigationItems,
  getAgencyTopbarQuickLinks,
  isAgencyNavigationItemActive
} from "@shared/navigation/agency-navigation";
import { submitAgencyLogout } from "../api/session-actions";
import styles from "./agency-shell.module.css";

export function AgencyShell({
  children,
  isAuthenticated = false,
  subscriptionPlan = "starter"
}: {
  children: React.ReactNode;
  isAuthenticated?: boolean;
  subscriptionPlan?: TenantSubscriptionPlan;
}) {
  const pathname = usePathname();
  const isEntryRoute = pathname === "/" || pathname.startsWith("/signup") || pathname.startsWith("/signin");
  const navigationItems = getAgencyNavigationItems(subscriptionPlan);
  const quickLinks = getAgencyTopbarQuickLinks(subscriptionPlan);
  const planLabel = subscriptionPlan.charAt(0).toUpperCase() + subscriptionPlan.slice(1);

  if (isEntryRoute) {
    return <div className={styles.entryRoot}>{children}</div>;
  }

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
              <span className={styles.rolePill}>{planLabel}</span>
              <span className={styles.rolePill}>{subscriptionPlan === "starter" ? "AI first" : "CRM enabled"}</span>
            </div>
          </div>

          <nav className={styles.nav}>
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isLive = item.status === "live";
              const isActive = isAgencyNavigationItemActive(pathname, item.href);

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
            <nav className={styles.quickNav} aria-label="Agency quick links">
              <span className={styles.quickNavLabel}>
                <Search size={16} />
                Quick jump
              </span>
              {quickLinks.map((link) => (
                <Link className={styles.quickLink} href={link.href} key={link.href}>
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className={styles.topbarActions}>
              <span className={styles.actionButton}>
                <DatabaseZap size={16} />
                {subscriptionPlan === "starter" ? "Widget ready" : "API connected"}
              </span>
              {subscriptionPlan === "starter" ? (
                <span className={styles.actionButton}>
                  <Bell size={16} />
                  Starter setup
                </span>
              ) : (
                <span className={styles.actionButton}>
                  <Bell size={16} />7 follow-ups
                </span>
              )}
              {isAuthenticated ? (
                <form action={submitAgencyLogout}>
                  <button aria-label="Logout" className={styles.logoutButton} title="Logout" type="submit">
                    <LogOut size={16} />
                  </button>
                </form>
              ) : null}
            </div>
          </header>
          {children}
        </div>
      </div>
    </div>
  );
}
