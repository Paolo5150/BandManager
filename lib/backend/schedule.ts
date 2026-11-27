"use server";

import { getAccessToken } from "@/lib/backend/session";
import { revalidatePath } from "next/cache";
import { sydneyDateTime } from "@/lib/sydney-date-time";
import { formatEventDateTime, getSydneyDateTimeParts } from "@/lib/date-format";
import { sendMemberFinanceNotification, sendNotification } from "@/lib/notifications/send-notification";

export type ScheduleMember = { id: string; name: string };
export type ScheduleEvent = { id: string; series_id?: string | null; type: string; title: string; starts_at: string; ends_at: string; location?: string | null; notes?: string | null; cost_cents?: number | null; status?: string; added_by?: string | null; added_by_name?: string | null };
export type EventCharge = { id: string; membership_id?: string | null; member_name?: string | null; amount_cents: number };
export type ScheduleUnavailability = { id: string; membership_id: string; start_date: string; end_date: string; member_name: string };

export async function getEventCharges(eventId: string): Promise<EventCharge[]> {
  const context = await getContext();
  if (!context?.isAdmin || !eventId) return [];
  const response = await fetch(`${context.url}/rest/v1/event_charges?select=id,membership_id,member_name,amount_cents&event_id=eq.${encodeURIComponent(eventId)}&band_id=eq.${encodeURIComponent(context.bandId)}`, { headers: context.headers, cache: "no-store" });
  if (!response.ok) return [];
  const charges = (await response.json().catch(() => [])) as EventCharge[];
  const membershipResponse = await fetch(`${context.url}/rest/v1/memberships?select=id,display_name&band_id=eq.${encodeURIComponent(context.bandId)}&confirmed=eq.true&order=display_name.asc`, { headers: context.headers, cache: "no-store" });
  const memberships = (await membershipResponse.json().catch(() => [])) as { id: string; display_name?: string | null }[];
  if (!membershipResponse.ok) return charges;
  const existingByMembership = new Map(charges.filter((charge) => charge.membership_id).map((charge) => [charge.membership_id!, charge]));
  return memberships.map((membership) => {
    const existing = existingByMembership.get(membership.id);
    return existing
      ? { ...existing, member_name: existing.member_name || membership.display_name || "Member" }
      : { id: `new:${membership.id}`, membership_id: membership.id, member_name: membership.display_name || "Member", amount_cents: 0 };
  });
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
  const membership = await fetch(`${url}/rest/v1/memberships?select=id,band_id,role&user_id=eq.${encodeURIComponent(user.id)}&confirmed=eq.true&limit=1`, { headers, cache: "no-store" });
  const rows = (await membership.json().catch(() => null)) as { id?: string; band_id?: string; role?: string }[] | null;
  return rows?.[0]?.id && rows[0].band_id ? { url, headers, userId: user.id, membershipId: rows[0].id, bandId: rows[0].band_id, isAdmin: rows[0].role === "admin" } : null;
}

