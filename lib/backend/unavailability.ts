"use server";

import { getAccessToken } from "@/lib/backend/session";
import { revalidatePath } from "next/cache";

export type Unavailability = { id: string; membership_id: string; member_name: string; start_date: string; end_date: string };

async function context() {
  const token = await getAccessToken();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  const publishable = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!token || !url || !key || !publishable) return null;
  const auth = await fetch(`${url}/auth/v1/user`, { headers: { apikey: publishable, Authorization: `Bearer ${token}` }, cache: "no-store" });
  const user = (await auth.json().catch(() => null)) as { id?: string } | null;
  if (!auth.ok || !user?.id) return null;
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const membership = await fetch(`${url}/rest/v1/memberships?select=id,band_id&user_id=eq.${encodeURIComponent(user.id)}&confirmed=eq.true&limit=1`, { headers, cache: "no-store" });
  const rows = (await membership.json().catch(() => [])) as { id?: string; band_id?: string }[];
  return rows[0]?.id && rows[0].band_id ? { url, headers, membershipId: rows[0].id, bandId: rows[0].band_id } : null;
}

export async function getUnavailability(): Promise<Unavailability[]> {
  const c = await context();
  if (!c) return [];
  const response = await fetch(`${c.url}/rest/v1/unavailability?select=id,membership_id,start_date,end_date,memberships(display_name)&memberships.band_id=eq.${encodeURIComponent(c.bandId)}&order=start_date.asc`, { headers: c.headers, cache: "no-store" });
  const rows = (await response.json().catch(() => [])) as { id: string; membership_id: string; start_date: string; end_date: string; memberships?: { display_name?: string | null } | null }[];
  return response.ok ? rows.map((row) => ({ id: row.id, membership_id: row.membership_id, start_date: row.start_date, end_date: row.end_date, member_name: row.memberships?.display_name || "Band member" })) : [];
}

export async function addUnavailability(formData: FormData): Promise<{ error?: string }> {
  const c = await context();
  const startDate = String(formData.get("startDate") ?? "");
  const endDate = String(formData.get("endDate") ?? "");
  if (!c) return { error: "You must be a confirmed band member." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || endDate < startDate) return { error: "Choose a valid date range." };
  const response = await fetch(`${c.url}/rest/v1/unavailability`, { method: "POST", headers: { ...c.headers, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ membership_id: c.membershipId, start_date: startDate, end_date: endDate }), cache: "no-store" });
  if (!response.ok) return { error: "Unable to save your unavailability." };
  revalidatePath("/dashboard/unavailability");
  revalidatePath("/dashboard/schedule");
  return {};
}

export async function deleteUnavailability(formData: FormData): Promise<{ error?: string }> {
  const c = await context();
  const id = String(formData.get("id") ?? "");
  if (!c || !id) return { error: "Unavailability not found." };
  const response = await fetch(`${c.url}/rest/v1/unavailability?id=eq.${encodeURIComponent(id)}&membership_id=eq.${encodeURIComponent(c.membershipId)}`, { method: "DELETE", headers: c.headers, cache: "no-store" });
  if (!response.ok) return { error: "Unable to remove your unavailability." };
  revalidatePath("/dashboard/unavailability");
  revalidatePath("/dashboard/schedule");
  return {};
}