import { NextRequest, NextResponse } from "next/server";
import { searchPropertyProjects } from "@shared/api/agency-client";
import type { ThailandMarket } from "@propertyflow/domain";

export async function GET(request: NextRequest) {
  const market = request.nextUrl.searchParams.get("market") as ThailandMarket | null;
  const query = request.nextUrl.searchParams.get("query") ?? undefined;
  const projects = await searchPropertyProjects(
    {
      limit: 8,
      market: market ?? undefined,
      query
    },
    { revalidateSeconds: false }
  );

  return NextResponse.json(projects);
}