export async function getScheduleEvents(): Promise<ScheduleEvent[]> {
  const context = await getContext();
  if (!context) return [];
  const response = await fetch(`${context.url}/rest/v1/events?select=id,series_id,type,title,starts_at,ends_at,location,notes,cost_cents,status,added_by&band_id=eq.${encodeURIComponent(context.bandId)}&order=starts_at.asc`, { headers: context.headers, cache: "no-store" });
  const events = (await response.json().catch(() => [])) as ScheduleEvent[];
  if (!response.ok || !events.length) return [];
  const memberIds = [...new Set(events.map((event) => event.added_by).filter((id): id is string => Boolean(id)))];
  if (!memberIds.length) return events;
  const membersResponse = await fetch(`${context.url}/rest/v1/memberships?select=id,display_name&band_id=eq.${encodeURIComponent(context.bandId)}&id=in.(${memberIds.map(encodeURIComponent).join(",")})`, { headers: context.headers, cache: "no-store" });
  const members = (await membersResponse.json().catch(() => [])) as { id: string; display_name?: string | null }[];
  if (!membersResponse.ok) return events;
  const memberNames = new Map(members.map((member) => [member.id, member.display_name || "Band member"]));
  return events.map((event) => ({ ...event, added_by_name: event.added_by ? memberNames.get(event.added_by) ?? "Band member" : null }));
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
  const start = sydneyDateTime(`${date}T${startsAt}`);
  const end = sydneyDateTime(`${date}T${endsAt}`);
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
    const localDate = getSydneyDateTimeParts(occurrence.starts_at).date;
    const occurrenceStart = sydneyDateTime(`${localDate}T${startsAt}`);
    const body = { ...shared, starts_at: occurrenceStart.toISOString(), ends_at: new Date(occurrenceStart.getTime() + durationMs).toISOString() };
    return fetch(`${context.url}/rest/v1/events?id=eq.${encodeURIComponent(occurrence.id)}&${band}`, { method: "PATCH", headers: patchHeaders, body: JSON.stringify(body), cache: "no-store" });
  }));
  const failed = results.find((response) => !response.ok);
  if (failed) return { error: `Unable to update the series. ${await failed.text().catch(() => "")}`.trim() };
  revalidatePath("/dashboard/schedule");
  return {};
}

export async function sendScheduleUpdateNotification(formData: FormData): Promise<{ sent?: number; warning?: string }> {
  const context = await getContext();
  const eventId = String(formData.get("eventId") ?? "");
  const seriesId = String(formData.get("seriesId") ?? "");
  const scope = String(formData.get("editScope") ?? "instance");
  if (!context?.isAdmin || !eventId) return { warning: "Only admins can send event update notifications." };
  const eventResponse = await fetch(`${context.url}/rest/v1/events?select=id,title,type,starts_at,ends_at,location&id=eq.${encodeURIComponent(eventId)}&band_id=eq.${encodeURIComponent(context.bandId)}&limit=1`, { headers: context.headers, cache: "no-store" });
  const eventRows = (await eventResponse.json().catch(() => [])) as { id: string; title: string; type: string; starts_at: string; ends_at: string; location?: string | null }[];
  if (!eventResponse.ok || !eventRows[0]) return { warning: "The event was updated, but its details could not be loaded for notification." };
  const membershipsResponse = await fetch(`${context.url}/rest/v1/memberships?select=id&band_id=eq.${encodeURIComponent(context.bandId)}&confirmed=eq.true`, { headers: context.headers, cache: "no-store" });
  const memberships = (await membershipsResponse.json().catch(() => [])) as { id: string }[];
  if (!membershipsResponse.ok) return { warning: "The event was updated, but band members could not be loaded for notification." };
  const event = eventRows[0];
  const seriesText = scope === "series" && seriesId ? " The whole recurring series was updated." : "";
  const locationText = event.location ? ` Location: ${event.location}.` : "";
  try {
    const result = await sendNotification({
      recipientMembershipIds: memberships.map((membership) => membership.id),
      notification: {
        title: `${event.type === "gig" ? "Gig" : "Practice"} updated: ${event.title}`,
        body: `${formatEventDateTime(event.starts_at)} – ${formatEventDateTime(event.ends_at)}.${locationText}${seriesText}`,
        url: "/dashboard/schedule",
      },
    });
    if (!result.sent) return { warning: result.failed ? "The event was updated, but push delivery failed." : "The event was updated, but no members have enabled push notifications." };
    if (result.failed) return { sent: result.sent, warning: "Some member devices could not be notified." };
    return { sent: result.sent };
  } catch {
    return { warning: "The event was updated, but push notification delivery failed." };
  }
}

