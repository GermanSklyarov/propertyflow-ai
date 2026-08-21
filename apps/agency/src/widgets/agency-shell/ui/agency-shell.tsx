"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowRight,
  Bell,
  DatabaseZap,
  LogOut
} from "lucide-react";
import type { TenantSubscriptionPlan } from "@propertyflow/contracts";
import {
  getAgencyNavigationItems,
  getAgencyTopbarQuickLinks,
  getAgencyUpgradeCta,
  isAgencyNavigationItemActive
} from "@shared/navigation/agency-navigation";
import { PropertyFlowBrand } from "@shared/ui/propertyflow-brand";
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
  const upgradeCta = getAgencyUpgradeCta(subscriptionPlan);
  const planLabel = subscriptionPlan.charAt(0).toUpperCase() + subscriptionPlan.slice(1);
  const shouldShowLogout = isAuthenticated || !isEntryRoute;

  if (isEntryRoute) {
    return <div className={styles.entryRoot}>{children}</div>;
  }

  return (
    <div className={styles.root}>
      <div className={styles.layout}>
        <aside className={styles.sidebar} aria-label="Agency navigation">
          <div className={styles.brand}>
            <PropertyFlowBrand
              className={styles.brandLogo}
              markClassName={styles.brandMark}
              wordmarkClassName={styles.brandWordmark}
            />
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
              const isActive = isAgencyNavigationItemActive(pathname, item.href);

              return (
                <Link
                  className={`${styles.navItem} ${isActive ? styles.navItemActive : styles.navItemLink}`}
                  href={item.href}
                  key={item.href}
                >
                  <Icon size={17} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {upgradeCta ? (
            <Link className={styles.upgradeCard} href={upgradeCta.href}>
              <span className={styles.upgradeEyebrow}>Upgrade path</span>
              <strong>{upgradeCta.title}</strong>
              <span>{upgradeCta.description}</span>
              <span className={styles.upgradeLink}>
                {upgradeCta.label}
                <ArrowRight size={15} />
              </span>
            </Link>
          ) : null}
        </aside>

        <div className={styles.main}>
          <header className={styles.topbar}>
            <nav className={styles.quickNav} aria-label="Agency quick links">
              {quickLinks.map((link) => (
                <Link
                  className={`${styles.quickLink} ${
                    isAgencyNavigationItemActive(pathname, link.href) ? styles.quickLinkActive : ""
                  }`}
                  href={link.href}
                  key={link.href}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className={styles.topbarActions}>
              <span className={styles.actionButton}>
                <DatabaseZap size={16} />
                {subscriptionPlan === "starter" ? "Widget ready" : "API connected"}
              </span>
              {subscriptionPlan !== "starter" ? (
                <Link className={styles.actionLink} href="/leads">
                  <Bell size={16} />7 follow-ups
                </Link>
              ) : null}
              {shouldShowLogout ? (
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
