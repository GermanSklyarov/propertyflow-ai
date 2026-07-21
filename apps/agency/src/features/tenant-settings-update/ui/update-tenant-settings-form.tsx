import { Bot, CheckCircle2, Globe2, Palette, Save } from "lucide-react";
import { updateTenantSettingsAction } from "@entities/tenant/api/tenant-actions";
import { getTenantWidgetSettings, supportedTenantWidgetLanguageOptions } from "@entities/tenant/model/widget-settings";
import type { TenantSnapshot } from "@propertyflow/contracts";
import styles from "./update-tenant-settings-form.module.css";

const markets = [
  { label: "Pattaya", value: "pattaya" },
  { label: "Phuket", value: "phuket" },
  { label: "Bangkok", value: "bangkok" },
  { label: "Hua Hin", value: "hua-hin" },
  { label: "Koh Samui", value: "koh-samui" }
];

export function UpdateTenantSettingsForm({
  saved,
  tenant
}: {
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

      <section className={styles.section} id="concierge-personality-settings">
        <div className={styles.sectionTitle}>
          <Bot size={16} />
          AI Concierge personality
        </div>
        <div className={styles.fieldGrid}>
          <label className={styles.field}>
            <span>AI name</span>
            <input defaultValue={widgetSettings.aiName} name="aiName" required />
          </label>
        </div>
        <div className={styles.field}>
          <span>Languages</span>
          <div className={styles.languageOptions}>
            {supportedTenantWidgetLanguageOptions.map((language) => (
              <label className={styles.languageOption} key={language.value}>
                <input defaultChecked={widgetSettings.languages.includes(language.value)} name="languages" type="checkbox" value={language.value} />
                <span>{language.label}</span>
                <strong>{language.value.toUpperCase()}</strong>
              </label>
            ))}
          </div>
        </div>
        <div className={styles.localizedMessages}>
          {supportedTenantWidgetLanguageOptions.map((language) => (
            <label className={styles.field} key={language.value}>
              <span>{language.label} welcome message</span>
              <textarea
                defaultValue={widgetSettings.welcomeMessages[language.value] ?? widgetSettings.welcomeMessage}
                name={`welcomeMessage.${language.value}`}
                required={widgetSettings.languages.includes(language.value)}
                rows={3}
              />
            </label>
          ))}
        </div>
        <p className={styles.hint}>
          The widget can read the site locale from its embed attribute and pick the matching welcome message. Unsupported languages stay hidden until we add them.
        </p>
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
