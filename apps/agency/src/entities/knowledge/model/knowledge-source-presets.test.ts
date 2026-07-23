import { describe, expect, it } from "vitest";
import {
  buildKnowledgeDocumentSourceIntake,
  buildKnowledgeSourceTags,
  knowledgeDocumentSourcePresets,
  resolveKnowledgeSourceKind
} from "./knowledge-source-presets";

describe("knowledge source presets", () => {
  it("maps starter source types to retrieval kinds", () => {
    expect(resolveKnowledgeSourceKind("visa-guide", "article")).toBe("relocation");
    expect(resolveKnowledgeSourceKind("tax-information", "article")).toBe("legal");
    expect(resolveKnowledgeSourceKind("unknown", "investment")).toBe("investment");
  });

  it("adds source tags and normalized agent tags", () => {
    const tags = buildKnowledgeSourceTags({
      sourceFileName: "Visa Guide.pdf",
      sourcePresetId: "visa-guide",
      storageBacked: true,
      typedTags: "Pattaya, Retirement Visa"
    });

    expect(tags).toEqual(
      expect.arrayContaining([
        "source:visa-guide",
        "visa",
        "relocation",
        "pattaya",
        "retirement-visa",
        "source-file",
        "visa-guide.pdf",
        "storage-backed"
      ])
    );
  });

  it("keeps starter presets aligned with onboarding coverage", () => {
    expect(knowledgeDocumentSourcePresets.map((preset) => preset.id)).toEqual([
      "faq",
      "buying-guide",
      "selling-guide",
      "company-information",
      "condo-brochures",
      "developer-pdfs",
      "tax-information",
      "visa-guide",
      "internal-instructions",
      "website-faq-pages",
      "website-blog-articles",
      "custom"
    ]);
  });

  it("tags website sources for starter concierge retrieval", () => {
    const tags = buildKnowledgeSourceTags({
      sourcePresetId: "website-faq-pages",
      sourceUrl: "https://www.agency.example.com/faq",
      storageBacked: false,
      typedTags: "website url"
    });

    expect(tags).toEqual(
      expect.arrayContaining([
        "source:website-faq-pages",
        "website",
        "faq-page",
        "public-site",
        "website-url",
        "source-url",
        "source-domain:agency.example.com"
      ])
    );
  });

  it("describes the ingestion route for source-first forms", () => {
    expect(buildKnowledgeDocumentSourceIntake("website-blog-articles")).toMatchObject({
      checklistLabel: "Website content",
      routeLabel: "Website page -> parsing -> embeddings -> AI Concierge"
    });
    expect(buildKnowledgeDocumentSourceIntake("developer-pdfs")).toMatchObject({
      checklistLabel: "Project knowledge",
      routeLabel: "Brochure -> parsing -> embeddings -> AI Concierge"
    });
    expect(buildKnowledgeDocumentSourceIntake("unknown")).toMatchObject({
      checklistLabel: "Custom knowledge",
      sourceLabel: "Custom source"
    });
  });
});
