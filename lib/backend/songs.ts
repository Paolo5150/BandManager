"use server";

import { getAccessToken } from "@/lib/backend/session";
import { revalidatePath } from "next/cache";

export type Song = { id: string; title: string; artist?: string | null; duration_seconds?: number | null; notes?: string | null; created_at: string };
export type DeezerSong = { id: number; title: string; artist: { name: string }; duration: number };

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

export async function searchDeezerSongs(query: string): Promise<{ songs?: DeezerSong[]; error?: string }> {
  const context = await getContext();
  if (!context) return { error: "You must be a confirmed band member." };
  const trimmed = query.trim();
  if (!trimmed) return { error: "Enter part of a song title or artist." };
  try {
    async function request(searchQuery: string) {
      const response = await fetch(
        `https://api.deezer.com/search?q=${encodeURIComponent(searchQuery)}&limit=25`,
        { cache: "no-store" },
      );
      const body = (await response.json().catch(() => null)) as {
        data?: DeezerSong[];
        error?: { message?: string };
      } | null;
      return { response, body };
    }

    const first = await request(trimmed);
    if (!first.response.ok || first.body?.error) {
      return { error: first.body?.error?.message ?? `Deezer search failed (${first.response.status}).` };
    }

    if (first.body?.data?.length) return { songs: first.body.data };

    // Deezer can be more reliable when punctuation and extra search terms are
    // removed, especially for requests coming through a production proxy.
    const simplified = trimmed.replace(/[()[\]{}]/g, " ").replace(/\s+/g, " ").trim();
    if (simplified && simplified !== trimmed) {
      const fallback = await request(simplified);
      if (!fallback.response.ok || fallback.body?.error) {
        return { error: fallback.body?.error?.message ?? `Deezer search failed (${fallback.response.status}).` };
      }
      return { songs: fallback.body?.data ?? [] };
    }

    return { songs: [] };
  } catch {
    return { error: "Unable to reach Deezer." };
  }
}

export async function createSong(formData: FormData): Promise<{ error?: string }> {
  const context = await getContext(); if (!context) return { error: "You must be a confirmed band member." };
  const title = String(formData.get("title") ?? "").trim(); if (!title) return { error: "Enter a song title." };
  const duration = Number(formData.get("durationSeconds") ?? 0);
  const body = { band_id: context.bandId, title, artist: String(formData.get("artist") ?? "").trim() || null, duration_seconds: Number.isFinite(duration) && duration > 0 ? Math.round(duration) : null, notes: String(formData.get("notes") ?? "").trim() || null };
  const response = await fetch(`${context.url}/rest/v1/songs`, { method: "POST", headers: { ...context.headers, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(body), cache: "no-store" });
  if (!response.ok) return { error: "Unable to add the song." }; revalidatePath("/dashboard/songlist"); return {};
}

export async function deleteSong(formData: FormData): Promise<{ error?: string }> {
  const context = await getContext(); const songId = String(formData.get("songId") ?? "");
  if (!context) return { error: "You must be a confirmed band member." }; if (!songId) return { error: "Song not found." };
  const response = await fetch(`${context.url}/rest/v1/songs?id=eq.${encodeURIComponent(songId)}&band_id=eq.${encodeURIComponent(context.bandId)}`, { method: "DELETE", headers: context.headers, cache: "no-store" });
  if (!response.ok) {
    const details = await response.text().catch(() => "");
    return { error: details.includes("set_items") || details.includes("foreign key") ? "This song is used in a set and cannot be removed." : "Unable to remove the song." };
  }
  revalidatePath("/dashboard/songlist"); return {};
}