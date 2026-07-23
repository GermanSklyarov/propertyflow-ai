import { describe, expect, it } from "vitest";
import { formatWidgetInstallCheckStatus, isWidgetInstallVerified } from "./widget-install-check";

describe("widget install check model", () => {
  it("formats install check statuses for the UI", () => {
    expect(formatWidgetInstallCheckStatus("verified")).toBe("Widget verified");
    expect(formatWidgetInstallCheckStatus("missing-widget")).toBe("Widget missing");
    expect(formatWidgetInstallCheckStatus("wrong-tenant")).toBe("Wrong tenant");
    expect(formatWidgetInstallCheckStatus("blocked-origin")).toBe("Origin blocked");
    expect(formatWidgetInstallCheckStatus("unreachable")).toBe("Page unreachable");
  });

  it("detects verified install checks", () => {
    expect(
      isWidgetInstallVerified({
        allowedOrigin: true,
        checkedAt: "2026-07-23T00:00:00.000Z",
        checks: [],
        expectedTenantSlug: "demo-agency",
        message: "Widget is installed.",
        nextAction: "No action needed.",
        origin: "https://demo.example.com",
        status: "verified",
        url: "https://demo.example.com"
      })
    ).toBe(true);
    expect(isWidgetInstallVerified(null)).toBe(false);
  });
});
