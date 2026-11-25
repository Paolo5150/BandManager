"use server";

import { cookies } from "next/headers";
import { getAccessToken } from "@/lib/backend/session";
import { revalidatePath } from "next/cache";

export type ScheduleMember = { id: string; name: string };
export type ScheduleEvent = { id: string; series_id?: string | null; type: string; title: string; starts_at: string; ends_at: string; location?: string | null; notes?: string | null; cost_cents?: number | null; status?: string };
export type EventCharge = { id: string; membership_id?: string | null; member_name?: string | null; amount_cents: number };
export type ScheduleUnavailability = { id: string; membership_id: string; start_date: string; end_date: string; member_name: string };

function sydneyDateTime(date: string, time: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  const guess = new Date(Date.UTC(year, month - 1, day, hours, minutes));
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    timeZoneName: "shortOffset",
    year: "numeric",
  }).formatToParts(guess);
  const offset = parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT+11";
  const match = offset.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  const offsetMinutes = match
    ? (Number(match[2]) * 60 + Number(match[3] ?? 0)) * (match[1] === "-" ? -1 : 1)
    : 660;
  return new Date(guess.getTime() - offsetMinutes * 60_000);
}

export async function getEventCharges(eventId: string): Promise<EventCharge[]> {
  const context = await getContext();
  if (!context?.isAdmin || !eventId) return [];
  const response = await fetch(`${context.url}/rest/v1/event_charges?select=id,membership_id,member_name,amount_cents&event_id=eq.${encodeURIComponent(eventId)}&band_id=eq.${encodeURIComponent(context.bandId)}`, { headers: context.headers, cache: "no-store" });
  if (!response.ok) return [];
  const charges = (await response.json().catch(() => [])) as EventCharge[];
  const ids = charges.map((charge) => charge.membership_id).filter((id): id is string => Boolean(id));
  if (!ids.length) return charges;
  const membershipResponse = await fetch(`${context.url}/rest/v1/memberships?select=id,display_name&band_id=eq.${encodeURIComponent(context.bandId)}&id=in.(${ids.map(encodeURIComponent).join(",")})`, { headers: context.headers, cache: "no-store" });
  const memberships = (await membershipResponse.json().catch(() => [])) as { id: string; display_name?: string | null }[];
  const names = new Map(memberships.map((membership) => [membership.id, membership.display_name || "Member"]));
  return charges.map((charge) => ({ ...charge, member_name: charge.member_name || (charge.membership_id ? names.get(charge.membership_id) : undefined) || "Member" }));
}

export async function updateEventCharges(formData: FormData): Promise<{ error?: string }> {
  const context = await getContext();
  const eventId = String(formData.get("eventId") ?? "");
  if (!context?.isAdmin || !eventId) return { error: "Only admins can edit event charges." };
  const eventStatusResponse = await fetch(`${context.url}/rest/v1/events?select=status&id=eq.${encodeURIComponent(eventId)}&band_id=eq.${encodeURIComponent(context.bandId)}&limit=1`, { headers: context.headers, cache: "no-store" });
  const eventStatus = (await eventStatusResponse.json().catch(() => [])) as { status?: string }[];
  if (eventStatus[0]?.status === "completed") return { error: "Confirmed events cannot be modified." };
  const response = await fetch(`${context.url}/rest/v1/event_charges?select=id,membership_id&event_id=eq.${encodeURIComponent(eventId)}&band_id=eq.${encodeURIComponent(context.bandId)}`, { headers: context.headers, cache: "no-store" });
  const charges = (await response.json().catch(() => [])) as { id: string; membership_id?: string | null }[];
  if (!response.ok) return { error: "Unable to load event charges." };
  for (const charge of charges) {
    const amount = Math.round((Number(formData.get(`charge_${charge.id}`) ?? 0) || 0) * 100);
    const update = await fetch(`${context.url}/rest/v1/event_charges?id=eq.${encodeURIComponent(charge.id)}&event_id=eq.${encodeURIComponent(eventId)}&band_id=eq.${encodeURIComponent(context.bandId)}`, { method: "PATCH", headers: { ...context.headers, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ amount_cents: amount }), cache: "no-store" });
    if (!update.ok) return { error: "Unable to update an event charge." };
  }
  revalidatePath("/dashboard/schedule");
  return {};
}

