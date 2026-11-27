"use client";

import { useState } from "react";
import { addUnavailability, deleteAllUnavailability, deleteUnavailability, type Unavailability, type UnavailabilityMember } from "@/lib/backend/unavailability";
import { formatShortDateTime as displayDateTime } from "@/lib/date-format";
import LoadingSpinner from "../loading-spinner";
import { TrashIcon } from "../icons";
import FullScheduleCalendar from "../schedule/full-calendar";

type MonthGroup = { key: string; label: string; entries: Unavailability[] };
type MemberGroup = { id: string; name: string; entries: Unavailability[]; months: MonthGroup[] };

const sydneyDateParts = new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

function sydneyParts(value: string) {
  const parts = sydneyDateParts.formatToParts(new Date(value));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const year = Number(get("year")); const month = Number(get("month")); const day = Number(get("day"));
  return { year, month, day, hour: Number(get("hour")), minute: Number(get("minute")), dateKey: `${get("year")}-${get("month")}-${get("day")}` };
}

function lastOccupiedDate(entry: Unavailability) {
  const start = sydneyParts(entry.start_date);
  const end = sydneyParts(entry.end_date);
  const last = new Date(Date.UTC(end.year, end.month - 1, end.day));
  if (end.hour === 0 && end.minute === 0 && end.dateKey > start.dateKey) last.setUTCDate(last.getUTCDate() - 1);
  return last;
}

function inclusiveDayCount(entry: Unavailability) {
  const start = sydneyParts(entry.start_date);
  const last = lastOccupiedDate(entry);
  const startDay = Date.UTC(start.year, start.month - 1, start.day);
  return Math.max(1, Math.floor((last.getTime() - startDay) / 86_400_000) + 1);
}

