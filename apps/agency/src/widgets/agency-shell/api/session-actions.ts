"use server";

import { redirect } from "next/navigation";
import { clearAgencySession } from "@shared/lib/tenant-session";

export async function submitAgencyLogout() {
  await clearAgencySession();
  redirect("/signin?status=signed-out");
}
