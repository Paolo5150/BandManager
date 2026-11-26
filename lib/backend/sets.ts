"use server";

import { getBandContext as context } from "@/lib/backend/band-context";
import { revalidatePath } from "next/cache";
import type { Song } from "@/lib/backend/songs";

export type SetItem = { id: string; position: number; type: "song" | "break"; song_id?: string | null; break_minutes?: number | null; label?: string | null; song?: Song | null };
export type BandSet = { id: string; name: string; notes?: string | null; created_at: string; last_modified?: string | null; modified_by?: string | null; modifier_name?: string | null; items: SetItem[]; duration_seconds: number };

export async function getSets(): Promise<BandSet[]> {
  const c = await context(); if (!c) return [];
  const setsResponse = await fetch(`${c.url}/rest/v1/sets?select=id,name,notes,created_at,last_modified,modified_by&band_id=eq.${encodeURIComponent(c.bandId)}&order=created_at.desc`, { headers: c.headers, cache: "no-store" });
  const sets = (await setsResponse.json().catch(() => [])) as Omit<BandSet, "items" | "duration_seconds">[];
  if (!setsResponse.ok || !sets.length) return [];
  const modifierIds = sets.map((set) => set.modified_by).filter((id): id is string => Boolean(id));
  const modifiersResponse = modifierIds.length ? await fetch(`${c.url}/rest/v1/memberships?select=user_id,display_name&band_id=eq.${encodeURIComponent(c.bandId)}&confirmed=eq.true&user_id=in.(${modifierIds.map(encodeURIComponent).join(",")})`, { headers: c.headers, cache: "no-store" }) : null;
  const modifiers = ((await modifiersResponse?.json().catch(() => [])) ?? []) as { user_id: string; display_name?: string | null }[];
  const modifierNames = new Map(modifiers.map((modifier) => [modifier.user_id, modifier.display_name || "Band member"]));
  const itemsResponse = await fetch(`${c.url}/rest/v1/set_items?select=id,set_id,position,type,song_id,break_minutes,label&band_id=eq.${encodeURIComponent(c.bandId)}&order=position.asc`, { headers: c.headers, cache: "no-store" });
  const items = ((await itemsResponse.json().catch(() => [])) ?? []) as (SetItem & { set_id: string })[];
  const songIds = items.map((item) => item.song_id).filter((id): id is string => Boolean(id));
  const songsResponse = songIds.length ? await fetch(`${c.url}/rest/v1/songs?select=id,title,artist,duration_seconds,notes,created_at&band_id=eq.${encodeURIComponent(c.bandId)}&id=in.(${songIds.map(encodeURIComponent).join(",")})`, { headers: c.headers, cache: "no-store" }) : null;
  const songs = ((await songsResponse?.json().catch(() => [])) ?? []) as Song[];
  const songById = new Map(songs.map((song) => [song.id, song]));
  return sets.map((set) => {
    const setItems = items.filter((item) => item.set_id === set.id).map((item) => ({
      id: item.id,
      position: item.position,
      type: item.type,
      song_id: item.song_id,
      break_minutes: item.break_minutes,
      label: item.label,
      song: item.song_id ? songById.get(item.song_id) ?? null : null,
    }));
    const duration_seconds = setItems.reduce((total, item) => total + (item.type === "break" ? (item.break_minutes ?? 0) * 60 : item.song?.duration_seconds ?? 0), 0);
    return { ...set, modifier_name: set.modified_by ? modifierNames.get(set.modified_by) ?? "Band member" : null, items: setItems, duration_seconds };
  });
}

export async function createSet(formData: FormData): Promise<{ error?: string }> {
  const c = await context(); if (!c) return { error: "You must be a confirmed band member." };
  const name = String(formData.get("name") ?? "").trim(); const notes = String(formData.get("notes") ?? "").trim() || null;
  if (!name) return { error: "Enter a set name." };
  const rawItems = String(formData.get("items") ?? "[]");
  const items = JSON.parse(rawItems) as { type: "song" | "break"; song_id?: string; break_minutes?: number; label?: string }[];
  const setResponse = await fetch(`${c.url}/rest/v1/sets`, { method: "POST", headers: { ...c.headers, "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify({ band_id: c.bandId, name, notes, last_modified: new Date().toISOString(), modified_by: c.userId }), cache: "no-store" });
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
  if (!c || !setId) return { error: "You must be a confirmed band member." };
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
  const modified = await fetch(`${c.url}/rest/v1/sets?id=eq.${encodeURIComponent(setId)}&band_id=eq.${encodeURIComponent(c.bandId)}`, { method: "PATCH", headers: { ...c.headers, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ last_modified: new Date().toISOString(), modified_by: c.userId }), cache: "no-store" });
  if (!modified.ok) return { error: "The set items were saved, but its modification details could not be recorded." };
  revalidatePath("/dashboard/sets"); return {};
}

export async function deleteSet(formData: FormData): Promise<{ error?: string }> {
  const c = await context(); const id = String(formData.get("setId") ?? "");
  if (!c || !id) return { error: "You must be a confirmed band member." };
  const response = await fetch(`${c.url}/rest/v1/sets?id=eq.${encodeURIComponent(id)}&band_id=eq.${encodeURIComponent(c.bandId)}`, { method: "DELETE", headers: c.headers, cache: "no-store" });
  if (!response.ok) return { error: "Unable to remove the set." }; revalidatePath("/dashboard/sets"); return {};
}