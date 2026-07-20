import type { TenantSnapshot } from "@propertyflow/contracts";

export const defaultTenantWidgetSettings: TenantSnapshot["widget"] = {
  aiName: "Anna",
  languages: ["en", "ru", "th", "zh"],
  welcomeMessage: "Hi! I'm Anna, your AI property consultant."
};

export function getTenantWidgetSettings(tenant: TenantSnapshot): TenantSnapshot["widget"] {
  return {
    aiName: tenant.widget?.aiName || defaultTenantWidgetSettings.aiName,
    languages: tenant.widget?.languages?.length ? tenant.widget.languages : defaultTenantWidgetSettings.languages,
    welcomeMessage: tenant.widget?.welcomeMessage || defaultTenantWidgetSettings.welcomeMessage
  };
}
