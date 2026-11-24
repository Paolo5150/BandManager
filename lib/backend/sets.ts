"use server";

import { getAccessToken } from "@/lib/backend/session";
import { revalidatePath } from "next/cache";
import type { Song } from "@/lib/backend/songs";

export type SetItem = { id: string; position: number; type: "song" | "break"; song_id?: string | null; break_minutes?: number | null; label?: string | null; song?: Song | null };
export type BandSet = { id: string; name: string; notes?: string | null; created_at: string; items: SetItem[]; duration_seconds: number };

async function context() {
  const token = await getAccessToken(); const url = process.env.SUPABASE_URL; const secret = process.env.SUPABASE_SECRET_KEY; const publishable = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!token || !url || !secret || !publishable) return null;
  const auth = await fetch(`${url}/auth/v1/user`, { headers: { apikey: publishable, Authorization: `Bearer ${token}` }, cache: "no-store" });
  const user = (await auth.json().catch(() => null)) as { id?: string } | null;
  if (!auth.ok || !user?.id) return null;
  const headers = { apikey: secret, Authorization: `Bearer ${secret}` };
  const membership = await fetch(`${url}/rest/v1/memberships?select=band_id,role&user_id=eq.${encodeURIComponent(user.id)}&confirmed=eq.true&limit=1`, { headers, cache: "no-store" });
  const rows = (await membership.json().catch(() => [])) as { band_id?: string; role?: string }[];
  return membership.ok && rows[0]?.band_id ? { url, headers, bandId: rows[0].band_id, isAdmin: rows[0].role === "admin" } : null;
}

export async function getSets(): Promise<BandSet[]> {
  const c = await context(); if (!c) return [];
  const setsResponse = await fetch(`${c.url}/rest/v1/sets?select=id,name,notes,created_at&band_id=eq.${encodeURIComponent(c.bandId)}&order=created_at.desc`, { headers: c.headers, cache: "no-store" });
  const sets = (await setsResponse.json().catch(() => [])) as Omit<BandSet, "items" | "duration_seconds">[];
  if (!setsResponse.ok || !sets.length) return [];
  const itemsResponse = await fetch(`${c.url}/rest/v1/set_items?select=id,set_id,position,type,song_id,break_minutes,label&band_id=eq.${encodeURIComponent(c.bandId)}&order=position.asc`, { headers: c.headers, cache: "no-store" });
  const items = ((await itemsResponse.json().catch(() => [])) ?? []) as (SetItem & { set_id: string })[];
  const songIds = items.map((item) => item.song_id).filter((id): id is string => Boolean(id));
  const songsResponse = songIds.length ? await fetch(`${c.url}/rest/v1/songs?select=id,title,artist,duration_seconds,notes,created_at&band_id=eq.${encodeURIComponent(c.bandId)}&id=in.(${songIds.map(encodeURIComponent).join(",")})`, { headers: c.headers, cache: "no-store" }) : null;
  const songs = ((await songsResponse?.json().catch(() => [])) ?? []) as Song[];
  const songById = new Map(songs.map((song) => [song.id, song]));
  return sets.map((set) => {
    const setItems = items.filter((item) => item.set_id === set.id).map(({ set_id: _setId, ...item }) => ({ ...item, song: item.song_id ? songById.get(item.song_id) ?? null : null }));
    const duration_seconds = setItems.reduce((total, item) => total + (item.type === "break" ? (item.break_minutes ?? 0) * 60 : item.song?.duration_seconds ?? 0), 0);
    return { ...set, items: setItems, duration_seconds };
  });
}

export async function createSet(formData: FormData): Promise<{ error?: string }> {
  const c = await context(); if (!c?.isAdmin) return { error: "Only admins can create sets." };
  const name = String(formData.get("name") ?? "").trim(); const notes = String(formData.get("notes") ?? "").trim() || null;
  if (!name) return { error: "Enter a set name." };
  const rawItems = String(formData.get("items") ?? "[]");
  const items = JSON.parse(rawItems) as { type: "song" | "break"; song_id?: string; break_minutes?: number; label?: string }[];
  const setResponse = await fetch(`${c.url}/rest/v1/sets`, { method: "POST", headers: { ...c.headers, "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify({ band_id: c.bandId, name, notes }), cache: "no-store" });
  const created = (await setResponse.json().catch(() => [])) as { id?: string }[];
  if (!setResponse.ok || !created[0]?.id) return { error: "Unable to create the set." };
  if (!items.length) { revalidatePath("/dashboard/sets"); return {}; }
  const rows = items.map((item, index) => ({ band_id: c.bandId, set_id: created[0]!.id, position: index + 1, type: item.type, song_id: item.type === "song" ? item.song_id : null, break_minutes: item.type === "break" ? item.break_minutes : null, label: item.label || null }));
  const itemResponse = await fetch(`${c.url}/rest/v1/set_items`, { method: "POST", headers: { ...c.headers, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(rows), cache: "no-store" });
  if (!itemResponse.ok) return { error: "The set was created, but its items could not be saved." };
  revalidatePath("/dashboard/sets"); return {};
}

export async function updateSetItems(formData: FormData): Promise<{ error?: string }> {
  const c = await context(); const setId = String(formData.get("setId") ?? "");
  if (!c?.isAdmin || !setId) return { error: "Only admins can edit sets." };
  let items: { type: "song" | "break"; song_id?: string; break_minutes?: number; label?: string }[];
  try {
    items = JSON.parse(String(formData.get("items") ?? "[]")) as typeof items;
  } catch {
    return { error: "The set order is invalid." };
  }
  if (items.some((item) => item.type === "song" ? !item.song_id : item.type !== "break" || !Number.isInteger(item.break_minutes) || (item.break_minutes ?? 0) <= 0)) return { error: "Each set item must be a valid song or break." };
  const removed = await fetch(`${c.url}/rest/v1/set_items?set_id=eq.${encodeURIComponent(setId)}&band_id=eq.${encodeURIComponent(c.bandId)}`, { method: "DELETE", headers: c.headers, cache: "no-store" });
  if (!removed.ok) return { error: `Unable to remove the old set items. ${await removed.text().catch(() => "")}`.trim() };
  if (items.length) {
    const rows = items.map((item, index) => ({ band_id: c.bandId, set_id: setId, position: index + 1, type: item.type, song_id: item.type === "song" ? item.song_id : null, break_minutes: item.type === "break" ? item.break_minutes : null, label: item.label || null }));
    const inserted = await fetch(`${c.url}/rest/v1/set_items`, { method: "POST", headers: { ...c.headers, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(rows), cache: "no-store" });
    if (!inserted.ok) return { error: `Unable to save the set items. ${await inserted.text().catch(() => "")}`.trim() };
  }
  revalidatePath("/dashboard/sets"); return {};
}

export async function deleteSet(formData: FormData): Promise<{ error?: string }> {
  const c = await context(); const id = String(formData.get("setId") ?? "");
  if (!c?.isAdmin || !id) return { error: "Only admins can remove sets." };
  const response = await fetch(`${c.url}/rest/v1/sets?id=eq.${encodeURIComponent(id)}&band_id=eq.${encodeURIComponent(c.bandId)}`, { method: "DELETE", headers: c.headers, cache: "no-store" });
  if (!response.ok) return { error: "Unable to remove the set." }; revalidatePath("/dashboard/sets"); return {};
}