import { describe, expect, it } from "vitest";
import {
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
      "custom"
    ]);
  });
});
