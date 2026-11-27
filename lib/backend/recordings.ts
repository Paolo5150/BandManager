"use server";

import { getBandContext } from "@/lib/backend/band-context";
import { getSongs, type Song } from "@/lib/backend/songs";
import { revalidatePath } from "next/cache";

export type SongRecording = { id: string; song_id: string; storage_path: string; label: string | null; created_at: string; download_url: string };

export async function getRecordings(): Promise<{ songs: Song[]; recordings: SongRecording[] }> {
  const context = await getBandContext();
  if (!context) return { songs: [], recordings: [] };
  const songs = await getSongs();
  const response = await fetch(`${context.url}/rest/v1/song_recordings?select=id,song_id,storage_path,label,created_at&band_id=eq.${encodeURIComponent(context.bandId)}&order=created_at.desc`, { headers: context.headers, cache: "no-store" });
  const rows = (await response.json().catch(() => [])) as Omit<SongRecording, "download_url">[];
  if (!response.ok || !rows.length) return { songs, recordings: [] };
  const recordings = await Promise.all(rows.map(async (row) => {
    try {
      const signed = await fetch(`${context.url}/storage/v1/object/sign/recordings/${row.storage_path.split("/").map(encodeURIComponent).join("/")}`, { method: "POST", headers: { ...context.headers, "Content-Type": "application/json" }, body: JSON.stringify({ expiresIn: 3600, download: true }), cache: "no-store" });
      const body = (await signed.json().catch(() => null)) as { signedURL?: string } | null;
      const signedUrl = body?.signedURL;
      const downloadUrl = signed.ok && signedUrl
        ? signedUrl.startsWith("http")
          ? signedUrl
          : `${context.url}${signedUrl.startsWith("/storage/v1/") ? signedUrl : `/storage/v1${signedUrl.startsWith("/") ? signedUrl : `/${signedUrl}`}`}`
        : "";
      return { ...row, download_url: downloadUrl };
    } catch {
      return { ...row, download_url: "" };
    }
  }));
  return { songs, recordings };
}

export async function uploadSongRecording(formData: FormData): Promise<{ error?: string }> {
  const context = await getBandContext();
  if (!context) return { error: "You must be a confirmed band member." };
  const songId = String(formData.get("songId") ?? "");
  const label = String(formData.get("label") ?? "").trim() || null;
  const file = formData.get("file");
  if (!songId || !(file instanceof File) || file.size === 0) return { error: "Choose a song and an MP3 file." };
  if (file.size > 50 * 1024 * 1024) return { error: "MP3 files must be 50 MB or smaller." };
  if (!file.name.toLowerCase().endsWith(".mp3") || (file.type && !["audio/mpeg", "audio/mp3", "application/octet-stream"].includes(file.type))) return { error: "Only MP3 audio files are supported." };
  const songResponse = await fetch(`${context.url}/rest/v1/songs?select=id&id=eq.${encodeURIComponent(songId)}&band_id=eq.${encodeURIComponent(context.bandId)}&limit=1`, { headers: context.headers, cache: "no-store" });
  const songRows = (await songResponse.json().catch(() => [])) as { id?: string }[];
  if (!songResponse.ok || !songRows[0]?.id) return { error: "That song is not in your band’s songlist." };
  const safeName = file.name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(-100) || "recording.mp3";
  const storagePath = `${context.bandId}/${songId}/${crypto.randomUUID()}-${safeName}`;
  let upload: Response;
  try {
    upload = await fetch(`${context.url}/storage/v1/object/recordings/${storagePath.split("/").map(encodeURIComponent).join("/")}`, { method: "POST", headers: { ...context.headers, "Content-Type": "audio/mpeg", "x-upsert": "false" }, body: await file.arrayBuffer(), cache: "no-store" });
  } catch {
    return { error: "Could not connect to storage. Check your connection and try again." };
  }
  if (!upload.ok) return { error: "Unable to upload the MP3. Check that the recordings bucket allows this upload." };
  let metadataSaved = false;
  try {
    const metadata = await fetch(`${context.url}/rest/v1/song_recordings`, { method: "POST", headers: { ...context.headers, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ band_id: context.bandId, song_id: songId, storage_path: storagePath, label, uploaded_by: context.userId }), cache: "no-store" });
    metadataSaved = metadata.ok;
  } catch {
    metadataSaved = false;
  }
  if (!metadataSaved) {
    await fetch(`${context.url}/storage/v1/object/recordings/${storagePath.split("/").map(encodeURIComponent).join("/")}`, { method: "DELETE", headers: context.headers, cache: "no-store" }).catch(() => null);
    return { error: "The MP3 uploaded, but its recording details could not be saved. The uploaded file was cleaned up." };
  }
  revalidatePath("/dashboard/recordings");
  return {};
}

export async function deleteSongRecording(recordingId: string): Promise<{ error?: string }> {
  const context = await getBandContext();
  if (!context) return { error: "You must be a confirmed band member." };
  if (!recordingId) return { error: "Recording not found." };
  const lookup = await fetch(`${context.url}/rest/v1/song_recordings?select=id,storage_path&id=eq.${encodeURIComponent(recordingId)}&band_id=eq.${encodeURIComponent(context.bandId)}&limit=1`, { headers: context.headers, cache: "no-store" });
  const rows = (await lookup.json().catch(() => [])) as { id: string; storage_path: string }[];
  if (!lookup.ok || !rows[0]?.id || !rows[0].storage_path) return { error: "Recording not found in your band." };
  const row = rows[0];
  const objectPath = row.storage_path.split("/").map(encodeURIComponent).join("/");
  let storageDeleted = false;
  try {
    const storage = await fetch(`${context.url}/storage/v1/object/recordings/${objectPath}`, { method: "DELETE", headers: context.headers, cache: "no-store" });
    storageDeleted = storage.ok;
    if (!storage.ok && storage.status !== 404) return { error: `Unable to delete the MP3 from storage (${storage.status}). The recording entry was kept.` };
  } catch {
    return { error: "Could not connect to storage. The recording entry was kept." };
  }
  const metadata = await fetch(`${context.url}/rest/v1/song_recordings?id=eq.${encodeURIComponent(row.id)}&band_id=eq.${encodeURIComponent(context.bandId)}`, { method: "DELETE", headers: context.headers, cache: "no-store" });
  if (!metadata.ok) return { error: storageDeleted ? "The MP3 was removed from storage, but its recording entry could not be deleted." : "The MP3 was already missing from storage, but its recording entry could not be deleted." };
  revalidatePath("/dashboard/recordings");
  return {};
}