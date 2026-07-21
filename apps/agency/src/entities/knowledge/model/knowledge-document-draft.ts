export interface KnowledgeSourceFileLike {
  name: string;
  size: number;
  text(): Promise<string>;
  type: string;
}

export interface KnowledgeSourceUpload {
  objectKey: string;
  objectUrl: string;
}

export interface KnowledgeDocumentSourceReference {
  sourceUrl?: string;
  sourceUpload?: KnowledgeSourceUpload;
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
  sourceFile: KnowledgeSourceFileLike | null,
  sourceReference: KnowledgeDocumentSourceReference = {}
): Promise<string> {
  const body = typedBody.trim();

  if (!sourceFile || sourceFile.size === 0) {
    return appendSourceReference(body, sourceReference);
  }

  if (body) {
    return appendSourceReference(body, sourceReference, sourceFile);
  }

  if (!canReadKnowledgeSourceFile(sourceFile)) {
    return appendSourceReference(
      [
        `Source file uploaded: ${sourceFile.name}.`,
        "",
        "Binary PDF/image ingestion is not enabled for this MVP path yet. Use a text export or paste the extracted content here until the OCR/PDF worker is connected."
      ].join("\n"),
      sourceReference,
      sourceFile,
    );
  }

  return appendSourceReference((await sourceFile.text()).trim(), sourceReference, sourceFile);
}

function appendSourceReference(
  body: string,
  sourceReference: KnowledgeDocumentSourceReference,
  sourceFile?: KnowledgeSourceFileLike
): string {
  const sourceUrl = normalizeSourceUrl(sourceReference.sourceUrl);
  const sourceUpload = sourceReference.sourceUpload;

  if (!sourceUrl && (!sourceFile || !sourceUpload)) {
    return body;
  }

  const lines = [body, "", "Source reference:"];

  if (sourceUrl) {
    lines.push(`- Source URL: ${sourceUrl}`);
  }

  if (sourceFile && sourceUpload) {
    lines.push(`- Filename: ${sourceFile.name}`, `- Object key: ${sourceUpload.objectKey}`, `- Object URL: ${sourceUpload.objectUrl}`);
  }

  return lines.join("\n");
}

function normalizeSourceUrl(value?: string) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return undefined;
  }

  try {
    return new URL(trimmed).toString();
  } catch (_error) {
    return trimmed;
  }
}
