export type ListingApiContractSection = {
  description: string;
  fields: string[];
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
