import type { PropertySnapshot } from "@propertyflow/domain";

export function propertyImage(property: PropertySnapshot, priority?: boolean) {
  if (priority) {
    return "https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=1200&q=85";
  }

  if (property.bedrooms >= 2) {
    return "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=85";
  }

  if (property.address?.toLowerCase().includes("terminal")) {
    return "https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=900&q=85";
  }

  return "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=900&q=85";
}
