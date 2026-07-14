import { describe, expect, it } from "vitest";
import { agencyNavigationItems, isAgencyNavigationItemActive } from "./agency-navigation";

describe("agency navigation", () => {
  it("keeps the dashboard active only on the root route", () => {
    expect(isAgencyNavigationItemActive("/", "/")).toBe(true);
    expect(isAgencyNavigationItemActive("/leads", "/")).toBe(false);
  });

  it("matches section roots and nested routes", () => {
    expect(isAgencyNavigationItemActive("/leads", "/leads")).toBe(true);
    expect(isAgencyNavigationItemActive("/leads/lead-demo-001", "/leads")).toBe(true);
  });

  it("does not match routes that merely share a prefix", () => {
    expect(isAgencyNavigationItemActive("/leadership", "/leads")).toBe(false);
    expect(isAgencyNavigationItemActive("/saved-searches", "/saved")).toBe(false);
  });

  it("exposes projects as a live agency section", () => {
    expect(agencyNavigationItems).toEqual(expect.arrayContaining([expect.objectContaining({ href: "/projects", status: "live" })]));
    expect(isAgencyNavigationItemActive("/projects/the-riviera-wongamat", "/projects")).toBe(true);
  });
});
