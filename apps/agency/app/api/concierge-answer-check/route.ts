import { NextRequest, NextResponse } from "next/server";
import { supportedTenantWidgetLanguages, type TenantWidgetLanguage } from "@propertyflow/contracts";
import { askPublicWidget } from "@shared/api/agency-client";
import {
  buildConciergeAnswerCheckRequestContext,
  summarizeConciergeAnswerCheck
} from "@widgets/tenant-settings/model/concierge-answer-check";

interface ConciergeAnswerCheckRequestBody {
  locale?: TenantWidgetLanguage;
  message?: string;
  tenantSlug?: string;
  widgetPageUrl?: string;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as ConciergeAnswerCheckRequestBody;
  const locale = body.locale;
  const message = body.message?.trim();
  const tenantSlug = body.tenantSlug?.trim();
  const widgetPageUrl = body.widgetPageUrl?.trim();

  if (!tenantSlug) {
    return NextResponse.json({ message: "Tenant slug is required" }, { status: 400 });
  }

  if (!locale || !supportedTenantWidgetLanguages.includes(locale)) {
    return NextResponse.json({ message: "Supported locale is required" }, { status: 400 });
  }

  if (!message) {
    return NextResponse.json({ message: "Question is required" }, { status: 400 });
  }

  if (!widgetPageUrl) {
    return NextResponse.json({ message: "Widget page URL is required" }, { status: 400 });
  }

  const requestContext = buildConciergeAnswerCheckRequestContext(widgetPageUrl);

  if (!requestContext) {
    return NextResponse.json({ message: "Valid widget page URL is required" }, { status: 400 });
  }

  try {
    const response = await askPublicWidget(
      tenantSlug,
      {
        locale,
        message
      },
      {
        origin: requestContext.origin,
        referer: requestContext.referer
      }
    );

    return NextResponse.json(summarizeConciergeAnswerCheck(response));
  } catch (error) {
    return NextResponse.json(
      {
        detail: error instanceof Error ? error.message : "Unknown error",
        message: "Concierge answer check failed"
      },
      { status: 502 }
    );
  }
}
