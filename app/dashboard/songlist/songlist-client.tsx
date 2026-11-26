"use client";

import { useMemo, useState } from "react";
import { createSong, deleteSong, getSongs, saveSongRating, searchDeezerSongs, type DeezerSong, type Song, type SongRating } from "@/lib/backend/songs";
import { formatSongDuration as durationLabel, formatTotalDuration } from "@/lib/duration-format";
import LoadingSpinner from "../loading-spinner";
import { TrashIcon } from "../icons";

const starPath = "M12 2.5l2.94 5.95 6.56.95-4.75 4.63 1.12 6.54L12 17.48l-5.87 3.09 1.12-6.54L2.5 9.4l6.56-.95L12 2.5z";
function Stars({ value, interactive = false, onChange }: { value: number; interactive?: boolean; onChange?: (value: number) => void }) {
  return <span className="inline-flex items-center" aria-label={`${value} out of 5 stars`}>{Array.from({ length: 5 }, (_, index) => { const fill = Math.max(0, Math.min(1, value - index)); const star = <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true"><path d={starPath} fill="none" stroke="currentColor" strokeWidth="1.5" /><path d={starPath} fill="currentColor" style={{ clipPath: `inset(0 ${100 - fill * 100}% 0 0)` }} /></svg>; return interactive ? <button type="button" key={index} onClick={() => onChange?.(index + 1)} aria-label={`${index + 1} star${index ? "s" : ""}`} className="text-[#fbbc04] transition-transform hover:scale-110">{star}</button> : <span key={index} className="text-[#fbbc04]">{star}</span>; })}</span>;
}

type SongSort = "title" | "duration-asc" | "duration-desc" | "rating-asc" | "rating-desc";

export default function SonglistClient({ initialSongs, initialRatings }: { initialSongs: Song[]; initialRatings: SongRating[]; isAdmin: boolean }) {
  const [songs, setSongs] = useState(initialSongs); const [ratings, setRatings] = useState(initialRatings); const [draftRatings, setDraftRatings] = useState<Record<string, number>>(() => Object.fromEntries(initialRatings.filter((rating) => rating.is_current_user).map((rating) => [rating.song_id, rating.score]))); const [selectedRatingSong, setSelectedRatingSong] = useState<string | null>(null); const [sort, setSort] = useState<SongSort>("title"); const [open, setOpen] = useState(false); const [message, setMessage] = useState(""); const [saving, setSaving] = useState(false); const [searching, setSearching] = useState(false); const [query, setQuery] = useState(""); const [results, setResults] = useState<DeezerSong[]>([]); const [selected, setSelected] = useState<DeezerSong | null>(null);
  const displayedSongs = useMemo(() => [...songs].sort((first, second) => {
    if (sort === "title") return first.title.localeCompare(second.title, undefined, { sensitivity: "base" });
    if (sort === "duration-asc" || sort === "duration-desc") {
      const difference = (first.duration_seconds ?? 0) - (second.duration_seconds ?? 0);
      return sort === "duration-asc" ? difference : -difference;
    }
    const average = (song: Song) => {
      const songRatings = ratings.filter((rating) => rating.song_id === song.id);
      return songRatings.length ? songRatings.reduce((total, rating) => total + rating.score, 0) / songRatings.length : null;
    };
    const firstAverage = average(first); const secondAverage = average(second);
    if (firstAverage === null && secondAverage === null) return first.title.localeCompare(second.title);
    if (firstAverage === null) return 1;
    if (secondAverage === null) return -1;
    return sort === "rating-asc" ? firstAverage - secondAverage : secondAverage - firstAverage;
  }), [songs, ratings, sort]);
  function resetAddSongForm(form?: HTMLFormElement) { form?.reset(); setQuery(""); setResults([]); setSelected(null); }
  async function add(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); setMessage(""); const form = event.currentTarget; const result = await createSong(new FormData(form)); if (result.error) setMessage(result.error); else { setSongs(await getSongs()); resetAddSongForm(form); setOpen(false); } setSaving(false); }
  async function remove(song: Song) { if (!window.confirm(`Remove \"${song.title}\" from the songlist?`)) return; setSaving(true); const data = new FormData(); data.set("songId", song.id); const result = await deleteSong(data); if (result.error) setMessage(result.error); else setSongs((current) => current.filter((item) => item.id !== song.id)); setSaving(false); }
  async function rate(songId: string) { const score = draftRatings[songId]; if (!score) return; setSaving(true); setMessage(""); const data = new FormData(); data.set("songId", songId); data.set("score", String(score)); const result = await saveSongRating(data); if (result.error) setMessage(result.error); else setRatings((current) => { const mine = current.find((rating) => rating.song_id === songId && rating.is_current_user); if (mine) return current.map((rating) => rating === mine ? { ...rating, score } : rating); return [...current, { song_id: songId, membership_id: `current-${songId}`, score, member_name: "You", is_current_user: true }]; }); setSaving(false); }
  function ratingSummary(songId: string) { const songRatings = ratings.filter((rating) => rating.song_id === songId); if (!songRatings.length) return null; const average = songRatings.reduce((total, rating) => total + rating.score, 0) / songRatings.length; return (Math.round(average * 2) / 2).toFixed(1); }
  const ratingSong = songs.find((song) => song.id === selectedRatingSong);
  async function search() { setSearching(true); setMessage(""); setResults([]); const result = await searchDeezerSongs(query); setResults(result.songs ?? []); if (result.error) setMessage(result.error); else if (!result.songs?.length) setMessage("No Deezer songs found. Try a different title or artist."); setSearching(false); }
  function choose(result: DeezerSong) { setSelected(result); setResults([]); setQuery(`${result.title} ${result.artist.name}`); }
  function updateSelected(field: "title" | "artist" | "duration", value: string) { setSelected((current) => current ? { ...current, ...(field === "title" ? { title: value } : field === "artist" ? { artist: { ...current.artist, name: value } } : { duration: Number(value) || 0 }) } : null); }
  function durationSeconds(value: string) { const [minutes, seconds] = value.split(":").map(Number); return Number.isFinite(minutes) && Number.isFinite(seconds) ? Math.max(0, Math.round(minutes * 60 + seconds)) : 0; }
  return <>
    <div className="flex items-end justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-wider text-[#ff6b35]">Band</p><h1 className="mt-2 text-3xl font-semibold text-[#17202a]">Songlist</h1><p className="mt-2 text-sm text-[#69727d]">Songs your band can rehearse and perform.</p><div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm font-medium text-[#69727d]"><span>Total songs: <b className="text-[#17202a]">{songs.length}</b></span><span>Total duration: <b className="text-[#17202a]">{formatTotalDuration(songs.reduce((total, song) => total + (song.duration_seconds ?? 0), 0))}</b></span></div></div><button type="button" onClick={() => { resetAddSongForm(); setMessage(""); setOpen(true); }} className="rounded-xl bg-[#ff6b35] px-4 py-2.5 text-sm font-semibold text-white" aria-label="Add song" title="Add song">+</button></div>
    <div className="mt-5 rounded-xl border border-[#f0ddd3] bg-[#fffaf7] px-4 py-3 text-sm leading-6 text-[#69727d]"><b className="text-[#303942]">Ratings:</b> Click a song to view member scores and your rating. Choose 1–5 stars, then select <b className="text-[#303942]">Save</b>. The stars beside each song show the band average.</div>
    {!!songs.length && <div className="mt-5 flex items-center justify-end gap-3"><label htmlFor="song-sort" className="text-sm font-medium text-[#69727d]">Sort by</label><select id="song-sort" value={sort} onChange={(event) => setSort(event.target.value as SongSort)} className="h-10 rounded-xl border border-[#ddd8d1] bg-white px-3 text-sm text-[#303942]"><option value="title">Title (A–Z)</option><option value="duration-asc">Duration (shortest)</option><option value="duration-desc">Duration (longest)</option><option value="rating-asc">Rating (lowest)</option><option value="rating-desc">Rating (highest)</option></select></div>}
    {message && <p className="mt-5 rounded-xl bg-[#fff4ed] px-4 py-3 text-sm text-[#a04420]">{message}</p>}
    {!songs.length ? <div className="mt-8 rounded-2xl border border-dashed border-[#d9d1c9] bg-white px-5 py-12 text-center text-sm text-[#69727d]">No songs yet.</div> : <div className="mt-5 overflow-hidden rounded-2xl border border-[#e8e1e9] bg-white">{displayedSongs.map((song) => { const average = ratingSummary(song.id); return <div key={song.id} className="flex items-center gap-4 border-b border-[#eee9e3] px-5 py-4 last:border-b-0"><div className="w-28 shrink-0">{average ? <Stars value={Number(average)} /> : null}</div><button type="button" onClick={() => setSelectedRatingSong(song.id)} className="min-w-0 flex-1 text-left transition-colors hover:text-[#e95a27]"><p className="font-medium text-[#17202a]">{song.title}</p><p className="mt-1 text-sm text-[#69727d]">{song.artist || "Artist not specified"}{durationLabel(song.duration_seconds) ? ` - ${durationLabel(song.duration_seconds)}` : ""}</p>{song.notes && <p className="mt-1 text-xs text-[#a0a5aa]">{song.notes}</p>}</button><button type="button" onClick={() => void remove(song)} aria-label={`Remove ${song.title}`} title="Remove song" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#a04420] hover:bg-[#fff4ed]"><TrashIcon className="h-[18px] w-[18px]" /></button></div>; })}</div>}
    {ratingSong && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#17202a]/40 p-5 motion-safe:animate-[fade-in_.18s_ease-out]" onClick={() => setSelectedRatingSong(null)}><div role="dialog" aria-modal="true" aria-labelledby="rating-title" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl motion-safe:animate-[scale-in_.2s_ease-out]" onClick={(event) => event.stopPropagation()}><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#ff6b35]">Song ratings</p><h2 id="rating-title" className="mt-1 text-xl font-semibold text-[#17202a]">{ratingSong.title}</h2></div><button type="button" onClick={() => setSelectedRatingSong(null)} aria-label="Close ratings" className="text-2xl leading-none text-[#69727d]">&times;</button></div><div className="mt-5 space-y-2 text-sm">{ratings.filter((rating) => rating.song_id === ratingSong.id).map((rating) => <div key={`${rating.song_id}-${rating.membership_id}`} className="flex items-center gap-3"><span className="text-[#69727d]">{rating.member_name}</span><Stars value={rating.score} /></div>)}</div><div className="mt-5 flex items-end gap-3 border-t border-[#eee9e3] pt-4"><div><p className="mb-1 text-xs font-medium text-[#69727d]">Your rating</p><Stars value={draftRatings[ratingSong.id] ?? 0} interactive onChange={(value) => setDraftRatings((current) => ({ ...current, [ratingSong.id]: value }))} /></div><button type="button" onClick={() => void rate(ratingSong.id)} disabled={saving || !draftRatings[ratingSong.id]} className="h-9 rounded-lg bg-[#ff6b35] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Save</button></div></div></div>}
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