import { NextRequest, NextResponse } from "next/server";
import { searchAmenities } from "@shared/api/agency-client";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("query") ?? undefined;
  const limit = Number(request.nextUrl.searchParams.get("limit") ?? 12);
  const amenities = await searchAmenities(
    {
      limit: Number.isFinite(limit) ? limit : 12,
      query
    },
    { revalidateSeconds: false }
  );

  return NextResponse.json(amenities);
}
