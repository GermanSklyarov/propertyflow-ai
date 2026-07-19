export interface KnowledgeSourceFileLike {
  name: string;
  size: number;
  text(): Promise<string>;
  type: string;
}

const supportedTextFileExtensions = [".csv", ".html", ".json", ".md", ".txt", ".xml"];
const supportedTextMimeTypes = [
  "application/csv",
  "application/json",
  "application/xml",
  "text/csv",
  "text/html",
  "text/markdown",
  "text/plain",
  "text/xml"
];

export function canReadKnowledgeSourceFile(file: KnowledgeSourceFileLike): boolean {
  const filename = file.name.toLowerCase();
  const mimeType = file.type.toLowerCase();

  return (
    mimeType.startsWith("text/") ||
    supportedTextMimeTypes.includes(mimeType) ||
    supportedTextFileExtensions.some((extension) => filename.endsWith(extension))
  );
}

export async function resolveKnowledgeDocumentBody(
  typedBody: string,
  sourceFile: KnowledgeSourceFileLike | null
): Promise<string> {
  const body = typedBody.trim();

  if (body || !sourceFile || sourceFile.size === 0) {
    return body;
  }

  if (!canReadKnowledgeSourceFile(sourceFile)) {
    return [
      `Source file uploaded: ${sourceFile.name}.`,
      "",
      "Binary PDF/image ingestion is not enabled for this MVP path yet. Use a text export or paste the extracted content here until the OCR/PDF worker is connected."
    ].join("\n");
  }

  return (await sourceFile.text()).trim();
}
