import type { TenantSnapshot, TenantUsageResponse } from "@propertyflow/contracts";
import { TenantSettingsPanel } from "@widgets/tenant-settings/ui/tenant-settings-panel";
import styles from "./settings-page.module.css";

export function SettingsPage({
  settingsSaved,
  tenant,
  usage
}: {
  settingsSaved?: boolean;
  tenant: TenantSnapshot;
  usage: TenantUsageResponse;
}) {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <p className="section-kicker">Workspace settings</p>
            <h1 className={styles.title}>{tenant.branding.displayName}</h1>
            <p className={styles.subtitle}>
              Launch an AI property consultant first. Knowledge, widget, and assistant personality come before CRM complexity.
            </p>
          </div>
          <span className={styles.statusBadge}>{tenant.status}</span>
        </header>

        <TenantSettingsPanel saved={settingsSaved} tenant={tenant} usage={usage} />
      </div>
    </main>
  );
}
