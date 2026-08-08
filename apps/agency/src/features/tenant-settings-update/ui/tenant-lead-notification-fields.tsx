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
  webhookVerifyToken?: string;
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
          connected={Boolean(widgetSettings.leadTelegramChatIds?.length)}
          description="Create a bot with BotFather, paste this agency bot token, then connect a recipient. PropertyFlowAI configures the webhook secret automatically."
          docsUrl="https://t.me/BotFather"
          provider="telegram"
          result={result}
          title="Telegram"
        >
          <label className={styles.field}>
            <span>Bot token</span>
            <input
              autoComplete="off"
              name="leadTelegramBotToken"
              placeholder={widgetSettings.leadTelegramBotToken ? "Saved. Paste a new token to replace." : "123456:agency-bot-token"}
              spellCheck={false}
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
          connected={Boolean(widgetSettings.leadLineRecipientIds?.length)}
          description="Paste the Channel Access Token and Channel Secret from this agency's LINE Official Account."
          docsUrl="https://developers.line.biz/console/"
          provider="line"
          result={result}
          title="LINE"
        >
          <label className={styles.field}>
            <span>Channel access token</span>
            <input
              autoComplete="off"
              name="leadLineChannelAccessToken"
              placeholder={widgetSettings.leadLineChannelAccessToken ? "Saved. Paste a new token to replace." : "LINE channel access token"}
              spellCheck={false}
            />
          </label>
          <label className={styles.field}>
            <span>Channel secret</span>
            <input
              autoComplete="off"
              name="leadLineChannelSecret"
              placeholder={widgetSettings.leadLineChannelSecret ? "Saved. Paste a new secret to replace." : "LINE channel secret"}
              spellCheck={false}
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
          connected={Boolean(widgetSettings.leadWhatsappRecipients?.length)}
          description="Use this agency's WhatsApp Cloud API app and business phone number. PropertyFlowAI generates the webhook verify token for Meta."
          docsUrl="https://developers.facebook.com/docs/whatsapp/cloud-api"
          provider="whatsapp"
          result={result}
          title="WhatsApp"
        >
          <label className={styles.field}>
            <span>Access token</span>
            <input
              autoComplete="off"
              name="leadWhatsappAccessToken"
              placeholder={widgetSettings.leadWhatsappAccessToken ? "Saved. Paste a new token to replace." : "WhatsApp Cloud API token"}
              spellCheck={false}
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
          <ReadonlyValue
            label="Webhook verify token"
            placeholder="Click Connect recipient to generate"
            value={
              result?.provider === "whatsapp"
                ? result.webhookVerifyToken ?? widgetSettings.leadWhatsappWebhookVerifyToken
                : widgetSettings.leadWhatsappWebhookVerifyToken
            }
          />
          <label className={styles.field}>
            <span>App secret</span>
            <input
              autoComplete="off"
              name="leadWhatsappAppSecret"
              placeholder={widgetSettings.leadWhatsappAppSecret ? "Saved. Paste a new secret to replace." : "WhatsApp app secret"}
              spellCheck={false}
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
    </div>
  );
}

function ReadonlyValue({ label, placeholder, value }: { label: string; placeholder: string; value?: string }) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <input readOnly aria-label={label} placeholder={placeholder} value={value ?? ""} />
    </label>
  );
}

function ProviderPanel({
  children,
  connected,
  description,
  docsUrl,
  provider,
  result,
  title
}: {
  children: ReactNode;
  connected?: boolean;
  description: string;
  docsUrl: string;
  provider: TenantNotificationProvider;
  result?: NotificationActionResult;
  title: string;
}) {
  const activeResult = result?.provider === provider ? result : undefined;
  const connectAction = beginNotificationProviderConnectionAction.bind(null, provider);
  const testAction = sendNotificationProviderTestAction.bind(null, provider);
  const verifyAction = verifyNotificationProviderAction.bind(null, provider);

  return (
    <section className={styles.providerPanel}>
      <div className={styles.providerHeader}>
        <MessageCircle size={16} />
        <span>{title}</span>
        {activeResult?.status === "connected" || connected ? <CheckCircle2 size={16} /> : null}
      </div>
      <p className={styles.providerDescription}>{description}</p>
      <a className={styles.providerLink} href={docsUrl} rel="noreferrer" target="_blank">
        Open setup console
        <ExternalLink size={14} />
      </a>
      {children}
      <div className={styles.providerActions}>
        <button formAction={verifyAction} formNoValidate type="submit">
          <ShieldCheck size={15} />
          Verify
        </button>
        <button formAction={connectAction} formNoValidate type="submit">
          <KeyRound size={15} />
          Connect recipient
        </button>
        <button formAction={testAction} formNoValidate type="submit">
          <Send size={15} />
          Send test
        </button>
      </div>
    </section>
  );
}

function NotificationResult({ result }: { result: NotificationActionResult }) {
  if (result.action === "connect" && result.status === "connected") {
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
  const expiresAt = result.expiresAt ? new Date(result.expiresAt).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" }) : undefined;

  return (
    <div className={styles.notificationConnect} role="status">
      <KeyRound size={16} />
      <span>
        <strong>{getConnectionTitle(result, provider)}</strong>
        <small>{expiresAt ? `Connection code expires ${expiresAt}.` : "Connection code is ready."}</small>
        {result.webhookUrl || result.webhookVerifyToken ? (
          <div className={styles.notificationSetupGrid}>
            {result.webhookUrl && result.provider !== "telegram" ? <SetupValue label="Webhook URL" value={result.webhookUrl} /> : null}
            {result.webhookVerifyToken ? <SetupValue label="Verify token" value={result.webhookVerifyToken} /> : null}
          </div>
        ) : null}
      </span>
    </div>
  );
}

function SetupValue({ label, value }: { label: string; value: string }) {
  return (
    <label className={styles.notificationSetupField}>
      <span>{label}</span>
      <input readOnly value={value} />
    </label>
  );
}

function getConnectionTitle(result: NotificationActionResult, provider: string): string {
  if (result.provider === "telegram") {
    return `Telegram webhook configured. Send ${result.code} to the agency bot.`;
  }

  if (result.provider === "whatsapp") {
    return `Connect ${provider}: add webhook details in Meta, then send ${result.code}.`;
  }

  return `Connect ${provider}: add webhook URL, then send ${result.code} to the agency bot.`;
}