export async function saveEventMemberCharges(formData: FormData): Promise<{ error?: string }> {
  const context = await getContext();
  const eventId = String(formData.get("eventId") ?? "");
  const seriesId = String(formData.get("seriesId") ?? "");
  const scope = String(formData.get("editScope") ?? "instance");
  if (!context?.isAdmin || !eventId) return { error: "Only admins can edit event charges." };
  const band = `band_id=eq.${encodeURIComponent(context.bandId)}`;
  const targetQuery = scope === "series" && seriesId
    ? `series_id=eq.${encodeURIComponent(seriesId)}`
    : `id=eq.${encodeURIComponent(eventId)}`;
  const targetsResponse = await fetch(`${context.url}/rest/v1/events?select=id&${targetQuery}&${band}&status=eq.scheduled`, { headers: context.headers, cache: "no-store" });
  const targets = (await targetsResponse.json().catch(() => [])) as { id: string }[];
  if (!targetsResponse.ok) return { error: "Unable to load events for charges." };
  if (!targets.length) return { error: "Confirmed events cannot be modified." };
  const eventIds = targets.map((target) => encodeURIComponent(target.id)).join(",");
  const rows = Array.from(formData.entries())
    .filter(([key]) => key.startsWith("charge_"))
    .map(([key, value]) => ({ membership_id: key.slice(7), amount_cents: Math.round(Math.max(0, Number(value) || 0) * 100) }))
    .filter((row) => row.amount_cents > 0);
  const removed = await fetch(`${context.url}/rest/v1/event_charges?event_id=in.(${eventIds})&${band}`, { method: "DELETE", headers: context.headers, cache: "no-store" });
  if (!removed.ok) return { error: "Unable to update event charges." };
  if (rows.length) {
    const body = targets.flatMap((target) => rows.map((row) => ({ band_id: context.bandId, event_id: target.id, ...row })));
    const inserted = await fetch(`${context.url}/rest/v1/event_charges`, { method: "POST", headers: { ...context.headers, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(body), cache: "no-store" });
    if (!inserted.ok) return { error: "Unable to save event charges." };
  }
  revalidatePath("/dashboard/schedule");
  return {};
}

async function getContext() {
  const token = await getAccessToken();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  const publishable = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!token || !url || !key || !publishable) return null;
  const auth = await fetch(`${url}/auth/v1/user`, { headers: { apikey: publishable, Authorization: `Bearer ${token}` }, cache: "no-store" });
  const user = (await auth.json().catch(() => null)) as { id?: string } | null;
  if (!auth.ok || !user?.id) return null;
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const membership = await fetch(`${url}/rest/v1/memberships?select=band_id,role&user_id=eq.${encodeURIComponent(user.id)}&confirmed=eq.true&limit=1`, { headers, cache: "no-store" });
  const rows = (await membership.json().catch(() => null)) as { band_id?: string; role?: string }[] | null;
  return rows?.[0]?.band_id ? { url, headers, userId: user.id, bandId: rows[0].band_id, isAdmin: rows[0].role === "admin" } : null;
}

export async function getScheduleEvents(): Promise<ScheduleEvent[]> {
  const context = await getContext();
  if (!context) return [];
  const response = await fetch(`${context.url}/rest/v1/events?select=id,series_id,type,title,starts_at,ends_at,location,notes,cost_cents,status&band_id=eq.${encodeURIComponent(context.bandId)}&order=starts_at.asc`, { headers: context.headers, cache: "no-store" });
  return response.ok ? ((await response.json().catch(() => [])) as ScheduleEvent[]) : [];
}

