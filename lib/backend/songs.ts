"use server";

import { getBandContext as getContext } from "@/lib/backend/band-context";
import { revalidatePath } from "next/cache";

export type Song = { id: string; title: string; artist?: string | null; duration_seconds?: number | null; notes?: string | null; created_at: string };
export type DeezerSong = { id: number; title: string; artist: { name: string }; duration: number };
export type SongRating = { song_id: string; membership_id: string; score: number; member_name: string; is_current_user: boolean };

export async function getSongs(): Promise<Song[]> {
  const context = await getContext(); if (!context) return [];
  const response = await fetch(`${context.url}/rest/v1/songs?select=id,title,artist,duration_seconds,notes,created_at&band_id=eq.${encodeURIComponent(context.bandId)}&order=title.asc`, { headers: context.headers, cache: "no-store" });
  return response.ok ? ((await response.json().catch(() => [])) as Song[]) : [];
}

export async function getSongRatings(): Promise<SongRating[]> {
  const context = await getContext(); if (!context) return [];
  const response = await fetch(`${context.url}/rest/v1/song_ratings?select=song_id,membership_id,score,memberships(display_name)&band_id=eq.${encodeURIComponent(context.bandId)}`, { headers: context.headers, cache: "no-store" });
  const rows = (await response.json().catch(() => [])) as { song_id: string; membership_id: string; score: number; memberships?: { display_name?: string | null } | null }[];
  return response.ok ? rows.map((row) => ({ song_id: row.song_id, membership_id: row.membership_id, score: row.score, member_name: row.memberships?.display_name || "Band member", is_current_user: row.membership_id === context.membershipId })) : [];
}

export async function saveSongRating(formData: FormData): Promise<{ error?: string }> {
  const context = await getContext();
  const songId = String(formData.get("songId") ?? "");
  const score = Number(formData.get("score"));
  if (!context) return { error: "You must be a confirmed band member." };
  if (!songId || !Number.isInteger(score) || score < 1 || score > 5) return { error: "Choose a rating from 1 to 5 stars." };
  const response = await fetch(`${context.url}/rest/v1/song_ratings?on_conflict=song_id,membership_id`, { method: "POST", headers: { ...context.headers, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ band_id: context.bandId, song_id: songId, membership_id: context.membershipId, score }), cache: "no-store" });
  return response.ok ? {} : { error: "Unable to save your rating." };
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
  const ratingsResponse = await fetch(`${context.url}/rest/v1/song_ratings?song_id=eq.${encodeURIComponent(songId)}&band_id=eq.${encodeURIComponent(context.bandId)}`, { method: "DELETE", headers: context.headers, cache: "no-store" });
  if (!ratingsResponse.ok) return { error: "The song was removed, but its ratings could not be cleaned up." };
  revalidatePath("/dashboard/songlist"); return {};
}