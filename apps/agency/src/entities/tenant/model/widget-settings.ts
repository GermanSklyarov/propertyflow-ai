import type { TenantLeadQualificationField, TenantSnapshot, TenantWidgetLanguage } from "@propertyflow/contracts";
import { supportedLeadQualificationFields } from "@propertyflow/contracts";
import { defaultWidgetListingUrlTemplate } from "./widget-listing-links";

export const supportedTenantWidgetLanguageOptions: Array<{ label: string; value: TenantWidgetLanguage }> = [
  { label: "English", value: "en" },
  { label: "Русский", value: "ru" },
  { label: "ไทย", value: "th" },
  { label: "中文", value: "zh" }
];

export const leadQualificationFieldOptions: Array<{
  description: string;
  label: string;
  value: TenantLeadQualificationField;
}> = [
  { description: "Target price range or maximum budget.", label: "Budget", value: "budget" },
  { description: "Neighborhood, city, or project area.", label: "Preferred area", value: "preferredArea" },
  { description: "Desired bedroom count.", label: "Bedrooms", value: "bedrooms" },
  { description: "Investment, relocation, holiday home, or rental purpose.", label: "Investment purpose", value: "investmentPurpose" },
  { description: "Expected visit, purchase, rental, or move-in timing.", label: "Move-in date", value: "moveInDate" },
  { description: "Buyer nationality when relevant for process guidance.", label: "Nationality", value: "nationality" },
  { description: "Mortgage, cash purchase, or other financing needs.", label: "Financing", value: "financing" },
  { description: "WhatsApp contact for agent follow-up.", label: "WhatsApp", value: "whatsapp" },
  { description: "Email contact for the lead handoff.", label: "Email", value: "email" },
  { description: "Phone contact for the lead handoff.", label: "Phone", value: "phone" }
];

export const defaultLeadQualificationFields: TenantLeadQualificationField[] = supportedLeadQualificationFields.filter(
  (field) => field !== "nationality"
);

export const defaultTenantWidgetSettings: TenantSnapshot["widget"] = {
  aiName: "Anna",
  aiNames: {
    en: "Anna",
    ru: "Анна",
    th: "มาลี",
    zh: "安娜"
  },
  allowedOrigins: [],
  languages: ["en", "ru", "th", "zh"],
  leadNotificationEmails: [],
  leadNotificationsEnabled: true,
  leadWebhookUrl: undefined,
  leadLineChannelAccessToken: undefined,
  leadLineRecipientIds: [],
  leadTelegramBotToken: undefined,
  leadTelegramChatIds: [],
  leadWhatsappAccessToken: undefined,
  leadWhatsappGraphApiVersion: "v20.0",
  leadWhatsappPhoneNumberId: undefined,
  leadWhatsappRecipients: [],
  leadQualificationFields: defaultLeadQualificationFields,
  listingUrlTemplate: defaultWidgetListingUrlTemplate,
  personaGenders: {
    en: "feminine",
    ru: "feminine",
    th: "feminine",
    zh: "neutral"
  },
  tone: "friendly",
  welcomeMessage: "Hi! I'm Anna, your AI property consultant.",
  welcomeMessages: {
    en: "Hi! I'm Anna, your AI property consultant.",
    ru: "Привет! Я Анна, ваш AI-консультант по недвижимости.",
    th: "สวัสดีค่ะ ฉันชื่อมาลี ผู้ช่วย AI ด้านอสังหาริมทรัพย์ของคุณ",
    zh: "你好！我是安娜，你的 AI 房产顾问。"
  }
};

export function getTenantWidgetSettings(tenant: TenantSnapshot): TenantSnapshot["widget"] {
  const welcomeMessages = {
    ...defaultTenantWidgetSettings.welcomeMessages,
    ...tenant.widget?.welcomeMessages
  };
  const aiNames = {
    ...defaultTenantWidgetSettings.aiNames,
    ...tenant.widget?.aiNames
  };

  return {
    aiName: tenant.widget?.aiName || aiNames.en || defaultTenantWidgetSettings.aiName,
    aiNames,
    allowedOrigins: tenant.widget?.allowedOrigins ?? defaultTenantWidgetSettings.allowedOrigins,
    languages: tenant.widget?.languages?.length ? tenant.widget.languages : defaultTenantWidgetSettings.languages,
    leadNotificationEmails: tenant.widget?.leadNotificationEmails ?? defaultTenantWidgetSettings.leadNotificationEmails,
    leadNotificationsEnabled: tenant.widget?.leadNotificationsEnabled ?? defaultTenantWidgetSettings.leadNotificationsEnabled,
    leadWebhookUrl: tenant.widget?.leadWebhookUrl ?? defaultTenantWidgetSettings.leadWebhookUrl,
    leadLineChannelAccessToken: tenant.widget?.leadLineChannelAccessToken ?? defaultTenantWidgetSettings.leadLineChannelAccessToken,
    leadLineRecipientIds: tenant.widget?.leadLineRecipientIds ?? defaultTenantWidgetSettings.leadLineRecipientIds,
    leadTelegramBotToken: tenant.widget?.leadTelegramBotToken ?? defaultTenantWidgetSettings.leadTelegramBotToken,
    leadTelegramChatIds: tenant.widget?.leadTelegramChatIds ?? defaultTenantWidgetSettings.leadTelegramChatIds,
    leadWhatsappAccessToken: tenant.widget?.leadWhatsappAccessToken ?? defaultTenantWidgetSettings.leadWhatsappAccessToken,
    leadWhatsappGraphApiVersion: tenant.widget?.leadWhatsappGraphApiVersion ?? defaultTenantWidgetSettings.leadWhatsappGraphApiVersion,
    leadWhatsappPhoneNumberId: tenant.widget?.leadWhatsappPhoneNumberId ?? defaultTenantWidgetSettings.leadWhatsappPhoneNumberId,
    leadWhatsappRecipients: tenant.widget?.leadWhatsappRecipients ?? defaultTenantWidgetSettings.leadWhatsappRecipients,
    leadQualificationFields: tenant.widget?.leadQualificationFields?.length
      ? tenant.widget.leadQualificationFields
      : defaultTenantWidgetSettings.leadQualificationFields,
    listingUrlTemplate: tenant.widget?.listingUrlTemplate ?? defaultTenantWidgetSettings.listingUrlTemplate,
    personaGenders: {
      ...defaultTenantWidgetSettings.personaGenders,
      ...tenant.widget?.personaGenders
    },
    tone: tenant.widget?.tone ?? defaultTenantWidgetSettings.tone,
    welcomeMessage: tenant.widget?.welcomeMessage || welcomeMessages.en || defaultTenantWidgetSettings.welcomeMessage,
    welcomeMessages
  };
}