export async function getScheduleUnavailability(): Promise<ScheduleUnavailability[]> {
  const context = await getContext();
  if (!context) return [];
  const membershipsResponse = await fetch(`${context.url}/rest/v1/memberships?select=id,display_name&band_id=eq.${encodeURIComponent(context.bandId)}&confirmed=eq.true`, { headers: context.headers, cache: "no-store" });
  const memberships = (await membershipsResponse.json().catch(() => [])) as { id: string; display_name?: string | null }[];
  const names = new Map(memberships.map((membership) => [membership.id, membership.display_name || "Band member"]));
  const response = await fetch(`${context.url}/rest/v1/unavailability?select=id,membership_id,start_date,end_date&membership_id=in.(${memberships.map((membership) => encodeURIComponent(membership.id)).join(",")})&order=start_date.asc`, { headers: context.headers, cache: "no-store" });
  const rows = (await response.json().catch(() => [])) as { id: string; membership_id: string; start_date: string; end_date: string }[];
  return response.ok ? rows.map((row) => ({ ...row, member_name: names.get(row.membership_id) || "Band member" })) : [];
}

export async function getUpcomingOverviewEvents(): Promise<{ next: ScheduleEvent | null; nextGig: ScheduleEvent | null }> {
  const context = await getContext();
  if (!context) return { next: null, nextGig: null };
  const now = encodeURIComponent(new Date().toISOString());
  const select = "id,series_id,type,title,starts_at,ends_at,location,notes,status";
  const base = `band_id=eq.${encodeURIComponent(context.bandId)}&status=eq.scheduled&starts_at=gte.${now}&order=starts_at.asc&limit=1`;
  const [nextResponse, gigResponse] = await Promise.all([
    fetch(`${context.url}/rest/v1/events?select=${select}&${base}`, { headers: context.headers, cache: "no-store" }),
    fetch(`${context.url}/rest/v1/events?select=${select}&${base.replace("&order", "&type=eq.gig&order")}`, { headers: context.headers, cache: "no-store" }),
  ]);
  const next = (await nextResponse.json().catch(() => [])) as ScheduleEvent[];
  const nextGig = (await gigResponse.json().catch(() => [])) as ScheduleEvent[];
  return { next: nextResponse.ok ? next[0] ?? null : null, nextGig: gigResponse.ok ? nextGig[0] ?? null : null };
}