function RemoveButton({ id, allowed, onError }: { id: string; allowed: boolean; onError: (message: string) => void }) {
  const [busy, setBusy] = useState(false);
  if (!allowed) return null;

  async function remove() {
    setBusy(true);
    const data = new FormData();
    data.set("id", id);
    try {
      const result = await deleteUnavailability(data);
      if (result.error) onError(result.error);
      else window.location.reload();
    } finally {
      setBusy(false);
    }
  }

  return <button type="button" onClick={() => void remove()} disabled={busy} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[#a04420] hover:bg-[#fff4ed] disabled:opacity-50" aria-label="Delete unavailability">{busy ? <LoadingSpinner label="" /> : <TrashIcon className="h-5 w-5" />}</button>;
}

function groupByMonth(entries: Unavailability[]): MonthGroup[] {
  const labelFormatter = new Intl.DateTimeFormat("en-AU", { month: "long", year: "numeric", timeZone: "UTC" });
  const months = new Map<string, MonthGroup>();

  for (const entry of entries) {
    const start = sydneyParts(entry.start_date);
    const monthCursor = new Date(Date.UTC(start.year, start.month - 1, 1));
    const lastDay = lastOccupiedDate(entry);
    while (monthCursor <= lastDay) {
      const year = monthCursor.getUTCFullYear();
      const monthNumber = monthCursor.getUTCMonth() + 1;
      const key = `${year}-${String(monthNumber).padStart(2, "0")}`;
      const label = labelFormatter.format(monthCursor);
      const group = months.get(key) ?? { key, label, entries: [] };
      group.entries.push(entry);
      months.set(key, group);
      monthCursor.setUTCMonth(monthCursor.getUTCMonth() + 1);
    }
  }

  return [...months.values()]
    .map((month) => ({ ...month, entries: [...month.entries].sort((a, b) => a.start_date.localeCompare(b.start_date)) }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

export default function UnavailabilityCalendar({ initialEntries, members, isAdmin, membershipId }: { initialEntries: Unavailability[]; members: UnavailabilityMember[]; isAdmin: boolean; membershipId: string }) {
  const [entries, setEntries] = useState(initialEntries);
  const [open, setOpen] = useState(false);
  const [allDay, setAllDay] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bulkBusyId, setBulkBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [allDayEndDate, setAllDayEndDate] = useState("");

  const memberGroups: MemberGroup[] = Array.from(entries.reduce((map, entry) => {
    const group = map.get(entry.membership_id) ?? { id: entry.membership_id, name: entry.member_name, entries: [] as Unavailability[] };
    group.entries.push(entry);
    map.set(entry.membership_id, group);
    return map;
  }, new Map<string, { id: string; name: string; entries: Unavailability[] }>()).values())
    .map((group) => ({ ...group, months: groupByMonth(group.entries) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setMessage("");
    const formData = new FormData(event.currentTarget);
    if (allDay) formData.set("allDayEndDate", allDayEndDate || selectedDate);
    try {
      const result = await addUnavailability(formData);
      if (result.error) setMessage(result.error);
      else {
        setEntries(await import("@/lib/backend/unavailability").then((module) => module.getUnavailability()));
        setOpen(false);
        setAllDay(true);
        setAllDayEndDate("");
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteAll(group: MemberGroup) {
    if (bulkBusyId || !window.confirm(`Delete all unavailability entries for ${group.name}? This cannot be undone.`)) return;
    setBulkBusyId(group.id);
    setMessage("");
    try {
      const result = await deleteAllUnavailability(group.id);
      if (result.error) setMessage(result.error);
      else setEntries((current) => current.filter((entry) => entry.membership_id !== group.id));
    } finally {
      setBulkBusyId(null);
    }
  }

  return <div className="mt-6 sm:mt-8">
    <div className="rounded-2xl border border-[#e8e1e9] bg-white p-3 shadow-sm sm:p-5">
      <FullScheduleCalendar personalEntries={entries} onDate={(date) => { const day = date.slice(0, 10); setSelectedDate(day); setAllDayEndDate(day); setMessage(""); setOpen(true); }} onUnavailable={(details) => setMessage(details[0])} />
    </div>
    {message && <p className="mt-4 rounded-xl bg-[#fff4ed] px-4 py-3 text-sm text-[#a04420]">{message}</p>}

    <div className="mt-5 space-y-3">
      {memberGroups.map((group) => <details key={group.id} className="group rounded-2xl border border-[#e8e1e9] bg-white shadow-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 [&::-webkit-details-marker]:hidden sm:px-5">
          <span><b className="text-[#17202a]">{group.name}</b><span className="ml-2 text-sm text-[#69727d]">{group.entries.length} range{group.entries.length === 1 ? "" : "s"}</span></span>
          <span className="flex shrink-0 items-center gap-2"><span className="text-xl text-[#69727d] transition-transform group-open:rotate-180">⌄</span>{(isAdmin || group.id === membershipId) && <button type="button" onClick={(event) => { event.preventDefault(); void deleteAll(group); }} disabled={bulkBusyId !== null} className="flex h-10 items-center rounded-lg border border-[#e7b4a7] bg-[#fff4ed] px-3 text-xs font-semibold text-[#a04420] disabled:opacity-50">{bulkBusyId === group.id ? <LoadingSpinner label="Deleting..." /> : "Delete all"}</button>}</span>
        </summary>
        <div className="space-y-3 border-t border-[#eee9e3] px-3 py-3 sm:px-5">
          {group.months.map((month) => <details key={month.key} open className="rounded-xl border border-[#eee9e3] bg-[#fcfbf9]">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 text-sm font-semibold text-[#303942] [&::-webkit-details-marker]:hidden"><span>{month.label}</span><span className="text-xs font-normal text-[#69727d]">{month.entries.length} range{month.entries.length === 1 ? "" : "s"}</span></summary>
            <div className="space-y-2 border-t border-[#eee9e3] px-2 py-2">
              {month.entries.map((entry) => <div key={entry.id} className="flex min-h-16 items-center justify-between gap-3 rounded-lg border border-[#f0d4c5] bg-white px-3 py-2.5 text-sm shadow-sm"><span className="min-w-0"><b className="block truncate text-[#17202a]">{displayDateTime(entry.start_date)}</b><span className="text-xs text-[#69727d]">to {displayDateTime(entry.end_date)}{inclusiveDayCount(entry) > 1 ? ` · ${inclusiveDayCount(entry)} days` : ""}</span></span><RemoveButton id={entry.id} allowed={isAdmin || group.id === membershipId} onError={setMessage} /></div>)}
            </div>
          </details>)}
        </div>
      </details>)}
    </div>

    {open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-5" onClick={() => { if (!saving) setOpen(false); }}><form onSubmit={save} onClick={(event) => event.stopPropagation()} className="w-full max-w-md space-y-4 rounded-3xl bg-white p-6">
      <div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Add unavailability</h2><button type="button" onClick={() => setOpen(false)} disabled={saving} className="flex h-10 w-10 items-center justify-center rounded-lg text-2xl text-[#69727d] hover:bg-[#f5f2ee] disabled:opacity-50" aria-label="Discard and close">&times;</button></div>
      {isAdmin && members.length > 0 && <label className="block text-sm font-medium">Member<select name="membershipId" defaultValue={members[0].id} className="mt-2 h-11 w-full rounded-xl border px-3">{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>}
      <label className="flex items-center gap-3 rounded-xl border border-[#e8e1e9] bg-[#fcfbf9] px-3 py-3 text-sm font-semibold"><input name="allDay" type="checkbox" value="true" checked={allDay} onChange={(event) => setAllDay(event.target.checked)} className="h-5 w-5 accent-[#ff6b35]" />All day</label>
      {allDay ? <div key="all-day-dates" className="space-y-4"><label className="block text-sm font-medium">First day<input name="startDate" type="date" value={selectedDate || ""} onChange={(event) => setSelectedDate(event.target.value)} required className="mt-2 h-11 w-full rounded-xl border px-3" /></label><label className="block text-sm font-medium">Last day<input name="allDayEndDate" type="date" value={allDayEndDate || selectedDate || ""} onChange={(event) => setAllDayEndDate(event.target.value)} min={selectedDate || ""} required className="mt-2 h-11 w-full rounded-xl border px-3" /></label></div> : <div key="partial-day-dates" className="space-y-4"><label className="block text-sm font-medium">Start<input name="startDate" type="datetime-local" defaultValue={selectedDate ? `${selectedDate}T09:00` : ""} required className="mt-2 h-11 w-full rounded-xl border px-3" /></label><label className="block text-sm font-medium">End<input name="endDate" type="datetime-local" defaultValue={`${selectedDate}T17:00`} required className="mt-2 h-11 w-full rounded-xl border px-3" /></label></div>}
      <div className="flex gap-3"><button type="button" onClick={() => setOpen(false)} disabled={saving} className="h-11 flex-1 rounded-xl bg-[#f5f2ee] font-semibold disabled:opacity-50">Discard</button><button type="submit" disabled={saving} className="flex h-11 flex-1 items-center justify-center rounded-xl bg-[#ff6b35] font-semibold text-white">{saving ? <LoadingSpinner label="Saving..." /> : "Save"}</button></div>
    </form></div>}
  </div>;
}