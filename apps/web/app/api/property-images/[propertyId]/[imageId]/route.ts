const apiBaseUrl =
  process.env.PROPERTYFLOW_API_URL ?? process.env.NEXT_PUBLIC_PROPERTYFLOW_API_URL ?? "http://127.0.0.1:3001";

const demoHeaders = {
  "x-tenant-id": process.env.PROPERTYFLOW_TENANT_ID ?? "demo-agency",
  "x-user-id": process.env.PROPERTYFLOW_USER_ID ?? "manager-demo-1",
  "x-user-role": process.env.PROPERTYFLOW_USER_ROLE ?? "manager"
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ propertyId: string; imageId: string }> }
) {
  const { imageId, propertyId } = await params;
  const response = await fetch(
    `${apiBaseUrl}/properties/${encodeURIComponent(propertyId)}/images/${encodeURIComponent(imageId)}/content`,
    {
      cache: "no-store",
      headers: demoHeaders,
      redirect: "follow"
    }
  );

  if (!response.ok || !response.body) {
    return new Response("Image is not available", { status: response.status || 502 });
  }

  const headers = new Headers();
  headers.set("cache-control", "private, max-age=60");
  headers.set("content-type", response.headers.get("content-type") ?? "application/octet-stream");

  const contentLength = response.headers.get("content-length");

  if (contentLength) {
    headers.set("content-length", contentLength);
  }

  return new Response(response.body, {
    headers,
    status: 200
  });
}