export async function sendScheduleReminder(eventId: string): Promise<{ sent?: number; warning?: string; error?: string }> {
  const context = await getContext();
  if (!context?.isAdmin || !eventId) return { error: "Only admins can send event reminders." };
  const eventResponse = await fetch(`${context.url}/rest/v1/events?select=id,title,type,starts_at,ends_at,location,series_id&id=eq.${encodeURIComponent(eventId)}&band_id=eq.${encodeURIComponent(context.bandId)}&limit=1`, { headers: context.headers, cache: "no-store" });
  const events = (await eventResponse.json().catch(() => [])) as { id: string; title: string; type: string; starts_at: string; ends_at: string; location?: string | null; series_id?: string | null }[];
  if (!eventResponse.ok || !events[0]) return { error: "Event not found in your band." };
  const membershipsResponse = await fetch(`${context.url}/rest/v1/memberships?select=id&band_id=eq.${encodeURIComponent(context.bandId)}&confirmed=eq.true`, { headers: context.headers, cache: "no-store" });
  const memberships = (await membershipsResponse.json().catch(() => [])) as { id: string }[];
  if (!membershipsResponse.ok) return { warning: "Could not load band members for this reminder." };
  const event = events[0];
  const location = event.location ? ` at ${event.location}` : "";
  try {
    const result = await sendNotification({
      recipientMembershipIds: memberships.map((membership) => membership.id),
      notification: {
        title: `Reminder: ${event.title}`,
        body: `${formatEventDateTime(event.starts_at)} – ${formatEventDateTime(event.ends_at)}${location}.`,
        url: "/dashboard/schedule",
      },
    });
    if (!result.sent) return { warning: result.failed ? "Reminder delivery failed." : "No members have enabled push notifications." };
    if (result.failed) return { sent: result.sent, warning: "Reminder sent, but some devices could not be notified." };
    return { sent: result.sent };
  } catch {
    return { warning: "Reminder delivery failed." };
  }
}

