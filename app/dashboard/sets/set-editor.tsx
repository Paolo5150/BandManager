"use client";

import { useState } from "react";
import { updateSetItems, type BandSet } from "@/lib/backend/sets";
import type { Song } from "@/lib/backend/songs";
import { formatSongDuration, formatTotalDuration } from "@/lib/duration-format";
import { ChevronDownIcon, ChevronUpIcon } from "../icons";

type DraftItem = { type: "song" | "break"; song_id?: string; break_minutes?: number; label?: string; sourceId?: string };

export default function SetEditor({ set, songs, onClose }: { set: BandSet; songs: Song[]; onClose: () => void }) {
  const [items, setItems] = useState<DraftItem[]>(set.items.map((item) => item.type === "song" ? { type: "song", song_id: item.song_id ?? undefined, sourceId: item.id } : { type: "break", break_minutes: item.break_minutes ?? 5, label: item.label ?? "", sourceId: item.id }));
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [songPickerOpen, setSongPickerOpen] = useState(false);
  const [songSearch, setSongSearch] = useState("");
  const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  function move(to: number) { if (dragIndex === null || dragIndex === to) return; setItems((current) => { const next = [...current]; const [item] = next.splice(dragIndex, 1); next.splice(to, 0, item); return next; }); setDragIndex(null); }
  function moveBy(index: number, offset: number) { const target = index + offset; if (target < 0 || target >= items.length) return; setItems((current) => { const next = [...current]; const [item] = next.splice(index, 1); next.splice(target, 0, item); return next; }); }
  function addAllSongs() {
    setItems((current) => {
      const existingSongIds = new Set(current.filter((item) => item.type === "song").map((item) => item.song_id));
      return [...current, ...songs.filter((song) => !existingSongIds.has(song.id)).map((song) => ({ type: "song" as const, song_id: song.id }))];
    });
  }
  function addSong(song: Song) {
    setItems((current) => [...current, { type: "song", song_id: song.id }]);
    setSongPickerOpen(false);
    setSongSearch("");
  }
  const availableSongs = songs.filter((song) => `${song.title} ${song.artist ?? ""}`.toLowerCase().includes(songSearch.toLowerCase()));
  function songTitle(songId?: string) { const song = songs.find((entry) => entry.id === songId); return song ? `${song.title}${song.artist ? ` - ${song.artist}` : ""}` : "Choose song"; }
  function songDuration(songId?: string) { return formatSongDuration(songs.find((entry) => entry.id === songId)?.duration_seconds); }
  function sectionDuration(start: number, end: number) { return items.slice(start, end).reduce((total, item) => total + (item.type === "song" ? songs.find((song) => song.id === item.song_id)?.duration_seconds ?? 0 : 0), 0); }
  function sectionLabel(seconds: number) { return `${Math.floor(seconds / 60)} min ${seconds % 60} sec`; }
  function sectionStart(index: number) { for (let cursor = index - 1; cursor >= 0; cursor -= 1) if (items[cursor]?.type === "break") return cursor + 1; return 0; }
  async function save() { if (saving) return; setSaving(true); setError(""); try { const data = new FormData(); data.set("setId", set.id); data.set("items", JSON.stringify(items)); const result = await updateSetItems(data); if (result.error) setError(result.error); else onClose(); } finally { setSaving(false); } }
  return (
    <section className="mt-4 rounded-2xl border border-[#e8e1e9] bg-white p-2 shadow-sm sm:mt-6 sm:p-5">
      <div className="flex items-center justify-between gap-4 px-1 sm:px-0">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#ff6b35]">Editing set</p>
          <h2 className="mt-1 text-xl font-semibold text-[#17202a]">{set.name}</h2>
          <p className="mt-1 text-sm text-[#69727d]">Total song duration: <span className="font-semibold text-[#303942]">{formatTotalDuration(sectionDuration(0, items.length))}</span></p>
        </div>
        <button type="button" onClick={onClose} className="text-sm font-semibold text-[#69727d]">Discard</button>
      </div>
      {error && <p className="mt-4 rounded-xl bg-[#fff4ed] px-4 py-3 text-sm text-[#a04420]">{error}</p>}
      <div className="mt-3 space-y-1 sm:mt-4 sm:space-y-1.5">
        {items.map((item, index) => (
          <div key={item.sourceId ?? `${item.type}-${index}`}>
            <div
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => move(index)}
              className={`group flex cursor-grab items-center gap-1 rounded-lg border px-1 py-0.5 shadow-sm transition active:cursor-grabbing sm:gap-3 sm:rounded-2xl sm:px-3 sm:py-3 ${item.type === "break" ? "border-[#f0d4c5] bg-[#fff8f3]" : "border-[#e8e1e9] bg-white hover:border-[#ffb08e]"}`}
            >
              <span className="hidden text-lg text-[#a0a5aa] sm:inline" aria-hidden="true">:::</span>
              <div className="flex shrink-0 flex-col sm:hidden">
                <button type="button" onClick={() => moveBy(index, -1)} disabled={index === 0} aria-label={`Move item ${index + 1} up`} className="flex h-6 w-8 items-center justify-center rounded-md text-[#69727d] hover:bg-[#f5f2ee] disabled:opacity-30"><ChevronUpIcon className="h-4 w-4" /></button>
                <button type="button" onClick={() => moveBy(index, 1)} disabled={index === items.length - 1} aria-label={`Move item ${index + 1} down`} className="flex h-6 w-8 items-center justify-center rounded-md text-[#69727d] hover:bg-[#f5f2ee] disabled:opacity-30"><ChevronDownIcon className="h-4 w-4" /></button>
              </div>
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#f5f2ee] text-xs font-semibold text-[#69727d] sm:h-7 sm:w-7">{index + 1}</span>
              {item.type === "song" ? (
                <div className="flex min-w-0 flex-1 items-center justify-between gap-1 sm:gap-3">
                  <p className="min-w-0 break-words text-sm font-semibold leading-4 text-[#17202a] sm:leading-5">{songTitle(item.song_id)}</p>
                  {songDuration(item.song_id) && <span className="shrink-0 text-xs font-semibold text-[#69727d] sm:rounded-md sm:bg-[#f5f2ee] sm:px-2 sm:py-1">{songDuration(item.song_id)}</span>}
                </div>
              ) : (
                <div className="grid min-w-0 flex-1 grid-cols-[auto_minmax(0,1fr)] items-center gap-1 py-1 sm:flex sm:gap-3 sm:py-0">
                  <span className="text-xs font-semibold text-[#a04420] sm:rounded-lg sm:bg-[#ffe3d5] sm:px-2 sm:py-1">Break</span>
                  <div className="flex min-w-0 items-center gap-1 sm:gap-3"><input type="number" min="1" aria-label="Break length in minutes" value={item.break_minutes ?? 5} onChange={(event) => setItems((current) => current.map((row, i) => i === index ? { ...row, break_minutes: Number(event.target.value) } : row))} className="h-9 w-14 rounded-lg border bg-white px-2 text-sm sm:w-20" /><span className="text-xs text-[#69727d]">min</span></div>
                  <input value={item.label ?? ""} onChange={(event) => setItems((current) => current.map((row, i) => i === index ? { ...row, label: event.target.value } : row))} placeholder="Optional label" aria-label="Break label" className="col-span-2 h-9 min-w-0 w-full rounded-lg border bg-white px-2 text-sm sm:flex-1 sm:px-3" />
                </div>
              )}
              <button type="button" onClick={() => setItems((current) => current.filter((_, i) => i !== index))} aria-label={`Remove item ${index + 1}`} className="flex h-10 w-8 shrink-0 items-center justify-center rounded-lg text-lg text-[#a04420] opacity-70 transition hover:bg-[#ffe5dc] hover:opacity-100">&times;</button>
            </div>
            {(item.type === "break" || index === items.length - 1) && <div className="ml-4 flex items-center gap-2 py-1 text-xs font-medium text-[#69727d] sm:ml-12 sm:py-1.5"><span className="h-px w-5 bg-[#d9d1c9]" />Section songs: <b className="text-[#303942]">{sectionLabel(sectionDuration(sectionStart(index), item.type === "break" ? index : index + 1))}</b></div>}
          </div>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap gap-2 border-t pt-4">
        <button type="button" onClick={() => setSongPickerOpen(true)} className="rounded-xl border border-[#d9d1c9] bg-white px-3 py-2 text-sm font-semibold text-[#303942] hover:bg-[#f8f5f1]">+ Add song</button>
        <button type="button" onClick={() => setItems((current) => [...current, { type: "break", break_minutes: 5 }])} className="rounded-xl border border-[#f0d4c5] bg-[#fff8f3] px-3 py-2 text-sm font-semibold text-[#a04420] hover:bg-[#ffece2]">+ Add break</button>
        <button type="button" onClick={addAllSongs} className="rounded-xl border border-[#ffb08e] bg-[#fff4ed] px-3 py-2 text-sm font-semibold text-[#e95a27] hover:bg-[#ffe5dc]">+ Add all songs</button>
      </div>
      <div className="mt-5 flex justify-end gap-3">
        <button type="button" onClick={onClose} className="rounded-xl bg-[#f5f2ee] px-4 py-2.5 text-sm font-semibold">Discard</button>
        <button type="button" onClick={() => void save()} disabled={saving} className="rounded-xl bg-[#ff6b35] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving..." : "Save changes"}</button>
      </div>
      {songPickerOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-5"><div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><h3 className="text-xl font-semibold">Add song</h3><button type="button" onClick={() => setSongPickerOpen(false)} className="text-2xl">&times;</button></div><input autoFocus value={songSearch} onChange={(event) => setSongSearch(event.target.value)} placeholder="Search songs" className="mt-4 h-11 w-full rounded-xl border px-3" /><div className="mt-3 max-h-[60vh] space-y-1 overflow-y-auto sm:max-h-72 sm:space-y-2">{availableSongs.length ? availableSongs.map((song) => <button key={song.id} type="button" onClick={() => addSong(song)} className="flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left hover:bg-[#fff4ed] sm:py-3"><span className="min-w-0 break-words"><b>{song.title}</b><br /><span className="text-xs text-[#69727d]">{song.artist ?? "Artist not specified"}</span></span>{songDuration(song.id) && <span className="shrink-0 text-xs font-semibold text-[#69727d]">{songDuration(song.id)}</span>}</button>) : <p className="py-6 text-center text-sm text-[#69727d]">No matching songs.</p>}</div></div></div>}
    </section>
  );
}