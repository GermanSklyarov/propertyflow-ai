import { CheckCircle2, ExternalLink, KeyRound, MessageCircle, Send, ShieldCheck, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import {
  beginNotificationProviderConnectionAction,
  sendNotificationProviderTestAction,
  verifyNotificationProviderAction
} from "@entities/tenant/api/tenant-actions";
import type { TenantNotificationProvider, TenantNotificationProviderCheckStatus, TenantSnapshot } from "@propertyflow/contracts";
import styles from "./update-tenant-settings-form.module.css";

export interface NotificationActionResult {
  action: "connect" | "test" | "verify";
  code?: string;
  displayName?: string;
  error?: string;
  expiresAt?: string;
  provider: TenantNotificationProvider;
  status: TenantNotificationProviderCheckStatus;
  webhookUrl?: string;
}

const providerLabels: Record<TenantNotificationProvider, string> = {
  line: "LINE",
  telegram: "Telegram",
  whatsapp: "WhatsApp"
};

export function TenantLeadNotificationFields({
  result,
  widgetSettings
}: {
  result?: NotificationActionResult;
  widgetSettings: TenantSnapshot["widget"];
}) {
  return (
    <div className={styles.notificationStack}>
      <label className={styles.toggleField}>
        <input defaultChecked={widgetSettings.leadNotificationsEnabled} name="leadNotificationsEnabled" type="checkbox" />
        <span>
          <strong>Notify agency when Concierge creates a qualified lead</strong>
          <small>Email uses PropertyFlowAI email delivery. Messenger channels use this agency workspace's own bot credentials.</small>
        </span>
      </label>

      {result ? <NotificationResult result={result} /> : null}

      <div className={styles.notificationGrid}>
        <section className={styles.providerPanel}>
          <div className={styles.providerHeader}>
            <MessageCircle size={16} />
            <span>Email</span>
          </div>
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
        </section>

        <ProviderPanel
          description="Create a bot with BotFather, paste this agency bot token, then verify it."
          docsUrl="https://t.me/BotFather"
          provider="telegram"
          result={result}
          title="Telegram"
        >
          <label className={styles.field}>
            <span>Bot token</span>
            <input
              name="leadTelegramBotToken"
              placeholder={widgetSettings.leadTelegramBotToken ? "Saved. Paste a new token to replace." : "123456:agency-bot-token"}
              type="password"
            />
          </label>
          <label className={styles.field}>
            <span>Recipients</span>
            <textarea
              defaultValue={widgetSettings.leadTelegramChatIds?.join("\n") ?? ""}
              name="leadTelegramChatIds"
              placeholder="-1001234567890"
              rows={3}
            />
          </label>
        </ProviderPanel>

        <ProviderPanel
          description="Paste the Channel Access Token and Channel Secret from this agency's LINE Official Account."
          docsUrl="https://developers.line.biz/console/"
          provider="line"
          result={result}
          title="LINE"
        >
          <label className={styles.field}>
            <span>Channel access token</span>
            <input
              name="leadLineChannelAccessToken"
              placeholder={widgetSettings.leadLineChannelAccessToken ? "Saved. Paste a new token to replace." : "LINE channel access token"}
              type="password"
            />
          </label>
          <label className={styles.field}>
            <span>Channel secret</span>
            <input
              name="leadLineChannelSecret"
              placeholder={widgetSettings.leadLineChannelSecret ? "Saved. Paste a new secret to replace." : "LINE channel secret"}
              type="password"
            />
          </label>
          <label className={styles.field}>
            <span>Recipients</span>
            <textarea
              defaultValue={widgetSettings.leadLineRecipientIds?.join("\n") ?? ""}
              name="leadLineRecipientIds"
              placeholder="U4af4980629..."
              rows={3}
            />
          </label>
        </ProviderPanel>

        <ProviderPanel
          description="Use this agency's WhatsApp Cloud API app and business phone number."
          docsUrl="https://developers.facebook.com/docs/whatsapp/cloud-api"
          provider="whatsapp"
          result={result}
          title="WhatsApp"
        >
          <label className={styles.field}>
            <span>Access token</span>
            <input
              name="leadWhatsappAccessToken"
              placeholder={widgetSettings.leadWhatsappAccessToken ? "Saved. Paste a new token to replace." : "WhatsApp Cloud API token"}
              type="password"
            />
          </label>
          <label className={styles.field}>
            <span>Phone number ID</span>
            <input
              defaultValue={widgetSettings.leadWhatsappPhoneNumberId ?? ""}
              name="leadWhatsappPhoneNumberId"
              placeholder="123456789012345"
            />
          </label>
          <label className={styles.field}>
            <span>Graph API version</span>
            <input
              defaultValue={widgetSettings.leadWhatsappGraphApiVersion ?? "v20.0"}
              name="leadWhatsappGraphApiVersion"
              pattern="^v[0-9]+[.][0-9]+$"
              placeholder="v20.0"
            />
          </label>
          <label className={styles.field}>
            <span>Recipients</span>
            <textarea
              defaultValue={widgetSettings.leadWhatsappRecipients?.join("\n") ?? ""}
              name="leadWhatsappRecipients"
              placeholder="+66812345678"
              rows={3}
            />
          </label>
        </ProviderPanel>
      </div>
      <p className={styles.hint}>
        Next production step: replace manual recipient IDs with connect codes and provider webhooks, so agents only add the
        bot and send a one-time code.
      </p>
    </div>
  );
}

function ProviderPanel({
  children,
  description,
  docsUrl,
  provider,
  result,
  title
}: {
  children: ReactNode;
  description: string;
  docsUrl: string;
  provider: TenantNotificationProvider;
  result?: NotificationActionResult;
  title: string;
}) {
  const activeResult = result?.provider === provider ? result : undefined;

  return (
    <section className={styles.providerPanel}>
      <div className={styles.providerHeader}>
        <MessageCircle size={16} />
        <span>{title}</span>
        {activeResult?.status === "connected" ? <CheckCircle2 size={16} /> : null}
      </div>
      <p className={styles.providerDescription}>{description}</p>
      <a className={styles.providerLink} href={docsUrl} rel="noreferrer" target="_blank">
        Open setup console
        <ExternalLink size={14} />
      </a>
      {children}
      <div className={styles.providerActions}>
        <button formAction={verifyNotificationProviderAction} formNoValidate name="notificationProvider" type="submit" value={provider}>
          <ShieldCheck size={15} />
          Verify
        </button>
        <button formAction={beginNotificationProviderConnectionAction} formNoValidate name="notificationProvider" type="submit" value={provider}>
          <KeyRound size={15} />
          Connect recipient
        </button>
        <button formAction={sendNotificationProviderTestAction} formNoValidate name="notificationProvider" type="submit" value={provider}>
          <Send size={15} />
          Send test
        </button>
      </div>
    </section>
  );
}

function NotificationResult({ result }: { result: NotificationActionResult }) {
  if (result.action === "connect") {
    return <NotificationConnectResult result={result} />;
  }

  const connected = result.status === "connected";
  const actionLabel = result.action === "test" ? "Test message" : "Connection";
  const provider = providerLabels[result.provider];

  return (
    <div className={connected ? styles.notificationSuccess : styles.notificationWarning} role="status">
      {connected ? <CheckCircle2 size={16} /> : <TriangleAlert size={16} />}
      <span>
        <strong>
          {actionLabel}: {provider} {connected ? "connected" : "needs attention"}
        </strong>
        <small>{connected ? result.displayName || "Provider accepted the request." : result.error || result.status}</small>
      </span>
    </div>
  );
}

function NotificationConnectResult({ result }: { result: NotificationActionResult }) {
  const provider = providerLabels[result.provider];

  return (
    <div className={styles.notificationConnect} role="status">
      <KeyRound size={16} />
      <span>
        <strong>
          Connect {provider}: send {result.code} to the agency bot
        </strong>
        <small>
          Webhook URL: {result.webhookUrl}
          {result.expiresAt ? ` · Code expires ${new Date(result.expiresAt).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" })}` : ""}
        </small>
      </span>
    </div>
  );
}
