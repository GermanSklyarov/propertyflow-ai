import type { TenantNotificationProvider } from "@propertyflow/contracts";

export const NOTIFICATION_CONNECTION_TOKEN_REPOSITORY = Symbol("NOTIFICATION_CONNECTION_TOKEN_REPOSITORY");

export type NotificationConnectionTokenStatus = "pending" | "consumed";

export interface NotificationConnectionTokenRecord {
  code: string;
  consumedAt?: Date | null;
  createdAt: Date;
  expiresAt: Date;
  id: string;
  provider: TenantNotificationProvider;
  recipientId?: string | null;
  recipientLabel?: string | null;
  tenantId: string;
}

export interface CreateNotificationConnectionTokenInput {
  code: string;
  createdAt: Date;
  expiresAt: Date;
  id: string;
  provider: TenantNotificationProvider;
  tenantId: string;
}

export interface ConsumeNotificationConnectionTokenInput {
  code: string;
  consumedAt: Date;
  provider: TenantNotificationProvider;
  recipientId: string;
  recipientLabel?: string;
}

export interface NotificationConnectionTokenRepository {
  create(input: CreateNotificationConnectionTokenInput): Promise<NotificationConnectionTokenRecord>;
  consume(input: ConsumeNotificationConnectionTokenInput): Promise<NotificationConnectionTokenRecord | null>;
  revokeActiveForTenantProvider(tenantId: string, provider: TenantNotificationProvider, revokedAt: Date): Promise<number>;
}
