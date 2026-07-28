import { NextResponse } from "next/server";
import type { TenantWidgetLanguage } from "@propertyflow/contracts";
import { askPublicWidget } from "@shared/api/agency-client";

interface WidgetDemoChatBody {
  locale?: TenantWidgetLanguage;
  message?: string;
  tenantSlug?: string;
}

export async function POST(request: Request) {
  const body = (await request.json()) as WidgetDemoChatBody;
  const tenantSlug = body.tenantSlug?.trim();
  const message = body.message?.trim();

  if (!tenantSlug || !message) {
    return NextResponse.json({ message: "tenantSlug and message are required" }, { status: 400 });
  }

  const response = await askPublicWidget(tenantSlug, {
    locale: body.locale ?? "en",
    message
  });

  return NextResponse.json(response);
}