export async function updateScheduleEvent(formData: FormData): Promise<{ error?: string }> {
  const context = await getContext();
  const id = String(formData.get("eventId") ?? "");
  const seriesId = String(formData.get("seriesId") ?? "");
  const scope = String(formData.get("editScope") ?? "instance");
  if (!context || !id) return { error: "You must be a confirmed band member." };
  if (!context.isAdmin) return { error: "Only admins can modify events." };
  const existing = await fetch(`${context.url}/rest/v1/events?select=status&id=eq.${encodeURIComponent(id)}&band_id=eq.${encodeURIComponent(context.bandId)}&limit=1`, { headers: context.headers, cache: "no-store" });
  const existingRows = (await existing.json().catch(() => [])) as { status?: string }[];
  if (existingRows[0]?.status === "completed") return { error: "Confirmed events cannot be modified." };
  const date = String(formData.get("date") ?? "");
  const startsAt = String(formData.get("startsAt") ?? "");
  const endsAt = String(formData.get("endsAt") ?? "");
  const start = sydneyDateTime(date, startsAt);
  const end = sydneyDateTime(date, endsAt);
  const [startHours, startMinutes] = startsAt.split(":").map(Number);
  const [endHours, endMinutes] = endsAt.split(":").map(Number);
  const durationMinutes = endHours * 60 + endMinutes - (startHours * 60 + startMinutes);
  if (!date || !startsAt || !endsAt || !Number.isFinite(durationMinutes) || durationMinutes <= 0) return { error: "Enter a valid date and time range." };
  const hasFinanceFields = formData.has("costCents");
  if (!context.isAdmin && hasFinanceFields) return { error: "Only admins can edit event finance details." };
  const band = `band_id=eq.${encodeURIComponent(context.bandId)}`;
  const patchHeaders = { ...context.headers, "Content-Type": "application/json", Prefer: "return=minimal" };
  const shared: Record<string, unknown> = { type: String(formData.get("type") ?? "practice"), title: String(formData.get("title") ?? "").trim() || "Event", location: String(formData.get("location") ?? "").trim() || null, notes: String(formData.get("notes") ?? "").trim() || null, cost_cents: Math.round(Math.max(0, Number(formData.get("costCents") ?? "0") || 0) * 100) };

  if (scope !== "series" || !seriesId) {
    const response = await fetch(`${context.url}/rest/v1/events?id=eq.${encodeURIComponent(id)}&${band}&status=eq.scheduled`, { method: "PATCH", headers: patchHeaders, body: JSON.stringify({ ...shared, starts_at: start.toISOString(), ends_at: end.toISOString() }), cache: "no-store" });
    if (!response.ok) return { error: `Unable to update the event. ${await response.text().catch(() => "")}`.trim() };
    revalidatePath("/dashboard/schedule");
    return {};
  }

  // Series: keep each occurrence on its own date, apply only the new time of day.
  const seriesResponse = await fetch(`${context.url}/rest/v1/events?select=id,starts_at&series_id=eq.${encodeURIComponent(seriesId)}&${band}&status=eq.scheduled`, { headers: context.headers, cache: "no-store" });
  const occurrences = (await seriesResponse.json().catch(() => [])) as { id: string; starts_at: string }[];
  if (!seriesResponse.ok) return { error: "Unable to load the series." };
  const durationMs = end.getTime() - start.getTime();
  const results = await Promise.all(occurrences.map((occurrence) => {
    const day = new Date(occurrence.starts_at);
    const localDate = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
    const occurrenceStart = new Date(`${localDate}T${startsAt}`);
    const body = { ...shared, starts_at: occurrenceStart.toISOString(), ends_at: new Date(occurrenceStart.getTime() + durationMs).toISOString() };
    return fetch(`${context.url}/rest/v1/events?id=eq.${encodeURIComponent(occurrence.id)}&${band}`, { method: "PATCH", headers: patchHeaders, body: JSON.stringify(body), cache: "no-store" });
  }));
  const failed = results.find((response) => !response.ok);
  if (failed) return { error: `Unable to update the series. ${await failed.text().catch(() => "")}`.trim() };
  revalidatePath("/dashboard/schedule");
  return {};
}

export async function deleteScheduleEvent(formData: FormData): Promise<{ error?: string }> {
  const context = await getContext();
  const eventId = String(formData.get("eventId") ?? "");
  const seriesId = String(formData.get("seriesId") ?? "");
  if (!context || !eventId) return { error: "You must be a confirmed band member." };
  if (!context.isAdmin) return { error: "Only admins can delete events." };
  const existing = await fetch(`${context.url}/rest/v1/events?select=status&id=eq.${encodeURIComponent(eventId)}&band_id=eq.${encodeURIComponent(context.bandId)}&limit=1`, { headers: context.headers, cache: "no-store" });
  const existingRows = (await existing.json().catch(() => [])) as { status?: string }[];
  if (existingRows[0]?.status === "completed") return { error: "Confirmed events cannot be deleted." };
  const query = seriesId ? `series_id=eq.${encodeURIComponent(seriesId)}&band_id=eq.${encodeURIComponent(context.bandId)}` : `id=eq.${encodeURIComponent(eventId)}&band_id=eq.${encodeURIComponent(context.bandId)}`;
  const response = await fetch(`${context.url}/rest/v1/events?${query}`, { method: "DELETE", headers: context.headers, cache: "no-store" });
  if (!response.ok) return { error: "Unable to delete the event." };

  if (seriesId) {
    const seriesResponse = await fetch(`${context.url}/rest/v1/event_series?id=eq.${encodeURIComponent(seriesId)}&band_id=eq.${encodeURIComponent(context.bandId)}`, { method: "DELETE", headers: context.headers, cache: "no-store" });
    if (!seriesResponse.ok) return { error: "The event instances were deleted, but the recurring series could not be removed." };
  }

  revalidatePath("/dashboard/schedule");
  return {};
}

