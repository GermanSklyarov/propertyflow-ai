export type ListingApiContractSection = {
  description: string;
  fields: string[];
  title: string;
};

export type ListingApiSetupStep = {
  description: string;
  title: string;
};

export type ListingApiCustomAttributeRule = {
  description: string;
  example: string;
  title: string;
};

export const LISTING_API_CONTRACT_SECTIONS: ListingApiContractSection[] = [
  {
    description: "Minimum fields needed to identify, price, and publish a listing in Concierge search.",
    fields: ["id", "name/title", "city/market", "deal_type", "status", "sale_price or monthly_rent"],
    title: "Required search contract"
  },
  {
    description: "Signals that make recommendations useful instead of generic catalogue matches.",
    fields: ["description", "project_name", "area_sqm", "bedrooms", "bathrooms", "amenities", "images"],
    title: "Recommended listing context"
  },
  {
    description: "Agency-specific fields stay queryable as custom attributes instead of being dropped during import.",
    fields: ["rent_available_until", "minimum_rental_months", "view_note", "foreign_quota", "maintenance_fee"],
    title: "Preserved custom attributes"
  }
];

export const LISTING_API_SETUP_STEPS: ListingApiSetupStep[] = [
  {
    description: "Return a stable JSON feed with an item id, updated timestamp, and deleted/archived marker when possible.",
    title: "Expose feed"
  },
  {
    description: "Use bearer auth or an API-key header. Store the real secret as a backend secret reference, not in browser code.",
    title: "Secure access"
  },
  {
    description: "Map only universal fields to the canonical listing shape so search, price filters, and cards stay predictable.",
    title: "Map canonical fields"
  },
  {
    description: "Keep agency-specific rules as custom searchable attributes so Concierge can reason about them without CRM migration.",
    title: "Preserve extras"
  }
];

export const LISTING_API_CUSTOM_ATTRIBUTE_RULES: ListingApiCustomAttributeRule[] = [
  {
    description: "Use this for lease windows, minimum stay, blocked months, handover dates, or owner blackout periods.",
    example: "rent_available_until -> availability",
    title: "Availability rules"
  },
  {
    description: "Use this for foreign quota, company ownership, maintenance fee, sinking fund, transfer split, or pet rules.",
    example: "foreign_quota -> ownership",
    title: "Deal constraints"
  },
  {
    description: "Use this for protected sea view, noise note, renovation status, internet speed, or building-specific flags.",
    example: "view_note -> view",
    title: "Local signals"
  }
];

export const LISTING_API_EXAMPLE_PAYLOAD = `{
  "data": {
    "items": [
      {
        "id": "pattaya-102",
        "name": "Wongamat sea-view condo",
        "city": "pattaya",
        "deal_type": "rent",
        "status": "available",
        "monthly_rent": 28000,
        "area_sqm": 45,
        "bedrooms": 1,
        "amenities": ["sea view", "pool", "fiber internet"],
        "images": ["https://agency.co.th/photos/pattaya-102.jpg"],
        "rent_available_until": "2027-03-31",
        "minimum_rental_months": 12,
        "view_note": "protected sea view"
      }
    ]
  }
}`;

export function countListingApiContractFields(sections: ListingApiContractSection[] = LISTING_API_CONTRACT_SECTIONS) {
  return sections.reduce((total, section) => total + section.fields.length, 0);
}
