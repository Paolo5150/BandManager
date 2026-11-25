"use server";

import { getAccessToken } from "@/lib/backend/session";
import { revalidatePath } from "next/cache";

export type Unavailability = { id: string; membership_id: string; member_name: string; start_date: string; end_date: string };

/** Convert a datetime-local value entered in Sydney time to an unambiguous UTC timestamp. */
function sydneyDateTime(value: string): Date {
  const [date, time] = value.split("T");
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  const guess = new Date(Date.UTC(year, month - 1, day, hours, minutes));
  const parts = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", timeZoneName: "shortOffset", year: "numeric" }).formatToParts(guess);
  const offset = parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT+11";
  const match = offset.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  const offsetMinutes = match ? (Number(match[2]) * 60 + Number(match[3] ?? 0)) * (match[1] === "-" ? -1 : 1) : 660;
  return new Date(guess.getTime() - offsetMinutes * 60_000);
}

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
  const dateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
  if (!dateTimePattern.test(startDate) || !dateTimePattern.test(endDate) || endDate <= startDate) return { error: "Choose a valid date and time range." };
  const response = await fetch(`${c.url}/rest/v1/unavailability`, { method: "POST", headers: { ...c.headers, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ membership_id: c.membershipId, start_date: sydneyDateTime(startDate).toISOString(), end_date: sydneyDateTime(endDate).toISOString() }), cache: "no-store" });
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

export async function updateUnavailability(formData: FormData): Promise<{ error?: string }> {
  const c = await context();
  const id = String(formData.get("id") ?? "");
  const startDate = String(formData.get("startDate") ?? "");
  const endDate = String(formData.get("endDate") ?? "");
  const pattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
  if (!c || !id) return { error: "Unavailability not found." };
  if (!pattern.test(startDate) || !pattern.test(endDate) || endDate <= startDate) return { error: "Choose a valid date and time range." };
  const response = await fetch(`${c.url}/rest/v1/unavailability?id=eq.${encodeURIComponent(id)}&membership_id=eq.${encodeURIComponent(c.membershipId)}`, { method: "PATCH", headers: { ...c.headers, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ start_date: sydneyDateTime(startDate).toISOString(), end_date: sydneyDateTime(endDate).toISOString() }), cache: "no-store" });
  if (!response.ok) return { error: "Unable to update your unavailability." };
  revalidatePath("/dashboard/unavailability"); revalidatePath("/dashboard/schedule"); return {};
}