export async function getScheduleMembers(): Promise<ScheduleMember[]> {
  const context = await getContext();
  if (!context) return [];
  const response = await fetch(`${context.url}/rest/v1/memberships?select=id,display_name&band_id=eq.${encodeURIComponent(context.bandId)}&confirmed=eq.true&order=display_name.asc`, { headers: context.headers, cache: "no-store" });
  const rows = (await response.json().catch(() => [])) as { id: string; display_name?: string | null }[];
  return response.ok ? rows.map((row) => ({ id: row.id, name: row.display_name || "Unnamed member" })) : [];
}

export async function getScheduleAccess(): Promise<boolean> {
  const context = await getContext();
  return context?.isAdmin ?? false;
}

export async function getWaitingConfirmations(): Promise<ScheduleEvent[]> {
  const context = await getContext();
  if (!context?.isAdmin) return [];
  const response = await fetch(`${context.url}/rest/v1/events?select=id,series_id,type,title,starts_at,ends_at,location,notes,cost_cents&band_id=eq.${encodeURIComponent(context.bandId)}&status=eq.scheduled&ends_at=lt.${encodeURIComponent(new Date().toISOString())}&order=ends_at.desc`, { headers: context.headers, cache: "no-store" });
  return response.ok ? ((await response.json().catch(() => [])) as ScheduleEvent[]) : [];
}

export async function confirmScheduleEvent(formData: FormData): Promise<{ error?: string }> {
  const context = await getContext();
  const eventId = String(formData.get("eventId") ?? "");
  if (!context?.isAdmin || !eventId) return { error: "Only admins can confirm events." };
  const chargesResponse = await fetch(`${context.url}/rest/v1/event_charges?select=id,membership_id,member_name,amount_cents&event_id=eq.${encodeURIComponent(eventId)}&band_id=eq.${encodeURIComponent(context.bandId)}`, { headers: context.headers, cache: "no-store" });
  const charges = (await chargesResponse.json().catch(() => [])) as EventCharge[];
  if (!chargesResponse.ok) return { error: "Unable to load event charges." };
  const submittedCharges = charges.map((charge) => ({ ...charge, amount_cents: Math.round((Number(formData.get(`charge_${charge.id}`) ?? charge.amount_cents / 100) || 0) * 100) }));
  const updateResponse = await fetch(`${context.url}/rest/v1/events?id=eq.${encodeURIComponent(eventId)}&band_id=eq.${encodeURIComponent(context.bandId)}&status=eq.scheduled`, { method: "PATCH", headers: { ...context.headers, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ status: "completed" }), cache: "no-store" });
  if (!updateResponse.ok) return { error: "Unable to complete the event." };
  if (charges.length) {
    const ledgerResponse = await fetch(`${context.url}/rest/v1/member_ledger`, { method: "POST", headers: { ...context.headers, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(submittedCharges.filter((charge) => charge.membership_id && charge.amount_cents > 0).map((charge) => ({ band_id: context.bandId, membership_id: charge.membership_id, member_name: charge.member_name, kind: "charge", amount_cents: -Math.abs(charge.amount_cents), event_charge_id: charge.id, created_by: context.userId }))), cache: "no-store" });
    if (!ledgerResponse.ok) return { error: "Event completed, but member ledger entries could not be created." };
  }
  revalidatePath("/dashboard/schedule");
  revalidatePath("/dashboard/finance");
  return {};
}

