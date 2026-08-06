import { BadgeCheck, BellRing, Bot, CheckCircle2, Globe2, Palette, Save, ShieldCheck } from "lucide-react";
import { updateTenantSettingsAction } from "@entities/tenant/api/tenant-actions";
import { getTenantWidgetSettings, leadQualificationFieldOptions } from "@entities/tenant/model/widget-settings";
import type { TenantSnapshot } from "@propertyflow/contracts";
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
        <label className={styles.toggleField}>
          <input defaultChecked={widgetSettings.leadNotificationsEnabled} name="leadNotificationsEnabled" type="checkbox" />
          <span>
            <strong>Notify agency when Concierge creates a qualified lead</strong>
            <small>Email uses PropertyFlowAI email delivery. Messenger channels use this agency workspace's own bot credentials.</small>
          </span>
        </label>
        <div className={styles.fieldGrid}>
          <label className={styles.field}>
            <span>Email recipients</span>
            <textarea
              defaultValue={widgetSettings.leadNotificationEmails?.join("\n") ?? ""}
              name="leadNotificationEmails"
              placeholder="owner@agency.com"
              rows={3}
            />
          </label>
          <label className={styles.field}>
            <span>Webhook URL</span>
            <input
              defaultValue={widgetSettings.leadWebhookUrl ?? ""}
              name="leadWebhookUrl"
              pattern="^$|^https://.+"
              placeholder="https://agency.com/webhooks/propertyflow-leads"
            />
          </label>
          <label className={styles.field}>
            <span>Telegram bot token</span>
            <input
              name="leadTelegramBotToken"
              placeholder={widgetSettings.leadTelegramBotToken ? "Saved. Paste a new token to replace." : "Create a bot with BotFather and paste the token"}
              type="password"
            />
          </label>
          <label className={styles.field}>
            <span>Telegram chat IDs</span>
            <textarea
              defaultValue={widgetSettings.leadTelegramChatIds?.join("\n") ?? ""}
              name="leadTelegramChatIds"
              placeholder="-1001234567890"
              rows={3}
            />
          </label>
          <label className={styles.field}>
            <span>LINE channel access token</span>
            <input
              name="leadLineChannelAccessToken"
              placeholder={widgetSettings.leadLineChannelAccessToken ? "Saved. Paste a new token to replace." : "Paste this agency LINE channel access token"}
              type="password"
            />
          </label>
          <label className={styles.field}>
            <span>LINE recipient IDs</span>
            <textarea
              defaultValue={widgetSettings.leadLineRecipientIds?.join("\n") ?? ""}
              name="leadLineRecipientIds"
              placeholder="U4af4980629..."
              rows={3}
            />
          </label>
          <label className={styles.field}>
            <span>WhatsApp access token</span>
            <input
              name="leadWhatsappAccessToken"
              placeholder={widgetSettings.leadWhatsappAccessToken ? "Saved. Paste a new token to replace." : "Paste this agency WhatsApp Cloud API token"}
              type="password"
            />
          </label>
          <label className={styles.field}>
            <span>WhatsApp phone number ID</span>
            <input
              defaultValue={widgetSettings.leadWhatsappPhoneNumberId ?? ""}
              name="leadWhatsappPhoneNumberId"
              placeholder="123456789012345"
            />
          </label>
          <label className={styles.field}>
            <span>WhatsApp Graph API version</span>
            <input
              defaultValue={widgetSettings.leadWhatsappGraphApiVersion ?? "v20.0"}
              name="leadWhatsappGraphApiVersion"
              pattern="^v[0-9]+[.][0-9]+$"
              placeholder="v20.0"
            />
          </label>
          <label className={styles.field}>
            <span>WhatsApp recipients</span>
            <textarea
              defaultValue={widgetSettings.leadWhatsappRecipients?.join("\n") ?? ""}
              name="leadWhatsappRecipients"
              placeholder="+66812345678"
              rows={3}
            />
          </label>
        </div>
        <p className={styles.hint}>Create the agency's own Telegram bot, LINE channel, or WhatsApp Cloud API app, then paste credentials here. Blank secret fields keep the saved value.</p>
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
