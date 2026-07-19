import { describe, expect, it } from "vitest";
import { canReadKnowledgeSourceFile, resolveKnowledgeDocumentBody } from "./knowledge-document-draft";

describe("knowledge document draft", () => {
  it("keeps typed body as the primary source", async () => {
    const body = await resolveKnowledgeDocumentBody("Agent pasted FAQ", fileFactory("guide.md", "File body"));

    expect(body).toBe("Agent pasted FAQ");
  });

  it("appends storage source references when a file upload exists", async () => {
    const body = await resolveKnowledgeDocumentBody("Agent pasted FAQ", fileFactory("guide.md", "File body"), {
      objectKey: "tenants/demo-agency/knowledge/source.md",
      objectUrl: "https://storage.example.com/source.md"
    });

    expect(body).toContain("Agent pasted FAQ");
    expect(body).toContain("Source upload:");
    expect(body).toContain("tenants/demo-agency/knowledge/source.md");
    expect(body).toContain("https://storage.example.com/source.md");
  });

  it("reads supported text files when body is empty", async () => {
    const body = await resolveKnowledgeDocumentBody("", fileFactory("buying-guide.md", "Buying guide content"));

    expect(body).toBe("Buying guide content");
  });

  it("marks binary files as waiting for OCR/PDF ingestion", async () => {
    const body = await resolveKnowledgeDocumentBody("", fileFactory("developer-brochure.pdf", "%PDF", "application/pdf"));

    expect(body).toContain("developer-brochure.pdf");
    expect(body).toContain("OCR/PDF worker");
  });

  it("recognizes common text source formats", () => {
    expect(canReadKnowledgeSourceFile(fileFactory("internal-instructions.csv", "a,b", ""))).toBe(true);
    expect(canReadKnowledgeSourceFile(fileFactory("faq.json", "{}", "application/json"))).toBe(true);
    expect(canReadKnowledgeSourceFile(fileFactory("scan.png", "", "image/png"))).toBe(false);
  });
});

function fileFactory(name: string, content: string, type = "text/markdown") {
  return {
    name,
    size: content.length,
    text: () => Promise.resolve(content),
    type
  };
}
