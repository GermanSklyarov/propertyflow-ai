import type { AiChatCitation, AiChatRequest, KnowledgeDocumentChunkSnapshot } from "@propertyflow/contracts";
import type { PropertySnapshot } from "@propertyflow/domain";

export function buildAiChatContext(lines: string[] | string, citations: AiChatCitation[]): string {
  const contextLines = Array.isArray(lines) ? lines : [lines];

  return [
    ...contextLines,
    "",
    "Source labels available through the separate citations API field:",
    ...citations.map((citation) => `- ${citation.label}`)
  ].join("\n");
}

export function buildConversationContext(request: AiChatRequest): string {
  const turns = (request.conversation ?? [])
    .filter((turn) => (turn.role === "assistant" || turn.role === "user") && turn.text.trim())
    .slice(-8)
    .map((turn) => {
      const listings = (turn.recommendedListings ?? [])
        .slice(0, 3)
        .map((listing, index) => `${index + 1}. ${listing.title} (${listing.propertyId})`);
      const suffix = listings.length ? `\nRecommended listings shown:\n${listings.join("\n")}` : "";

      return `${turn.role}: ${turn.text.trim().slice(0, 800)}${suffix}`;
    });

  return turns.length
    ? ["Recent conversation. Use it to resolve follow-up references and avoid repeating the greeting:", ...turns, ""].join("\n")
    : "";
}

export function buildListingEvidence(properties: PropertySnapshot[]): string[] {
  if (!properties.length) {
    return [];
  }

  return [
    "Structured listing evidence for the property recommendation. Treat these as authoritative tenant listing facts:",
    ...properties.map((property) => propertyEvidenceLine(property))
  ];
}

export function propertyCitation(property: PropertySnapshot): AiChatCitation {
  return {
    source: "property",
    propertyId: property.id,
    title: property.title,
    label: `${property.title}, ${property.market}, ${property.price.amount} ${property.price.currency}`
  };
}

export function knowledgeCitation(chunk: KnowledgeDocumentChunkSnapshot): AiChatCitation {
  return {
    source: "knowledge",
    documentId: chunk.documentId,
    title: chunk.title,
    label: `${chunk.title} (${chunk.kind}, chunk ${chunk.chunkIndex + 1}, score ${chunk.score})`
  };
}

export function knowledgeLine(chunk: KnowledgeDocumentChunkSnapshot): string {
  const excerpt = chunk.content.length > 180 ? `${chunk.content.slice(0, 177)}...` : chunk.content;
  return `${chunk.title}: ${excerpt}`;
}

export function describeProperty(property: PropertySnapshot): string {
  const beach = property.beachDistanceMeters
    ? `${property.beachDistanceMeters}m from the beach`
    : "beach distance is not specified";

  const rentalPrice = property.rentalPriceMonthly
    ? ` Rental ask is ${property.rentalPriceMonthly.amount} ${property.rentalPriceMonthly.currency}/mo.`
    : "";

  return `${property.title} is a ${property.bedrooms}-bedroom ${property.kind} in ${property.market}, ${beach}, listed for ${property.listingType}, priced at ${property.price.amount} ${property.price.currency}.${rentalPrice}`;
}

export function shortPropertyLine(property: PropertySnapshot): string {
  const rentalAsk = property.rentalPriceMonthly
    ? `rental ask ${property.rentalPriceMonthly.amount} ${property.rentalPriceMonthly.currency}/mo`
    : undefined;
  const rent = property.monthlyRentEstimate
    ? `estimated rent ${property.monthlyRentEstimate.amount} ${property.monthlyRentEstimate.currency}/mo`
    : "rent estimate missing";

  return `${property.title} (${property.market}, ${property.listingType}, ${property.price.amount} ${property.price.currency}, ${rentalAsk ?? rent}).`;
}

function propertyEvidenceLine(property: PropertySnapshot): string {
  const fields = [
    `id=${property.id}`,
    `title=${property.title}`,
    `market=${property.market}`,
    `kind=${property.kind}`,
    `listingType=${property.listingType}`,
    `status=${property.status}`,
    `salePrice=${formatMoney(property.price)}`,
    property.rentalPriceMonthly ? `rentalAsk=${formatMoney(property.rentalPriceMonthly)}/mo` : undefined,
    property.monthlyRentEstimate ? `rentEstimate=${formatMoney(property.monthlyRentEstimate)}/mo` : undefined,
    property.maintenanceFeeMonthly ? `maintenanceFee=${formatMoney(property.maintenanceFeeMonthly)}/mo` : undefined,
    `area=${property.areaSqm}sqm`,
    `bedrooms=${property.bedrooms}`,
    `bathrooms=${property.bathrooms}`,
    property.floor !== undefined ? `floor=${property.floor}` : undefined,
    property.beachDistanceMeters !== undefined ? `beachDistance=${property.beachDistanceMeters}m` : undefined,
    property.address ? `address=${property.address}` : undefined,
    property.amenities.length ? `amenities=${property.amenities.join(", ")}` : "amenities=not specified",
    property.project ? projectEvidence(property) : undefined,
    property.description ? `description=${truncate(property.description, 260)}` : undefined
  ].filter(Boolean);

  return `- ${fields.join("; ")}`;
}

function projectEvidence(property: PropertySnapshot): string {
  const project = property.project!;
  const fields = [
    `project=${project.name}`,
    `projectStatus=${project.status}`,
    project.developer ? `developer=${project.developer}` : undefined,
    project.completionYear ? `completionYear=${project.completionYear}` : undefined,
    project.address ? `projectAddress=${project.address}` : undefined,
    project.amenities.length ? `projectAmenities=${project.amenities.join(", ")}` : undefined
  ].filter(Boolean);

  return fields.join("; ");
}

function formatMoney(money: PropertySnapshot["price"]): string {
  return `${money.amount} ${money.currency}`;
}

function truncate(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();

  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 3)}...` : normalized;
}
