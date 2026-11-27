"use client";

import { useRef, useState } from "react";
import { deleteSongRecording, uploadSongRecording, type SongRecording } from "@/lib/backend/recordings";
import type { Song } from "@/lib/backend/songs";
import LoadingSpinner from "../loading-spinner";
import { TrashIcon } from "../icons";

function RecordingPlayer({ url, title, filename }: { url: string; title: string; filename: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [playError, setPlayError] = useState("");
  async function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    setPlayError("");
    if (audio.paused) {
      try { await audio.play(); } catch { setPlayError("Unable to play this recording. Try again or reload the page."); }
    } else audio.pause();
  }
  function stop() {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setPlaying(false);
    setPlayError("");
  }
  return <div className="flex flex-wrap items-center gap-2"><audio ref={audioRef} src={url} preload="none" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} onError={() => { setPlaying(false); setPlayError("Unable to load this recording. Reload the page to refresh its audio link."); }} className="hidden" /><button type="button" onClick={() => void toggle()} aria-label={`${playing ? "Pause" : "Play"} ${title}`} title={playing ? "Pause" : "Play"} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#fff1e9] text-[#a04420] hover:bg-[#ffe4d8]"><svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">{playing ? <path d="M7 5h4v14H7zM15 5v14h4V5z" /> : <path d="M7 4.5v15l12-7.5z" />}</svg></button><button type="button" onClick={stop} aria-label={`Stop and restart ${title}`} title="Stop and restart" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#ddd8d1] bg-white text-[#303942] hover:bg-[#f8f5f1]"><svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="1" /></svg></button><a href={url} download={filename} aria-label={`Download ${title}`} title="Download MP3" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#ddd8d1] bg-white text-[#303942] hover:bg-[#f8f5f1]"><svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5M12 15V3" /></svg></a>{playError && <span role="alert" className="basis-full text-xs text-[#a04420]">{playError}</span>}</div>;
}