export async function deleteScheduleEvent(formData: FormData): Promise<{ error?: string; notificationWarning?: string }> {
  const context = await getContext();
  const eventId = String(formData.get("eventId") ?? "");
  const seriesId = String(formData.get("seriesId") ?? "");
  if (!context || !eventId) return { error: "You must be a confirmed band member." };
  if (!context.isAdmin) return { error: "Only admins can delete events." };
  const existing = await fetch(`${context.url}/rest/v1/events?select=status,title,type,starts_at,ends_at,location&id=eq.${encodeURIComponent(eventId)}&band_id=eq.${encodeURIComponent(context.bandId)}&limit=1`, { headers: context.headers, cache: "no-store" });
  const existingRows = (await existing.json().catch(() => [])) as { status?: string; title?: string; type?: string; starts_at?: string; ends_at?: string; location?: string | null }[];
  if (existingRows[0]?.status === "completed") return { error: "Confirmed events cannot be deleted." };
  if (!existing.ok || !existingRows[0]?.starts_at || !existingRows[0].ends_at) return { error: "Unable to load the event details before deletion." };
  const event = existingRows[0] as { status?: string; title?: string; type?: string; starts_at: string; ends_at: string; location?: string | null };
  const query = seriesId ? `series_id=eq.${encodeURIComponent(seriesId)}&band_id=eq.${encodeURIComponent(context.bandId)}` : `id=eq.${encodeURIComponent(eventId)}&band_id=eq.${encodeURIComponent(context.bandId)}`;
  const response = await fetch(`${context.url}/rest/v1/events?${query}`, { method: "DELETE", headers: context.headers, cache: "no-store" });
  if (!response.ok) return { error: "Unable to delete the event." };

  if (seriesId) {
    const seriesResponse = await fetch(`${context.url}/rest/v1/event_series?id=eq.${encodeURIComponent(seriesId)}&band_id=eq.${encodeURIComponent(context.bandId)}`, { method: "DELETE", headers: context.headers, cache: "no-store" });
    if (!seriesResponse.ok) return { error: "The event instances were deleted, but the recurring series could not be removed." };
  }

  revalidatePath("/dashboard/schedule");
  const membershipsResponse = await fetch(`${context.url}/rest/v1/memberships?select=id&band_id=eq.${encodeURIComponent(context.bandId)}&confirmed=eq.true`, { headers: context.headers, cache: "no-store" });
  const memberships = (await membershipsResponse.json().catch(() => [])) as { id: string }[];
  if (!membershipsResponse.ok) return { notificationWarning: "The event was deleted, but band members could not be loaded for notification." };
  try {
    const kind = event.type === "gig" ? "Gig" : "Practice";
    const title = event.title || kind;
    const locationText = event.location ? ` at ${event.location}` : "";
    const seriesText = seriesId ? " This recurring series was removed." : " This event was removed from the schedule.";
    const notification = await sendNotification({
      recipientMembershipIds: memberships.map((membership) => membership.id),
      notification: {
        title: `Reminder: ${title} has been deleted`,
        body: `${kind} scheduled for ${formatEventDateTime(event.starts_at)} – ${formatEventDateTime(event.ends_at)}${locationText}.${seriesText}`,
        url: "/dashboard/schedule",
      },
    });
    if (!notification.sent) return { notificationWarning: notification.failed ? "The event was deleted, but push delivery failed." : "The event was deleted, but no members have enabled push notifications." };
    if (notification.failed) return { notificationWarning: "The event was deleted, but some devices could not be notified." };
  } catch {
    return { notificationWarning: "The event was deleted, but push notification delivery failed." };
  }
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

export async function confirmScheduleEvent(formData: FormData): Promise<{ error?: string; notificationWarning?: string }> {
  const context = await getContext();
  const eventId = String(formData.get("eventId") ?? "");
  if (!context?.isAdmin || !eventId) return { error: "Only admins can confirm events." };
  const eventResponse = await fetch(`${context.url}/rest/v1/events?select=status,cost_cents&id=eq.${encodeURIComponent(eventId)}&band_id=eq.${encodeURIComponent(context.bandId)}&limit=1`, { headers: context.headers, cache: "no-store" });
  const eventRows = (await eventResponse.json().catch(() => [])) as { status?: string; cost_cents?: number | null; title?: string }[];
  if (!eventResponse.ok || !eventRows[0]) return { error: "Event not found." };
  if (eventRows[0].status === "completed") return { error: "This event has already been confirmed." };
  const chargesResponse = await fetch(`${context.url}/rest/v1/event_charges?select=id,membership_id,member_name,amount_cents&event_id=eq.${encodeURIComponent(eventId)}&band_id=eq.${encodeURIComponent(context.bandId)}`, { headers: context.headers, cache: "no-store" });
  const charges = (await chargesResponse.json().catch(() => [])) as EventCharge[];
  if (!chargesResponse.ok) return { error: "Unable to load event charges." };
  const membersResponse = await fetch(`${context.url}/rest/v1/memberships?select=id,display_name&band_id=eq.${encodeURIComponent(context.bandId)}&confirmed=eq.true`, { headers: context.headers, cache: "no-store" });
  const members = (await membersResponse.json().catch(() => [])) as { id: string; display_name?: string | null }[];
  if (!membersResponse.ok) return { error: "Unable to load band members." };
  const existingByMembership = new Map(charges.filter((charge) => charge.membership_id).map((charge) => [charge.membership_id!, charge]));
  const submittedCharges = members.map((member) => {
    const existing = existingByMembership.get(member.id);
    const amountCents = Math.round((Number(formData.get(`charge_${existing?.id ?? `new:${member.id}`}`) ?? (existing?.amount_cents ?? 0) / 100) || 0) * 100);
    return { id: existing?.id ?? `new:${member.id}`, membership_id: member.id, member_name: existing?.member_name || member.display_name || "Member", amount_cents: amountCents, isNew: !existing };
  });
  const totalCharges = submittedCharges.reduce((sum, charge) => sum + charge.amount_cents, 0);
  if (totalCharges !== Math.round(Number(eventRows[0].cost_cents ?? 0))) return { error: "Member charges must add up exactly to the event cost." };
  const updateResponse = await fetch(`${context.url}/rest/v1/events?id=eq.${encodeURIComponent(eventId)}&band_id=eq.${encodeURIComponent(context.bandId)}&status=eq.scheduled`, { method: "PATCH", headers: { ...context.headers, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ status: "completed" }), cache: "no-store" });
  if (!updateResponse.ok) return { error: "Unable to complete the event." };
  const newChargeRows = submittedCharges.filter((charge) => charge.isNew && charge.amount_cents > 0).map((charge) => ({ band_id: context.bandId, event_id: eventId, membership_id: charge.membership_id, amount_cents: charge.amount_cents }));
  const createdCharges = new Map<string, string>();
  if (newChargeRows.length) {
    const inserted = await fetch(`${context.url}/rest/v1/event_charges`, { method: "POST", headers: { ...context.headers, "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify(newChargeRows), cache: "no-store" });
    const created = (await inserted.json().catch(() => [])) as { id: string; membership_id: string }[];
    if (!inserted.ok) return { error: "Event completed, but new member charges could not be saved." };
    for (const row of created) createdCharges.set(row.membership_id, row.id);
  }
  const chargeIds = submittedCharges.filter((charge) => !charge.isNew || createdCharges.has(charge.membership_id)).map((charge) => charge.isNew ? createdCharges.get(charge.membership_id)! : charge.id);
  let chargedMembershipIds: string[] = [];
  if (chargeIds.length) {
    const existingResponse = await fetch(`${context.url}/rest/v1/member_ledger?select=event_charge_id&band_id=eq.${encodeURIComponent(context.bandId)}&event_charge_id=in.(${chargeIds.map(encodeURIComponent).join(",")})`, { headers: context.headers, cache: "no-store" });
    const existing = (await existingResponse.json().catch(() => [])) as { event_charge_id?: string | null }[];
    if (!existingResponse.ok) return { error: "Unable to check existing member charges." };
    const existingIds = new Set(existing.map((entry) => entry.event_charge_id).filter((id): id is string => Boolean(id)));
    const ledgerRows = submittedCharges.filter((charge) => charge.amount_cents > 0).map((charge) => ({ ...charge, id: charge.isNew ? createdCharges.get(charge.membership_id)! : charge.id })).filter((charge) => charge.id && !existingIds.has(charge.id)).map((charge) => ({ band_id: context.bandId, membership_id: charge.membership_id, member_name: charge.member_name, kind: "charge", amount_cents: -Math.abs(charge.amount_cents), event_charge_id: charge.id, created_by: context.userId, added_by: context.membershipId }));
    chargedMembershipIds = [...new Set(ledgerRows.map((row) => row.membership_id))];
    if (!ledgerRows.length) { revalidatePath("/dashboard/schedule"); revalidatePath("/dashboard/finance"); return {}; }
    const ledgerResponse = await fetch(`${context.url}/rest/v1/member_ledger`, { method: "POST", headers: { ...context.headers, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(ledgerRows), cache: "no-store" });
    if (!ledgerResponse.ok) return { error: "Event completed, but member ledger entries could not be created." };
  }
  let notificationWarning: string | undefined;
  if (chargedMembershipIds.length) {
    try {
      const balanceResponse = await fetch(`${context.url}/rest/v1/member_balances?select=membership_id,balance_cents&band_id=eq.${encodeURIComponent(context.bandId)}&membership_id=in.(${chargedMembershipIds.map(encodeURIComponent).join(",")})`, { headers: context.headers, cache: "no-store" });
      const balances = (await balanceResponse.json().catch(() => [])) as { membership_id: string; balance_cents?: number | string | null }[];
      if (!balanceResponse.ok) throw new Error("Unable to read member balances after charging.");
      const balanceByMembership = new Map(balances.map((row) => [row.membership_id, Number(row.balance_cents ?? 0)]));
      const recipients = chargedMembershipIds.map((membershipId) => ({ membershipId, balance: balanceByMembership.get(membershipId) ?? 0 }));
      const results = await Promise.all(recipients.map(async (recipient) => {
        const balance = recipient.balance;
        try {
          return await sendMemberFinanceNotification({
            membershipId: recipient.membershipId,
            notification: {
              title: "Event charge applied to your band balance",
              body: `You were charged $${(Math.abs(submittedCharges.find((charge) => charge.membership_id === recipient.membershipId)?.amount_cents ?? 0) / 100).toFixed(2)} for ${eventRows[0]?.title || "a confirmed event"}. Your balance is now $${(balance / 100).toFixed(2)}.${balance < 0 ? " Low funds: please add funds to bring your balance above zero." : ""}`,
              url: "/dashboard/finance",
            },
          });
        } catch {
          return { sent: 0, failed: 1, expired: 0 };
        }
      }));
      const sentCount = results.reduce((total, result) => total + result.sent, 0);
      if (sentCount < recipients.length) notificationWarning = sentCount ? "Some charged members could not be notified. They may not have push notifications enabled." : "The event was confirmed and charged, but no charged members could be notified. They may not have push notifications enabled.";
    } catch {
      notificationWarning = "The event was confirmed and charged, but member balances could not be checked for notifications.";
    }
  }
  revalidatePath("/dashboard/schedule");
  revalidatePath("/dashboard/finance");
  return notificationWarning ? { notificationWarning } : {};
}

export async function createScheduleEvent(formData: FormData): Promise<{ error?: string; notificationSent?: boolean; notificationWarning?: string }> {
  const context = await getContext();
  if (!context) return { error: "You must be a confirmed band member." };
  if (!context.isAdmin) return { error: "Only admins can add events." };
  const type = String(formData.get("type") ?? "practice");
  const title = String(formData.get("title") ?? "").trim() || (type === "gig" ? "Gig" : "Practice");
  const date = String(formData.get("date") ?? "");
  const startsAt = String(formData.get("startsAt") ?? "");
  const endsAt = String(formData.get("endsAt") ?? "");
  const start = sydneyDateTime(`${date}T${startsAt}`);
  const [startHours, startMinutes] = startsAt.split(":").map(Number);
  const [endHours, endMinutes] = endsAt.split(":").map(Number);
  const durationMinutes = endHours * 60 + endMinutes - (startHours * 60 + startMinutes);
  if (!date || !startsAt || !endsAt || !Number.isFinite(durationMinutes) || durationMinutes <= 0) return { error: "Enter a valid date and time range." };
  const repeatWeeks = Number(formData.get("repeatWeeks") ?? "0");
  const repeatUntil = String(formData.get("repeatUntil") ?? "");
  const location = String(formData.get("location") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const hasCost = formData.get("hasCost") === "true";
  const hasFinanceFields = hasCost && (formData.has("costCents") || Array.from(formData.keys()).some((key) => key.startsWith("charge_")));
  if (!context.isAdmin && hasFinanceFields) return { error: "Only admins can add event finance details." };
  const costCents = hasCost ? Math.round(Math.max(0, Number(formData.get("costCents") ?? "0") || 0) * 100) : 0;
  const chargeRows = hasCost ? Array.from(formData.entries()).filter(([key]) => key.startsWith("charge_")).map(([key, value]) => ({ membership_id: key.slice(7), amount_cents: Math.round(Math.max(0, Number(value) || 0) * 100) })) : [];
  if (hasCost && chargeRows.reduce((sum, row) => sum + row.amount_cents, 0) !== costCents) return { error: "Member charges must add up exactly to the event cost." };
  const headers = { ...context.headers, "Content-Type": "application/json", Prefer: "return=representation" };
  let seriesId: string | null = null;
  if ([1, 2, 3].includes(repeatWeeks)) {
    let response: Response;
    try {
      response = await fetch(`${context.url}/rest/v1/event_series`, { method: "POST", headers, body: JSON.stringify({ band_id: context.bandId, title, start_date: date, start_time: startsAt, duration_minutes: durationMinutes, interval_weeks: repeatWeeks, end_date: repeatUntil || null, location, notes, cost_cents: costCents, created_by: context.userId }), cache: "no-store" });
    } catch {
      return { error: "Could not connect to the database while creating the recurring event. Please try again." };
    }
    const series = (await response.json().catch(() => null)) as { id?: string; message?: string; details?: string; hint?: string }[] | null;
    if (!response.ok || !series?.[0]?.id) return { error: `Unable to create the recurring event${series?.[0]?.message ? `: ${series[0].message}` : ` (HTTP ${response.status})`}${series?.[0]?.details ? ` — ${series[0].details}` : ""}` };
    seriesId = series[0].id;
  }
  const until = repeatWeeks ? (repeatUntil ? new Date(`${repeatUntil}T23:59:59Z`) : new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + 52 * 7))) : start;
  const events: Record<string, unknown>[] = [];
  for (let current = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())); current <= until; current.setUTCDate(current.getUTCDate() + (repeatWeeks || 52) * 7)) {
    const currentDate = `${current.getUTCFullYear()}-${String(current.getUTCMonth() + 1).padStart(2, "0")}-${String(current.getUTCDate()).padStart(2, "0")}`;
    const currentStart = sydneyDateTime(`${currentDate}T${startsAt}`);
    events.push({ band_id: context.bandId, series_id: seriesId, type, title, starts_at: currentStart.toISOString(), ends_at: new Date(currentStart.getTime() + durationMinutes * 60_000).toISOString(), location, notes, cost_cents: costCents || null, created_by: context.userId, added_by: context.membershipId });
    if (!repeatWeeks) break;
  }
  let response: Response;
  try {
    response = await fetch(`${context.url}/rest/v1/events`, { method: "POST", headers, body: JSON.stringify(events), cache: "no-store" });
  } catch {
    return { error: "Could not connect to the database while saving the event. Please try again." };
  }
  const eventBody = (await response.json().catch(() => null)) as { id?: string; message?: string; details?: string; hint?: string }[] | { message?: string; details?: string; hint?: string } | null;
  const createdEvents = Array.isArray(eventBody) ? eventBody as { id?: string }[] : [];
  if (!response.ok || !createdEvents.length) {
    const errorBody = Array.isArray(eventBody) ? eventBody[0] : eventBody;
    const details = [errorBody?.message, errorBody?.details, errorBody?.hint].filter((part): part is string => Boolean(part)).join(" — ");
    return { error: `Unable to save the event${details ? `: ${details}` : ` (HTTP ${response.status})`}` };
  }
  if (chargeRows.length) {
    const charges = createdEvents.flatMap((event) => chargeRows.map((charge) => ({ band_id: context.bandId, event_id: event.id, membership_id: charge.membership_id, amount_cents: charge.amount_cents })));
    const chargesResponse = await fetch(`${context.url}/rest/v1/event_charges`, { method: "POST", headers, body: JSON.stringify(charges), cache: "no-store" });
    if (!chargesResponse.ok) return { error: "The event was saved, but its member charges could not be saved." };
  }
  revalidatePath("/dashboard/schedule");
  if (formData.get("notifyMembers") === "true" && context.isAdmin) {
    try {
      const membershipResponse = await fetch(`${context.url}/rest/v1/memberships?select=id&band_id=eq.${encodeURIComponent(context.bandId)}&confirmed=eq.true`, { headers: context.headers, cache: "no-store" });
      const memberships = (await membershipResponse.json().catch(() => [])) as { id: string }[];
      if (!membershipResponse.ok) return { notificationWarning: "The event was saved, but member notifications could not be prepared." };
      const eventTitle = title || (type === "gig" ? "Gig" : "Practice");
      const locationText = location ? ` at ${location}` : "";
      const repeatsText = repeatWeeks ? " This event is part of a repeating series." : "";
      const eventEnd = new Date(start.getTime() + durationMinutes * 60_000);
      const notificationResult = await sendNotification({
        recipientMembershipIds: memberships.map((membership) => membership.id),
        notification: {
          title: `${type === "gig" ? "Gig" : "Practice"}: ${eventTitle}`,
          body: `${formatEventDateTime(start)} – ${formatEventDateTime(eventEnd)}${locationText}.${repeatsText}`,
          url: "/dashboard/schedule",
        },
      });
      if (notificationResult.failed && !notificationResult.sent) return { notificationWarning: "The event was saved, but push notifications could not be delivered. Check that members have enabled notifications." };
      if (!notificationResult.sent) return { notificationWarning: "The event was saved, but no members have enabled push notifications yet." };
      return { notificationSent: true };
    } catch {
      return { notificationWarning: "The event was saved, but push notification delivery failed." };
    }
  }
  return {};
}