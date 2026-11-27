"use server";

import { getAccessToken } from "@/lib/backend/session";
import { revalidatePath } from "next/cache";
import { sydneyDateTime } from "@/lib/sydney-date-time";

export type Unavailability = { id: string; membership_id: string; member_name: string; start_date: string; end_date: string };
export type UnavailabilityMember = { id: string; name: string };
export type UnavailabilityAccess = { isAdmin: boolean; membershipId: string };

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
  if (!rows[0]?.id || !rows[0].band_id) return null;
  const roleResponse = await fetch(`${url}/rest/v1/memberships?select=role&id=eq.${encodeURIComponent(rows[0].id)}&limit=1`, { headers, cache: "no-store" });
  const roleRows = (await roleResponse.json().catch(() => [])) as { role?: string }[];
  return { url, headers, membershipId: rows[0].id, bandId: rows[0].band_id, isAdmin: roleRows[0]?.role === "admin" };
}

export async function getUnavailabilityMembers(): Promise<UnavailabilityMember[]> {
  const c = await context();
  if (!c?.isAdmin) return [];
  const response = await fetch(`${c.url}/rest/v1/memberships?select=id,display_name&band_id=eq.${encodeURIComponent(c.bandId)}&confirmed=eq.true&order=display_name.asc`, { headers: c.headers, cache: "no-store" });
  const rows = (await response.json().catch(() => [])) as { id: string; display_name?: string | null }[];
  return response.ok ? rows.map((row) => ({ id: row.id, name: row.display_name || "Band member" })) : [];
}

export async function getUnavailabilityAccess(): Promise<UnavailabilityAccess | null> {
  const c = await context();
  return c ? { isAdmin: c.isAdmin, membershipId: c.membershipId } : null;
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
  const requestedMembershipId = String(formData.get("membershipId") ?? "");
  if (!c) return { error: "You must be a confirmed band member." };
  const membershipId = requestedMembershipId && requestedMembershipId !== c.membershipId ? (c.isAdmin ? requestedMembershipId : "") : c.membershipId;
  if (!membershipId) return { error: "Only admins can add unavailability for another member." };
  if (membershipId !== c.membershipId) {
    const member = await fetch(`${c.url}/rest/v1/memberships?select=id&band_id=eq.${encodeURIComponent(c.bandId)}&id=eq.${encodeURIComponent(membershipId)}&confirmed=eq.true&limit=1`, { headers: c.headers, cache: "no-store" });
    if (!member.ok || !((await member.json().catch(() => [])) as { id?: string }[]).length) return { error: "That member is not part of your band." };
  }
  const dateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
  if (!dateTimePattern.test(startDate) || !dateTimePattern.test(endDate) || endDate <= startDate) return { error: "Choose a valid date and time range." };
  const response = await fetch(`${c.url}/rest/v1/unavailability`, { method: "POST", headers: { ...c.headers, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ membership_id: membershipId, start_date: sydneyDateTime(startDate).toISOString(), end_date: sydneyDateTime(endDate).toISOString() }), cache: "no-store" });
  if (!response.ok) return { error: "Unable to save your unavailability." };
  revalidatePath("/dashboard/unavailability");
  revalidatePath("/dashboard/schedule");
  return {};
}

export async function deleteUnavailability(formData: FormData): Promise<{ error?: string }> {
  const c = await context();
  const id = String(formData.get("id") ?? "");
  if (!c || !id) return { error: "Unavailability not found." };
  const targetResponse = await fetch(`${c.url}/rest/v1/unavailability?select=membership_id&id=eq.${encodeURIComponent(id)}&limit=1`, { headers: c.headers, cache: "no-store" });
  const target = (await targetResponse.json().catch(() => [])) as { membership_id?: string }[];
  if (!targetResponse.ok || !target[0]?.membership_id) return { error: "Unavailability not found." };
  if (!c.isAdmin && target[0].membership_id !== c.membershipId) return { error: "You can only remove your own unavailability." };
  const response = await fetch(`${c.url}/rest/v1/unavailability?id=eq.${encodeURIComponent(id)}&membership_id=eq.${encodeURIComponent(target[0].membership_id)}`, { method: "DELETE", headers: c.headers, cache: "no-store" });
  if (!response.ok) return { error: "Unable to remove your unavailability." };
  revalidatePath("/dashboard/unavailability");
  revalidatePath("/dashboard/schedule");
  return {};
}

export async function deleteAllUnavailability(membershipId: string): Promise<{ error?: string }> {
  const c = await context();
  if (!c || !membershipId) return { error: "You must be a confirmed band member." };
  if (!c.isAdmin && membershipId !== c.membershipId) return { error: "Only admins can remove another member's unavailability." };
  const member = await fetch(`${c.url}/rest/v1/memberships?select=id&band_id=eq.${encodeURIComponent(c.bandId)}&id=eq.${encodeURIComponent(membershipId)}&confirmed=eq.true&limit=1`, { headers: c.headers, cache: "no-store" });
  if (!member.ok || !((await member.json().catch(() => [])) as { id?: string }[]).length) return { error: "That member is not part of your band." };
  const response = await fetch(`${c.url}/rest/v1/unavailability?membership_id=eq.${encodeURIComponent(membershipId)}`, { method: "DELETE", headers: c.headers, cache: "no-store" });
  if (!response.ok) return { error: "Unable to remove all unavailability." };
  revalidatePath("/dashboard/unavailability"); revalidatePath("/dashboard/schedule"); return {};
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