export async function createScheduleEvent(formData: FormData): Promise<{ error?: string }> {
  const context = await getContext();
  if (!context) return { error: "You must be a confirmed band member." };
  if (!context.isAdmin) return { error: "Only admins can add events." };
  const type = String(formData.get("type") ?? "practice");
  const title = String(formData.get("title") ?? "").trim() || (type === "gig" ? "Gig" : "Practice");
  const date = String(formData.get("date") ?? "");
  const startsAt = String(formData.get("startsAt") ?? "");
  const endsAt = String(formData.get("endsAt") ?? "");
  const start = sydneyDateTime(date, startsAt);
  const end = sydneyDateTime(date, endsAt);
  const [startHours, startMinutes] = startsAt.split(":").map(Number);
  const [endHours, endMinutes] = endsAt.split(":").map(Number);
  const durationMinutes = endHours * 60 + endMinutes - (startHours * 60 + startMinutes);
  if (!date || !startsAt || !endsAt || !Number.isFinite(durationMinutes) || durationMinutes <= 0) return { error: "Enter a valid date and time range." };
  const repeatWeeks = Number(formData.get("repeatWeeks") ?? "0");
  const repeatUntil = String(formData.get("repeatUntil") ?? "");
  const location = String(formData.get("location") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const hasFinanceFields = formData.has("costCents") || Array.from(formData.keys()).some((key) => key.startsWith("charge_"));
  if (!context.isAdmin && hasFinanceFields) return { error: "Only admins can add event finance details." };
  const costCents = Math.round(Math.max(0, Number(formData.get("costCents") ?? "0") || 0) * 100);
  const chargeRows = Array.from(formData.entries()).filter(([key]) => key.startsWith("charge_")).map(([key, value]) => ({ membership_id: key.slice(7), amount_cents: Math.round(Math.max(0, Number(value) || 0) * 100) }));
  if (chargeRows.reduce((sum, row) => sum + row.amount_cents, 0) !== costCents) return { error: "Member charges must add up exactly to the event cost." };
  const headers = { ...context.headers, "Content-Type": "application/json", Prefer: "return=representation" };
  let seriesId: string | null = null;
  if ([1, 2, 3].includes(repeatWeeks)) {
    const response = await fetch(`${context.url}/rest/v1/event_series`, { method: "POST", headers, body: JSON.stringify({ band_id: context.bandId, title, start_date: date, start_time: startsAt, duration_minutes: durationMinutes, interval_weeks: repeatWeeks, end_date: repeatUntil || null, location, notes, cost_cents: costCents, created_by: context.userId }), cache: "no-store" });
    const series = (await response.json().catch(() => null)) as { id?: string }[] | null;
    if (!response.ok || !series?.[0]?.id) return { error: "Unable to create the recurring event." };
    seriesId = series[0].id;
  }
  const until = repeatWeeks ? (repeatUntil ? new Date(`${repeatUntil}T23:59:59Z`) : new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + 52 * 7))) : start;
  const events: Record<string, unknown>[] = [];
  for (let current = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())); current <= until; current.setUTCDate(current.getUTCDate() + (repeatWeeks || 52) * 7)) {
    const currentDate = `${current.getUTCFullYear()}-${String(current.getUTCMonth() + 1).padStart(2, "0")}-${String(current.getUTCDate()).padStart(2, "0")}`;
    const currentStart = sydneyDateTime(currentDate, startsAt);
    events.push({ band_id: context.bandId, series_id: seriesId, type, title, starts_at: currentStart.toISOString(), ends_at: new Date(currentStart.getTime() + durationMinutes * 60_000).toISOString(), location, notes, cost_cents: costCents || null, created_by: context.userId });
    if (!repeatWeeks) break;
  }
  const response = await fetch(`${context.url}/rest/v1/events`, { method: "POST", headers, body: JSON.stringify(events), cache: "no-store" });
  const createdEvents = (await response.json().catch(() => [])) as { id: string }[];
  if (!response.ok || !createdEvents.length) return { error: "Unable to save the event." };
  if (chargeRows.length) {
    const charges = createdEvents.flatMap((event) => chargeRows.map((charge) => ({ band_id: context.bandId, event_id: event.id, membership_id: charge.membership_id, amount_cents: charge.amount_cents })));
    await fetch(`${context.url}/rest/v1/event_charges`, { method: "POST", headers, body: JSON.stringify(charges), cache: "no-store" });
  }
  revalidatePath("/dashboard/schedule");
  return {};
}