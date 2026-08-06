import { BadgeCheck, BellRing, Bot, CheckCircle2, Globe2, Palette, Save, ShieldCheck } from "lucide-react";
import { updateTenantSettingsAction } from "@entities/tenant/api/tenant-actions";
import { getTenantWidgetSettings, leadQualificationFieldOptions } from "@entities/tenant/model/widget-settings";
import type { TenantSnapshot } from "@propertyflow/contracts";
import { TenantLeadNotificationFields, type NotificationActionResult } from "./tenant-lead-notification-fields";
import { TenantWidgetOriginFields } from "./tenant-widget-origin-fields";
import { TenantWidgetPersonaFields } from "./tenant-widget-persona-fields";
import styles from "./update-tenant-settings-form.module.css";

const markets = [
  { label: "Pattaya", value: "pattaya" },
  { label: "Phuket", value: "phuket" },
  { label: "Bangkok", value: "bangkok" },
  { label: "Hua Hin", value: "hua-hin" },
  { label: "Koh Samui", value: "koh-samui" }
];

export function UpdateTenantSettingsForm({
  notificationResult,
  saved,
  tenant
}: {
  notificationResult?: NotificationActionResult;
  saved?: boolean;
  tenant: TenantSnapshot;
}) {
  const widgetSettings = getTenantWidgetSettings(tenant);

  return (
    <form action={updateTenantSettingsAction} className={styles.form} id="tenant-settings-form">
      {saved ? (
        <div className={styles.notice} role="status">
          <CheckCircle2 size={16} />
          Settings saved
        </div>
      ) : null}

      <section className={styles.section}>
        <div className={styles.sectionTitle}>
          <Palette size={16} />
          Brand identity
        </div>
        <div className={styles.fieldGrid}>
          <label className={styles.field}>
            <span>Display name</span>
            <input defaultValue={tenant.branding.displayName} name="displayName" required />
          </label>
          <label className={styles.field}>
            <span>Primary color</span>
            <input defaultValue={tenant.branding.primaryColor ?? "#0f766e"} name="primaryColor" pattern="^#[0-9a-fA-F]{6}$" />
          </label>
          <label className={styles.field}>
            <span>Logo URL</span>
            <input defaultValue={tenant.branding.logoUrl ?? ""} name="logoUrl" placeholder="https://..." />
          </label>
          <label className={styles.field}>
            <span>Primary market</span>
            <select defaultValue={tenant.primaryMarket ?? ""} name="primaryMarket">
              <option value="">Not set</option>
              {markets.map((market) => (
                <option key={market.value} value={market.value}>
                  {market.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionTitle}>
          <Globe2 size={16} />
          Domain posture
        </div>
        <label className={styles.field}>
          <span>Custom domain</span>
          <input defaultValue={tenant.customDomain ?? ""} name="customDomain" pattern="^[a-z0-9.-]+$" placeholder="agency.example.com" />
        </label>
        <p className={styles.hint}>
          Domain verification stays backend-controlled; this form updates the requested domain and keeps the current verification status visible.
        </p>
      </section>

      <section className={styles.section} id="widget-origin-settings">
        <div className={styles.sectionTitle}>
          <ShieldCheck size={16} />
          Widget install origins
        </div>
        <TenantWidgetOriginFields customDomain={tenant.customDomain} origins={widgetSettings.allowedOrigins} />
        <label className={styles.field}>
          <span>Listing URL route</span>
          <input
            defaultValue={widgetSettings.listingUrlTemplate}
            name="listingUrlTemplate"
            pattern="^/(?!/).*:propertyId.*$"
            placeholder="/listings/:propertyId"
            required
          />
        </label>
        <p className={styles.hint}>
          Add only origins, not full listing URLs. Use `:propertyId` in the route so Concierge recommendations can link
          visitors directly to matching listings.
        </p>
      </section>

      <section className={styles.section} id="concierge-personality-settings">
        <div className={styles.sectionTitle}>
          <Bot size={16} />
          AI Concierge personality
        </div>
        <TenantWidgetPersonaFields widgetSettings={widgetSettings} />
      </section>

      <section className={styles.section} id="lead-qualification-settings">
        <div className={styles.sectionTitle}>
          <BadgeCheck size={16} />
          Lead qualification
        </div>
        <input name="leadQualificationFieldsIntent" type="hidden" value="1" />
        <div className={styles.qualificationOptions}>
          {leadQualificationFieldOptions.map((field) => (
            <label className={styles.qualificationOption} key={field.value}>
              <input
                defaultChecked={widgetSettings.leadQualificationFields.includes(field.value)}
                name="leadQualificationFields"
                type="checkbox"
                value={field.value}
              />
              <span>
                <strong>{field.label}</strong>
                <small>{field.description}</small>
              </span>
            </label>
          ))}
        </div>
        <p className={styles.hint}>Concierge uses these as natural follow-up prompts and still recommends listings when there is enough context.</p>
      </section>

      <section className={styles.section} id="lead-notification-settings">
        <div className={styles.sectionTitle}>
          <BellRing size={16} />
          Lead notifications
        </div>
        <TenantLeadNotificationFields result={notificationResult} widgetSettings={widgetSettings} />
      </section>

      <div className={styles.actions}>
        <button type="submit">
          <Save size={16} />
          Save settings
        </button>
      </div>
    </form>
  );
}
