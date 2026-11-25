"use client";

import { useState } from "react";
import { addUnavailability, deleteUnavailability, type Unavailability, type UnavailabilityMember } from "@/lib/backend/unavailability";
import { formatShortDateTime as displayDateTime } from "@/lib/date-format";
import LoadingSpinner from "../loading-spinner";
import { TrashIcon } from "../icons";
import FullScheduleCalendar from "../schedule/full-calendar";

function RemoveUnavailabilityButton({ id, onError }: { id: string; onError: (message: string) => void }) {
  const [removing, setRemoving] = useState(false);
  async function remove() {
    setRemoving(true);
    const form = new FormData();
    form.set("id", id);
    try {
      const result = await deleteUnavailability(form);
      if (result.error) onError(result.error);
      else window.location.reload();
    } finally {
      setRemoving(false);
    }
  }
  return <button type="button" onClick={() => void remove()} disabled={removing} aria-label="Remove unavailability" title={removing ? "Removing..." : "Remove unavailability"} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[#a04420] hover:bg-[#fff4ed] disabled:cursor-not-allowed disabled:opacity-50">{removing ? <LoadingSpinner label="" /> : <TrashIcon className="h-[18px] w-[18px]" />}</button>;
}

export default function UnavailabilityCalendar({ initialEntries, members }: { initialEntries: Unavailability[]; members: UnavailabilityMember[] }) {
  const [entries, setEntries] = useState(initialEntries);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  async function save(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); if (saving) return; setSaving(true); setMessage(""); const form = event.currentTarget; try { const result = await addUnavailability(new FormData(form)); if (result.error) setMessage(result.error); else { setEntries(await import("@/lib/backend/unavailability").then((module) => module.getUnavailability())); setOpen(false); form.reset(); } } finally { setSaving(false); } }
  return <div className="mt-6 sm:mt-8"><div className="rounded-2xl border border-[#e8e1e9] bg-white p-3 shadow-sm sm:p-5"><FullScheduleCalendar personalEntries={entries} onDate={(date) => { setMessage(""); setSelectedDate(date.slice(0, 10)); setOpen(true); }} onUnavailable={(names) => setMessage(names[0])} /></div>{message && <p className="mt-4 rounded-xl bg-[#fff4ed] px-4 py-3 text-sm text-[#a04420]">{message}</p>}{entries.map((entry) => <div key={entry.id} className="mt-3 flex min-h-16 items-center justify-between gap-4 rounded-xl bg-[#fff8f3] px-4 py-3 text-sm sm:px-5 sm:py-4"><span className="font-medium leading-6"><span className="block text-[#17202a]">{entry.member_name}</span><span className="block text-sm text-[#69727d]">{displayDateTime(entry.start_date)} - {displayDateTime(entry.end_date)}</span></span><RemoveUnavailabilityButton id={entry.id} onError={setMessage} /></div>)}{open && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-5"><form key={selectedDate} onSubmit={save} className="w-full max-w-md space-y-4 rounded-t-3xl bg-white p-5 sm:rounded-3xl sm:p-7">{members.length > 0 && <label className="block text-sm font-medium">Member<select name="membershipId" defaultValue={members[0]?.id} className="mt-2 h-11 w-full rounded-xl border px-3">{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>}<div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Add unavailability</h2><button type="button" onClick={() => { setOpen(false); setMessage(""); }} className="flex h-9 w-9 items-center justify-center rounded-lg text-2xl hover:bg-[#f5f2ee]" aria-label="Close">&times;</button></div><label className="block text-sm font-medium">Start date and time<input name="startDate" type="datetime-local" defaultValue={selectedDate ? `${selectedDate}T09:00` : ""} required className="mt-2 h-11 w-full rounded-xl border px-3" /></label><label className="block text-sm font-medium">End date and time<input name="endDate" type="datetime-local" defaultValue={selectedDate ? `${selectedDate}T17:00` : ""} required className="mt-2 h-11 w-full rounded-xl border px-3" /></label>{message && <p className="text-sm text-[#a04420]">{message}</p>}<div className="grid grid-cols-2 gap-3"><button type="button" onClick={() => { setOpen(false); setMessage(""); }} className="h-11 rounded-xl bg-[#f5f2ee] font-semibold">Cancel</button><button type="submit" disabled={saving} className="flex h-11 items-center justify-center rounded-xl bg-[#ff6b35] font-semibold text-white disabled:opacity-50">{saving ? <LoadingSpinner label="Saving..." /> : "Save unavailability"}</button></div></form></div>}</div>;
}