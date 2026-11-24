"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

export type ScheduleEvent = { id: string; type: string; title: string; starts_at: string; ends_at: string; location?: string | null; notes?: string | null };

async function getContext() {
  const token = (await cookies()).get("band-manager-access-token")?.value;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  const publishable = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!token || !url || !key || !publishable) return null;
  const auth = await fetch(`${url}/auth/v1/user`, { headers: { apikey: publishable, Authorization: `Bearer ${token}` }, cache: "no-store" });
  const user = (await auth.json().catch(() => null)) as { id?: string } | null;
  if (!auth.ok || !user?.id) return null;
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const membership = await fetch(`${url}/rest/v1/memberships?select=band_id&user_id=eq.${encodeURIComponent(user.id)}&confirmed=eq.true&limit=1`, { headers, cache: "no-store" });
  const rows = (await membership.json().catch(() => null)) as { band_id?: string }[] | null;
  return rows?.[0]?.band_id ? { url, headers, userId: user.id, bandId: rows[0].band_id } : null;
}

export async function getScheduleEvents(): Promise<ScheduleEvent[]> {
  const context = await getContext();
  if (!context) return [];
  const response = await fetch(`${context.url}/rest/v1/events?select=id,type,title,starts_at,ends_at,location,notes&band_id=eq.${encodeURIComponent(context.bandId)}&order=starts_at.asc`, { headers: context.headers, cache: "no-store" });
  return response.ok ? ((await response.json().catch(() => [])) as ScheduleEvent[]) : [];
}

export async function createScheduleEvent(formData: FormData): Promise<{ error?: string }> {
  const context = await getContext();
  if (!context) return { error: "You must be a confirmed band member." };
  const type = String(formData.get("type") ?? "practice");
  const title = String(formData.get("title") ?? "").trim() || (type === "gig" ? "Gig" : "Practice");
  const date = String(formData.get("date") ?? "");
  const startsAt = String(formData.get("startsAt") ?? "");
  const endsAt = String(formData.get("endsAt") ?? "");
  const start = new Date(`${date}T${startsAt}`);
  const end = new Date(`${date}T${endsAt}`);
  if (!date || !startsAt || !endsAt || end <= start) return { error: "Enter a valid date and time range." };
  const repeatWeeks = Number(formData.get("repeatWeeks") ?? "0");
  const repeatUntil = String(formData.get("repeatUntil") ?? "");
  const location = String(formData.get("location") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const headers = { ...context.headers, "Content-Type": "application/json", Prefer: "return=representation" };
  let seriesId: string | null = null;
  if ([1, 2, 3].includes(repeatWeeks)) {
    const response = await fetch(`${context.url}/rest/v1/event_series`, { method: "POST", headers, body: JSON.stringify({ band_id: context.bandId, title, start_date: date, start_time: startsAt, duration_minutes: Math.round((end.getTime() - start.getTime()) / 60000), interval_weeks: repeatWeeks, end_date: repeatUntil || null, location, notes, created_by: context.userId }), cache: "no-store" });
    const series = (await response.json().catch(() => null)) as { id?: string }[] | null;
    if (!response.ok || !series?.[0]?.id) return { error: "Unable to create the recurring event." };
    seriesId = series[0].id;
  }
  const until = repeatWeeks ? (repeatUntil ? new Date(`${repeatUntil}T23:59:59`) : new Date(start.getTime() + 52 * 7 * 86400000)) : start;
  const events: Record<string, unknown>[] = [];
  for (let current = new Date(start); current <= until; current = new Date(current.getTime() + (repeatWeeks || 52) * 7 * 86400000)) {
    events.push({ band_id: context.bandId, series_id: seriesId, type, title, starts_at: current.toISOString(), ends_at: new Date(current.getTime() + end.getTime() - start.getTime()).toISOString(), location, notes, created_by: context.userId });
    if (!repeatWeeks) break;
  }
  const response = await fetch(`${context.url}/rest/v1/events`, { method: "POST", headers, body: JSON.stringify(events), cache: "no-store" });
  if (!response.ok) return { error: "Unable to save the event." };
  revalidatePath("/dashboard/schedule");
  return {};
}