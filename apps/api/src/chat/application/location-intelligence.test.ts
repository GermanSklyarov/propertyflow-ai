import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isLocationInfrastructureQuestion,
  LocationIntelligenceService,
  resolveLocationComparisonTarget
} from "./location-intelligence.js";

describe("LocationIntelligenceService", () => {
  afterEach(() => {
    delete process.env.GOOGLE_MAPS_API_KEY;
    delete process.env.MAPBOX_ACCESS_TOKEN;
    delete process.env.MAP_GEOCODING_PROVIDER;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("resolves curated city POIs without a map provider", async () => {
    const service = new LocationIntelligenceService();

    await expect(service.resolveComparisonTarget("which one is closer to walking street?", "pattaya")).resolves.toMatchObject({
      kind: "poi",
      poi: {
        id: "pattaya-walking-street",
        label: "Walking Street"
      }
    });
  });

  it("resolves Ramayana Water Park locally without a map provider", async () => {
    const service = new LocationIntelligenceService();

    await expect(service.resolveComparisonTarget("condo for rent close to Water Park Ramayana", "pattaya")).resolves.toMatchObject({
      kind: "poi",
      poi: {
        id: "pattaya-ramayana-water-park",
        label: "Ramayana Water Park",
        location: {
          latitude: 12.75045,
          longitude: 100.96204
        }
      }
    });
  });

  it("recognizes arbitrary landmark distance questions for provider-backed geocoding", () => {
    expect(isLocationInfrastructureQuestion("which one of them is closer to Sanctuary of Truth?")).toBe(true);
    expect(resolveLocationComparisonTarget("which one is closer to the beach?", "pattaya")).toBeUndefined();
  });

  it("geocodes arbitrary landmarks with Google when configured", async () => {
    process.env.GOOGLE_MAPS_API_KEY = "google-test-key";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            {
              formatted_address: "Sanctuary of Truth, Pattaya, Chon Buri, Thailand",
              geometry: {
                location: {
                  lat: 12.9723,
                  lng: 100.8894
                }
              }
            }
          ]
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    const service = new LocationIntelligenceService();

    await expect(service.resolveComparisonTarget("which one is closer to Sanctuary of Truth?", "pattaya")).resolves.toMatchObject({
      kind: "poi",
      poi: {
        label: "Sanctuary of Truth",
        location: {
          latitude: 12.9723,
          longitude: 100.8894
        }
      }
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("https://maps.googleapis.com/maps/api/geocode/json?"),
      expect.objectContaining({
        headers: {
          accept: "application/json"
        }
      })
    );
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("Sanctuary+of+Truth%2C+Pattaya%2C+Thailand");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("key=google-test-key");
  });

  it("extracts Russian nedaleko landmarks cleanly and caches Google geocoding results", async () => {
    process.env.GOOGLE_MAPS_API_KEY = "google-test-key";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            {
              formatted_address: "75 6, Pattaya, Chon Buri, Thailand",
              geometry: {
                location: {
                  lat: 12.9706,
                  lng: 100.9902
                }
              }
            }
          ]
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    const service = new LocationIntelligenceService();
    const message =
      "подбери квартиру в аренду недалеко от Frost Magical Ice of Siam, я буду ходить туда кататься на ватрушке";

    await expect(service.resolveComparisonTarget(message, "pattaya")).resolves.toMatchObject({
      kind: "poi",
      poi: {
        label: "Frost Magical Ice of Siam",
        location: {
          latitude: 12.9706,
          longitude: 100.9902
        }
      }
    });
    await expect(service.resolveComparisonTarget(message, "pattaya")).resolves.toMatchObject({
      kind: "poi",
      poi: {
        label: "Frost Magical Ice of Siam"
      }
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("Frost+Magical+Ice+of+Siam%2C+Pattaya%2C+Thailand");
    expect(String(fetchMock.mock.calls[0]?.[0])).not.toContain("%D1%8F+%D0%B1%D1%83%D0%B4%D1%83");
  });
});
