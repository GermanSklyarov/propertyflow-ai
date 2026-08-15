import type { SuperAdminDashboardResponse } from "@propertyflow/contracts";

export const demoDashboard: SuperAdminDashboardResponse = {
  periodStart: new Date(Date.UTC(2026, 7, 1)).toISOString(),
  periodEnd: new Date(Date.UTC(2026, 8, 1)).toISOString(),
  cards: [
    { key: "activeAgencies", label: "Active agencies", today: 3, month: 3 },
    { key: "conciergeConversations", label: "Concierge conversations", today: 42, month: 428 },
    { key: "aiMessagesRequests", label: "AI messages / requests", today: 131, month: 1281 },
    { key: "leadsGenerated", label: "Leads generated", today: 5, month: 37 },
    { key: "qualifiedLeads", label: "Qualified leads", today: 2, month: 14 },
    { key: "llmTokensUsed", label: "LLM tokens used", today: 184000, month: 2400000, unit: "tokens" },
    { key: "estimatedAiCost", label: "Estimated AI cost", today: 0.44, month: 4.12, unit: "usd" },
    { key: "googleMapsRequests", label: "Google Maps requests", today: 19, month: 328 },
    { key: "messengerNotifications", label: "Messenger notifications", today: 3, month: 14 },
    { key: "totalEstimatedInfrastructureCost", label: "Total estimated infrastructure cost", today: 0.52, month: 4.83, unit: "usd" },
    { key: "costPerAgencyMonth", label: "Cost per agency / month", today: 0.17, month: 1.61, unit: "usd" }
  ],
  agencyCosts: [
    { tenantId: "apartwell", agencyName: "Apartwell", subscriptionPlan: "starter", estimatedCostUsd: 4.83, costPerQualifiedLeadUsd: 0.35 },
    { tenantId: "demo-agency", agencyName: "Demo Agency", subscriptionPlan: "starter", estimatedCostUsd: 1.42, costPerQualifiedLeadUsd: 0.47 },
    { tenantId: "another-agency", agencyName: "Another Agency", subscriptionPlan: "starter", estimatedCostUsd: 0.86 }
  ],
  aiUsage: [
    { tenantId: "apartwell", agencyName: "Apartwell", conversations: 428, llmRequests: 1281, inputTokens: 1900000, outputTokens: 500000, estimatedCostUsd: 4.12 },
    { tenantId: "demo-agency", agencyName: "Demo Agency", conversations: 73, llmRequests: 214, inputTokens: 320000, outputTokens: 61000, estimatedCostUsd: 0.48 },
    { tenantId: "another-agency", agencyName: "Another Agency", conversations: 31, llmRequests: 96, inputTokens: 118000, outputTokens: 27000, estimatedCostUsd: 0.18 }
  ],
  usageByOperation: [
    { service: "openai", operation: "concierge_completion", quantity: 1281, estimatedCostUsd: 3.2, costSharePercent: 66.25 },
    { service: "openai", operation: "rag_answer", quantity: 342, estimatedCostUsd: 1.14, costSharePercent: 23.6 },
    { service: "google_maps", operation: "geocoding_cache_miss", quantity: 56, estimatedCostUsd: 0, costSharePercent: 0 },
    { service: "line", operation: "lead_notification_sent", quantity: 14, estimatedCostUsd: 0, costSharePercent: 0 }
  ],
  maps: {
    geocodingRequests: 1842,
    placesRequests: 214,
    cacheHits: 1540,
    cacheMisses: 302,
    cacheHitRate: 83.6,
    estimatedCostUsd: 0,
    freeTierUsage: { geocoding: { used: 1842, limit: 10000 } }
  },
  messaging: {
    notifications: 14,
    telegramSent: 0,
    telegramFailed: 0,
    lineSent: 14,
    lineFailed: 0,
    whatsappSent: 0,
    whatsappFailed: 0,
    deliveryErrors: 0
  },
  tenantIntegrations: [
    { tenantId: "apartwell", agencyName: "Apartwell", telegramConfigured: false, lineConfigured: true, whatsappConfigured: false },
    { tenantId: "demo-agency", agencyName: "Demo Agency", telegramConfigured: true, lineConfigured: false, whatsappConfigured: false },
    { tenantId: "another-agency", agencyName: "Another Agency", telegramConfigured: true, lineConfigured: true, whatsappConfigured: true }
  ],
  limits: [
    { tenantId: "apartwell", agencyName: "Apartwell", metric: "aiRequests", used: 1281, limit: 10000, utilizationRate: 12.81, level: "ok" },
    { tenantId: "apartwell", agencyName: "Apartwell", metric: "conversations", used: 428, limit: 2000, utilizationRate: 21.4, level: "ok" },
    { tenantId: "apartwell", agencyName: "Apartwell", metric: "mapsRequests", used: 328, limit: 5000, utilizationRate: 6.56, level: "ok" }
  ],
  agencies: [
    {
      tenantId: "apartwell",
      agencyName: "Apartwell",
      subscriptionPlan: "starter",
      usageThisMonth: {
        conversations: 428,
        aiRequests: 1281,
        tokens: 2400000,
        leads: 37,
        qualifiedLeads: 14,
        telegramNotifications: 0,
        lineNotifications: 14,
        whatsappNotifications: 0,
        mapsRequests: 328,
        estimatedCostUsd: 4.83
      },
      roi: {
        conversations: 428,
        leads: 37,
        qualifiedLeads: 14,
        viewingsOrBookings: 0,
        costPerQualifiedLeadUsd: 0.35
      }
    }
  ],
  systemHealth: {
    api: "ok",
    postgresql: "ok",
    redis: "ok",
    llmProvider: "configured",
    googleMaps: "configured",
    messagingDelivery: "ok",
    failedJobs: 0,
    webhookFailures: 0,
    failedNotifications: 0,
    errorRate: 0
  },
  generatedAt: new Date().toISOString()
};
