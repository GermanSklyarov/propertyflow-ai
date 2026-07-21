import type { TenantSnapshot, TenantWidgetLanguage } from "@propertyflow/contracts";

export const supportedTenantWidgetLanguageOptions: Array<{ label: string; value: TenantWidgetLanguage }> = [
  { label: "English", value: "en" },
  { label: "Русский", value: "ru" },
  { label: "ไทย", value: "th" },
  { label: "中文", value: "zh" }
];

export const defaultTenantWidgetSettings: TenantSnapshot["widget"] = {
  aiName: "Anna",
  aiNames: {
    en: "Anna",
    ru: "Анна",
    th: "มาลี",
    zh: "安娜"
  },
  languages: ["en", "ru", "th", "zh"],
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
    th: "สวัสดีค่ะ ฉันชื่อ Anna ผู้ช่วย AI ด้านอสังหาริมทรัพย์ของคุณ",
    zh: "你好！我是 Anna，你的 AI 房产顾问。"
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
    languages: tenant.widget?.languages?.length ? tenant.widget.languages : defaultTenantWidgetSettings.languages,
    personaGenders: {
      ...defaultTenantWidgetSettings.personaGenders,
      ...tenant.widget?.personaGenders
    },
    tone: tenant.widget?.tone ?? defaultTenantWidgetSettings.tone,
    welcomeMessage: tenant.widget?.welcomeMessage || welcomeMessages.en || defaultTenantWidgetSettings.welcomeMessage,
    welcomeMessages
  };
}
