"use server";

import { getAccessToken } from "@/lib/backend/session";
import { revalidatePath } from "next/cache";

export type Song = { id: string; title: string; artist?: string | null; duration_seconds?: number | null; notes?: string | null; created_at: string };

async function getContext() {
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

export async function getSongs(): Promise<Song[]> {
  const context = await getContext(); if (!context) return [];
  const response = await fetch(`${context.url}/rest/v1/songs?select=id,title,artist,duration_seconds,notes,created_at&band_id=eq.${encodeURIComponent(context.bandId)}&order=title.asc`, { headers: context.headers, cache: "no-store" });
  return response.ok ? ((await response.json().catch(() => [])) as Song[]) : [];
}

export async function createSong(formData: FormData): Promise<{ error?: string }> {
  const context = await getContext(); if (!context?.isAdmin) return { error: "Only admins can add songs." };
  const title = String(formData.get("title") ?? "").trim(); if (!title) return { error: "Enter a song title." };
  const duration = Number(formData.get("durationSeconds") ?? 0);
  const body = { band_id: context.bandId, title, artist: String(formData.get("artist") ?? "").trim() || null, duration_seconds: Number.isFinite(duration) && duration > 0 ? Math.round(duration) : null, notes: String(formData.get("notes") ?? "").trim() || null };
  const response = await fetch(`${context.url}/rest/v1/songs`, { method: "POST", headers: { ...context.headers, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(body), cache: "no-store" });
  if (!response.ok) return { error: "Unable to add the song." }; revalidatePath("/dashboard/songlist"); return {};
}

export async function deleteSong(formData: FormData): Promise<{ error?: string }> {
  const context = await getContext(); const songId = String(formData.get("songId") ?? "");
  if (!context?.isAdmin) return { error: "Only admins can remove songs." }; if (!songId) return { error: "Song not found." };
  const response = await fetch(`${context.url}/rest/v1/songs?id=eq.${encodeURIComponent(songId)}&band_id=eq.${encodeURIComponent(context.bandId)}`, { method: "DELETE", headers: context.headers, cache: "no-store" });
  if (!response.ok) return { error: "Unable to remove the song." }; revalidatePath("/dashboard/songlist"); return {};
}