export default function RecordingsClient({ songs, initialRecordings }: { songs: Song[]; initialRecordings: SongRecording[] }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setMessage("");
    const form = event.currentTarget;
    try {
      const result = await uploadSongRecording(new FormData(form));
      if (result.error) setMessage(result.error);
      else { setOpen(false); window.location.reload(); }
    } catch {
      setMessage("The upload failed. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function removeRecording(recording: SongRecording) {
    if (deletingId || !window.confirm(`Permanently delete “${recording.label || "Recording"}” from storage and your recordings list?`)) return;
    setDeletingId(recording.id);
    setMessage("");
    try {
      const result = await deleteSongRecording(recording.id);
      if (result.error) setMessage(result.error);
      else window.location.reload();
    } catch {
      setMessage("Unable to delete the recording. Check your connection and try again.");
    } finally {
      setDeletingId(null);
    }
  }

  return <div className="mt-6 sm:mt-8">
    <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-[#17202a]">Recordings</h2><p className="text-sm text-[#69727d]">{initialRecordings.length} recording{initialRecordings.length === 1 ? "" : "s"}</p></div><button type="button" onClick={() => { setMessage(""); setOpen(true); }} disabled={!songs.length} aria-label="Add recording" title="Add recording" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#ff6b35] text-3xl font-light leading-none text-white shadow-sm hover:bg-[#e95a27] disabled:cursor-not-allowed disabled:opacity-50">+</button></div>
    {!initialRecordings.length ? <div className="rounded-2xl border border-dashed border-[#d9d1c1] bg-white px-5 py-10 text-center text-sm text-[#69727d]">No recordings uploaded yet. Use + to add an MP3 to a song.</div> : <div className="space-y-3">{initialRecordings.map((recording) => {
      const song = songs.find((item) => item.id === recording.song_id);
      const filename = `${(song?.title || recording.label || "recording").replace(/[^a-zA-Z0-9_-]+/g, "-")}.mp3`;
      return <section key={recording.id} className="rounded-xl border border-[#e8e1e9] bg-white p-3 shadow-sm sm:rounded-2xl sm:p-4"><div className="mb-2 flex items-start justify-between gap-2"><div className="min-w-0"><h3 className="truncate text-base font-bold leading-5 text-[#17202a]">{song?.title || "Song recording"}</h3>{song?.artist && <p className="truncate text-xs text-[#69727d]">{song.artist}</p>}{recording.label && <p className="truncate text-xs font-medium text-[#a04420]">{recording.label}</p>}</div><div className="flex shrink-0 items-center gap-1"><time className="text-[11px] text-[#9299a1]">{new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", timeZone: "Australia/Sydney" }).format(new Date(recording.created_at))}</time><button type="button" onClick={() => void removeRecording(recording)} disabled={deletingId !== null} aria-label={`Delete ${song?.title || recording.label || "recording"}`} title="Delete recording permanently" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#a04420] hover:bg-[#fff4ed] disabled:cursor-not-allowed disabled:opacity-50">{deletingId === recording.id ? <LoadingSpinner label="" /> : <TrashIcon className="h-4 w-4" />}</button></div></div>{recording.download_url ? <RecordingPlayer url={recording.download_url} title={song?.title || recording.label || "recording"} filename={filename} /> : <p className="text-xs text-[#a04420]">Audio link unavailable. Reload to try again.</p>}</section>;
    })}</div>}

    {open && <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#17202a]/40 p-0 sm:items-center sm:p-5" onClick={() => { if (!saving) setOpen(false); }}><div role="dialog" aria-modal="true" aria-labelledby="recording-upload-title" className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-7" onClick={(event) => event.stopPropagation()}><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#ff6b35]">Music library</p><h2 id="recording-upload-title" className="mt-1 text-xl font-semibold text-[#17202a]">Add recording</h2></div><button type="button" onClick={() => setOpen(false)} disabled={saving} aria-label="Close upload dialog" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-2xl text-[#69727d] hover:bg-[#f5f2ee] disabled:opacity-50">&times;</button></div><form onSubmit={upload} className="mt-5 space-y-4"><label className="block text-sm font-medium text-[#303942]">Song<select name="songId" required defaultValue="" className="mt-2 h-11 w-full rounded-xl border border-[#ddd8d1] bg-white px-3"><option value="" disabled>Select a song</option>{songs.map((song) => <option key={song.id} value={song.id}>{song.title}{song.artist ? ` — ${song.artist}` : ""}</option>)}</select></label><label className="block text-sm font-medium text-[#303942]">Recording label <span className="font-normal text-[#9299a1]">(optional)</span><input name="label" type="text" maxLength={100} placeholder="e.g. Live rehearsal, acoustic demo" className="mt-2 h-11 w-full rounded-xl border border-[#ddd8d1] px-3" /></label><label className="block text-sm font-medium text-[#303942]">MP3 file <span className="font-normal text-[#9299a1]">(max 50 MB)</span><input name="file" type="file" accept=".mp3,audio/mpeg" required className="mt-2 block min-h-12 w-full rounded-xl border border-[#ddd8d1] bg-white p-2 text-sm file:mr-3 file:min-h-9 file:rounded-lg file:border-0 file:bg-[#fff1e9] file:px-3 file:font-semibold file:text-[#a04420]" /></label>{message && <p role="alert" className="rounded-xl bg-[#fff4ed] px-4 py-3 text-sm text-[#a04420]">{message}</p>}<div className="flex gap-3 pt-1"><button type="button" onClick={() => setOpen(false)} disabled={saving} className="h-11 flex-1 rounded-xl bg-[#f5f2ee] text-sm font-semibold text-[#303942] disabled:opacity-50">Cancel</button><button type="submit" disabled={saving} className="flex h-11 flex-1 items-center justify-center rounded-xl bg-[#ff6b35] text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{saving ? <LoadingSpinner label="Uploading..." /> : "Upload"}</button></div></form></div></div>}
  </div>;
}