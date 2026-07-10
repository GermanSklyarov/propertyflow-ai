import { notFound } from "next/navigation";
import { PropertyDetailsPage } from "../../../src/views/property-details/ui/property-details-page";
import { getPropertyById } from "../../../src/shared/api/propertyflow-client";

export default async function PropertyPage({ params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  const property = await getPropertyById(propertyId);

  if (!property) {
    notFound();
  }

  return <PropertyDetailsPage property={property} />;
}
