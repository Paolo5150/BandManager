"use client";

import { useState } from "react";
import { createSong, deleteSong, getSongs, searchDeezerSongs, type DeezerSong, type Song } from "@/lib/backend/songs";
import LoadingSpinner from "../loading-spinner";

function durationLabel(seconds?: number | null) { return seconds ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` : null; }
function totalDurationLabel(seconds: number) { const hours = Math.floor(seconds / 3600); const minutes = Math.floor((seconds % 3600) / 60); const remainingSeconds = seconds % 60; return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`; }

export default function SonglistClient({ initialSongs }: { initialSongs: Song[]; isAdmin: boolean }) {
  const [songs, setSongs] = useState(initialSongs); const [open, setOpen] = useState(false); const [message, setMessage] = useState(""); const [saving, setSaving] = useState(false); const [searching, setSearching] = useState(false); const [query, setQuery] = useState(""); const [results, setResults] = useState<DeezerSong[]>([]); const [selected, setSelected] = useState<DeezerSong | null>(null);
  async function add(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); setMessage(""); const form = event.currentTarget; const result = await createSong(new FormData(form)); if (result.error) setMessage(result.error); else { setSongs(await getSongs()); form.reset(); setOpen(false); } setSaving(false); }
  async function remove(song: Song) { if (!window.confirm(`Remove \"${song.title}\" from the songlist?`)) return; setSaving(true); const data = new FormData(); data.set("songId", song.id); const result = await deleteSong(data); if (result.error) setMessage(result.error); else setSongs((current) => current.filter((item) => item.id !== song.id)); setSaving(false); }
  async function search() { setSearching(true); setMessage(""); const result = await searchDeezerSongs(query); setResults(result.songs ?? []); if (result.error) setMessage(result.error); setSearching(false); }
  function choose(result: DeezerSong) { setSelected(result); setResults([]); setQuery(`${result.title} ${result.artist.name}`); }
  function updateSelected(field: "title" | "artist" | "duration", value: string) { setSelected((current) => current ? { ...current, ...(field === "title" ? { title: value } : field === "artist" ? { artist: { ...current.artist, name: value } } : { duration: Number(value) || 0 }) } : null); }
  function durationSeconds(value: string) { const [minutes, seconds] = value.split(":").map(Number); return Number.isFinite(minutes) && Number.isFinite(seconds) ? Math.max(0, Math.round(minutes * 60 + seconds)) : 0; }
  return <>
    <div className="flex items-end justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-wider text-[#ff6b35]">Band</p><h1 className="mt-2 text-3xl font-semibold text-[#17202a]">Songlist</h1><p className="mt-2 text-sm text-[#69727d]">Songs your band can rehearse and perform.</p><div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm font-medium text-[#69727d]"><span>Total songs: <b className="text-[#17202a]">{songs.length}</b></span><span>Total duration: <b className="text-[#17202a]">{totalDurationLabel(songs.reduce((total, song) => total + (song.duration_seconds ?? 0), 0))}</b></span></div></div><button type="button" onClick={() => { setMessage(""); setOpen(true); }} className="rounded-xl bg-[#ff6b35] px-4 py-2.5 text-sm font-semibold text-white" aria-label="Add song" title="Add song">+</button></div>
    {message && <p className="mt-5 rounded-xl bg-[#fff4ed] px-4 py-3 text-sm text-[#a04420]">{message}</p>}
    {!songs.length ? <div className="mt-8 rounded-2xl border border-dashed border-[#d9d1c9] bg-white px-5 py-12 text-center text-sm text-[#69727d]">No songs yet.</div> : <div className="mt-8 overflow-hidden rounded-2xl border border-[#e8e1e9] bg-white">{songs.map((song) => <div key={song.id} className="flex items-center justify-between gap-4 border-b border-[#eee9e3] px-5 py-4 last:border-b-0"><div><p className="font-medium text-[#17202a]">{song.title}</p><p className="mt-1 text-sm text-[#69727d]">{song.artist || "Artist not specified"}{durationLabel(song.duration_seconds) ? ` - ${durationLabel(song.duration_seconds)}` : ""}</p>{song.notes && <p className="mt-1 text-xs text-[#a0a5aa]">{song.notes}</p>}</div><button type="button" onClick={() => void remove(song)} aria-label={`Remove ${song.title}`} title="Remove song" className="flex h-9 w-9 items-center justify-center rounded-lg text-lg text-[#a04420] hover:bg-[#fff4ed]">×</button></div>)}</div>}
    {open && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-5">
        <form onSubmit={add} className="max-h-[92vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-7">
          <div className="flex items-center justify-between"><h2 className="text-2xl font-semibold">Add song</h2><button type="button" onClick={() => setOpen(false)} className="text-2xl">&times;</button></div>
          <div><label className="block text-sm font-medium text-[#303942]">Search Deezer<div className="mt-2 flex gap-2"><input value={query} onChange={(event) => { setQuery(event.target.value); setSelected(null); }} placeholder="Song title or artist" className="h-11 min-w-0 flex-1 rounded-xl border px-3" /><button type="button" onClick={() => void search()} disabled={searching} className="rounded-xl border border-[#ff6b35] px-4 text-sm font-semibold text-[#e95a27] disabled:opacity-50">{searching ? "Searching..." : "Search"}</button></div>{results.length > 0 && <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border">{results.map((result) => <button key={result.id} type="button" onClick={() => choose(result)} className="flex w-full items-center justify-between border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-[#fff4ed]"><span><b>{result.title}</b><br /><span className="text-[#69727d]">{result.artist.name}</span></span><span className="text-xs text-[#69727d]">{durationLabel(result.duration)}</span></button>)}</div>}</label></div>
          <label className="block text-sm font-medium text-[#303942]">Title<input name="title" required value={selected?.title ?? ""} onChange={(event) => updateSelected("title", event.target.value)} className="mt-2 h-11 w-full rounded-xl border px-3" /></label>
          <label className="block text-sm font-medium text-[#303942]">Artist<input name="artist" value={selected?.artist.name ?? ""} onChange={(event) => updateSelected("artist", event.target.value)} className="mt-2 h-11 w-full rounded-xl border px-3" /></label>
          <label className="block text-sm font-medium text-[#303942]">Duration
            <input
              type="text"
              inputMode="numeric"
              placeholder="m:ss"
              value={selected ? durationLabel(selected.duration) ?? "" : ""}
              onChange={(event) => setSelected((current) => current ? { ...current, duration: durationSeconds(event.target.value) } : { id: 0, title: "", artist: { name: "" }, duration: durationSeconds(event.target.value) })}
              className="mt-2 h-11 w-full rounded-xl border px-3"
            />
            <input type="hidden" name="durationSeconds" value={selected?.duration || ""} />
          </label>
          <label className="block text-sm font-medium text-[#303942]">Notes<textarea name="notes" className="mt-2 w-full rounded-xl border px-3 py-2" /></label>
          <button type="submit" disabled={saving} className="flex h-11 w-full items-center justify-center rounded-xl bg-[#ff6b35] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{saving ? <LoadingSpinner label="Adding..." /> : "Add song"}</button>
        </form>
      </div>
    )}
  </>;
}