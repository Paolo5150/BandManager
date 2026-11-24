"use client";

import Link from "next/link";
import { useState } from "react";
import { createScheduleEvent, getEventCharges, deleteScheduleEvent, saveEventMemberCharges, updateScheduleEvent, type ScheduleEvent, type ScheduleMember } from "@/lib/backend/schedule";
import WaitingConfirmationModal from "./waiting-confirmation-modal";
import { logout } from "@/lib/backend/dashboard-data";

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const navigation = ["Overview", "Members", "Songlist", "Sets", "Schedule", "Finance"];
const currencyFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export default function ScheduleCalendar({ events, members, isAdmin, waitingConfirmations }: { events: ScheduleEvent[]; members: ScheduleMember[]; isAdmin: boolean; waitingConfirmations: ScheduleEvent[] }) {
  const currentDate = new Date();
  const [month, setMonth] = useState(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1));
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<ScheduleEvent | null>(null);
  const [reviewEvent, setReviewEvent] = useState<ScheduleEvent | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  // membership_id -> amount in dollars (as typed)
  const [chargeInputs, setChargeInputs] = useState<Record<string, string>>({});
  const [chargesLoading, setChargesLoading] = useState(false);
  const [editScope, setEditScope] = useState<"instance" | "series">("instance");
  const [selectedDate, setSelectedDate] = useState("");
  const [repeatWeeks, setRepeatWeeks] = useState("0");
  const [repeatIndefinitely, setRepeatIndefinitely] = useState(true);

  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  firstDay.setDate(firstDay.getDate() - firstDay.getDay());
  const days = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(firstDay);
    day.setDate(firstDay.getDate() + index);
    return day;
  });

  function eventsFor(day: Date) {
    return events.filter((event) => new Date(event.starts_at).toDateString() === day.toDateString());
  }

  async function submit(formData: FormData) {
    setMessage("");
    const cost = Math.round((Number(formData.get("costCents") ?? 0) || 0) * 100);
    const charges = Array.from(formData.entries()).filter(([key]) => key.startsWith("charge_")).reduce((sum, [, value]) => sum + Math.round((Number(value) || 0) * 100), 0);
    if (charges !== cost) {
      setMessage(`Member charges must add up to the event cost. Current total: ${(charges / 100).toFixed(2)}.`);
      return;
    }
    const result = await createScheduleEvent(formData);
    if (result.error) setMessage(result.error);
    else { setMessage("Event added."); setIsOpen(false); }
  }

  async function startEdit(event: ScheduleEvent) {
    setMessage("");
    setEditScope("instance");
    setChargeInputs({});
    setChargesLoading(true);
    setIsEditing(true);
    const charges = await getEventCharges(event.id);
    const inputs: Record<string, string> = {};
    for (const charge of charges) {
      if (charge.membership_id) inputs[charge.membership_id] = (charge.amount_cents / 100).toFixed(2);
    }
    setChargeInputs(inputs);
    setChargesLoading(false);
  }

  async function saveEdit(formData: FormData) {
    setMessage("");
    const cost = Math.round((Number(formData.get("costCents") ?? 0) || 0) * 100);
    const total = members.reduce((sum, member) => sum + Math.round((Number(chargeInputs[member.id]) || 0) * 100), 0);
    if (total !== cost) {
      setMessage(`Member charges must add up to the event cost. Current total: ${(total / 100).toFixed(2)}.`);
      return;
    }
    const result = await updateScheduleEvent(formData);
    if (result.error) { setMessage(result.error); return; }
    const chargesResult = await saveEventMemberCharges(formData);
    if (chargesResult.error) { setMessage(chargesResult.error); return; }
    setSelectedEvent(null);
    setIsEditing(false);
    setMessage("Event updated.");
  }

  function editEventForm() {
    if (!selectedEvent) return null;
    const start = new Date(selectedEvent.starts_at);
    const end = new Date(selectedEvent.ends_at);
    const date = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-5">
        <form onSubmit={(event) => { event.preventDefault(); void saveEdit(new FormData(event.currentTarget)); }} className="max-h-[92vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl sm:p-7">
          <input type="hidden" name="eventId" value={selectedEvent.id} />
          {selectedEvent.series_id && <input type="hidden" name="seriesId" value={selectedEvent.series_id} />}
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Edit event</h2>
            <button type="button" onClick={() => setIsEditing(false)} className="text-2xl">&times;</button>
          </div>
          {selectedEvent.series_id && (
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" name="editScope" value="instance" checked={editScope === "instance"} onChange={() => setEditScope("instance")} />
                <span>This event</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="editScope" value="series" checked={editScope === "series"} onChange={() => setEditScope("series")} />
                <span>Entire series</span>
              </label>
            </div>
          )}
          <select name="type" defaultValue={selectedEvent.type} className="h-11 w-full rounded-xl border px-3">
            <option value="practice">Practice</option>
            <option value="gig">Gig</option>
          </select>
          <input name="title" defaultValue={selectedEvent.title} className="h-11 w-full rounded-xl border px-3" />
          <input name="costCents" type="number" step="0.01" defaultValue={selectedEvent.cost_cents ? selectedEvent.cost_cents / 100 : 0} className="h-11 w-full rounded-xl border px-3" />
          <details className="rounded-xl border border-[#e8e1e9] p-4">
            <summary className="cursor-pointer text-sm font-semibold text-[#303942]">Member charges</summary>
            {chargesLoading ? (
              <p className="mt-4 text-sm text-[#69727d]">Loading charges...</p>
            ) : (
              <div className="mt-4 space-y-3">
                {members.map((member) => (
                  <label key={member.id} className="grid grid-cols-[1fr_7rem] items-center gap-3 text-sm">
                    <span>{member.name}</span>
                    <input
                      name={`charge_${member.id}`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={chargeInputs[member.id] ?? "0"}
                      onChange={(event) => setChargeInputs((prev) => ({ ...prev, [member.id]: event.target.value }))}
                      className="h-10 rounded-lg border px-3 text-sm"
                    />
                  </label>
                ))}
              </div>
            )}
          </details>
          <input name="date" type="date" defaultValue={date} required className="h-11 w-full rounded-xl border px-3" />
          <div className="grid grid-cols-2 gap-3">
            <input name="startsAt" type="time" defaultValue={start.toTimeString().slice(0, 5)} required className="h-11 rounded-xl border px-3" />
            <input name="endsAt" type="time" defaultValue={end.toTimeString().slice(0, 5)} required className="h-11 rounded-xl border px-3" />
          </div>
          <input name="location" defaultValue={selectedEvent.location ?? ""} className="h-11 w-full rounded-xl border px-3" />
          <textarea name="notes" defaultValue={selectedEvent.notes ?? ""} className="w-full rounded-xl border px-3 py-2" />
          {message && <p className="rounded-xl bg-[#fff4ed] px-4 py-3 text-sm text-[#a04420]" role="alert">{message}</p>}
          <div className="grid grid-cols-2 gap-3">
            <button type="submit" disabled={chargesLoading} className="rounded-xl bg-[#ff6b35] py-3 text-sm font-semibold text-white disabled:opacity-50">Save</button>
            <button type="button" onClick={() => setIsEditing(false)} className="rounded-xl bg-[#f5f2ee] py-3 text-sm font-semibold">Cancel</button>
          </div>
        </form>
      </div>
    );
  }

  async function removeEvent(all: boolean) {
    if (!selectedEvent || !window.confirm(all ? "Delete the entire series?" : "Delete this event?")) return;
    const data = new FormData();
    data.set("eventId", selectedEvent.id);
    if (all && selectedEvent.series_id) data.set("seriesId", selectedEvent.series_id);
    const result = await deleteScheduleEvent(data);
    if (result.error) setMessage(result.error);
    else { setSelectedEvent(null); setMessage("Event deleted."); }
  }

  function openAddForDate(day: Date) {
    if (!isAdmin) return;
    setMessage("");
    setSelectedDate(`${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`);
    setIsOpen(true);
  }

  function openAddEvent() {
    if (!isAdmin) return;
    setMessage("");
    setSelectedDate("");
    setIsOpen(true);
  }

  const selectedEventIsCompleted = selectedEvent?.status === "completed";
  const canModifySelectedEvent = Boolean(isAdmin && selectedEvent && !selectedEventIsCompleted);

  return (
    <div className="flex min-h-screen bg-[#f8f5f1]">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-[#e8e1e9] bg-white px-5 py-6 md:flex">
        <div className="flex items-center gap-3 px-2"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ff6b35] text-lg font-bold text-white">B</div><span className="font-semibold text-[#17202a]">BandManager</span></div>
        <nav className="mt-10 flex flex-1 flex-col gap-1" aria-label="Dashboard navigation"><p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-[#a0a5aa]">Workspace</p>{navigation.map((item) => <Link key={item} href={item === "Overview" ? "/dashboard" : `/dashboard/${item.toLowerCase()}`} className={`rounded-xl px-3 py-3 text-sm ${item === "Schedule" ? "bg-[#fff1e9] text-[#e95a27]" : "text-[#69727d] hover:bg-[#f8f5f1]"}`}>{item}</Link>)}</nav>
        <form action={logout}><button type="submit" className="w-full border-t border-[#eee9e3] px-3 pt-5 text-left text-sm text-[#69727d]">Log out</button></form>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-5 sm:px-10 sm:py-8 lg:px-14"><div className="mx-auto min-w-0 max-w-6xl"><nav className="mb-6 flex gap-2 overflow-x-auto pb-1 md:hidden">{navigation.map((item) => <Link key={item} href={item === "Overview" ? "/dashboard" : `/dashboard/${item.toLowerCase()}`} className="shrink-0 rounded-lg bg-white px-3 py-2 text-sm text-[#69727d]">{item}</Link>)}</nav>
        <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-wider text-[#ff6b35]">Workspace</p><h1 className="mt-2 text-3xl font-semibold text-[#17202a]">Schedule</h1><p className="mt-2 text-sm text-[#69727d]">See your band&apos;s week at a glance.</p></div>{isAdmin && <button type="button" onClick={openAddEvent} className="rounded-xl bg-[#ff6b35] px-4 py-2.5 text-sm font-semibold text-white">Add event</button>}</div>
        {isAdmin && waitingConfirmations.length > 0 && <section className="mt-8 rounded-2xl border border-[#f0d4c5] bg-[#fff8f3] p-5"><h2 className="font-semibold text-[#17202a]">Waiting confirmations</h2><div className="mt-3 space-y-2">{waitingConfirmations.map((event) => <button key={event.id} type="button" onClick={() => setReviewEvent(event)} className="flex w-full items-center justify-between rounded-xl border border-[#f0d4c5] bg-white px-4 py-3 text-left text-sm"><span><b>{event.title}</b><br /><span className="text-[#69727d]">{new Date(event.ends_at).toLocaleString()}</span></span><span className="font-semibold text-[#e95a27]">Review</span></button>)}</div></section>}
        <section className="mt-8 overflow-hidden rounded-2xl border border-[#e8e1e9] bg-white shadow-sm"><div className="flex items-center justify-between border-b px-5 py-4"><h2 className="text-lg font-semibold text-[#17202a]">{month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h2><div className="flex gap-2"><button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="rounded-lg border px-3 py-2 text-sm">Previous</button><button type="button" onClick={() => setMonth(new Date())} className="rounded-lg border px-3 py-2 text-sm">Today</button><button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="rounded-lg border px-3 py-2 text-sm">Next</button></div></div><div className="grid grid-cols-7 border-b">{weekdays.map((day) => <p key={day} className="border-r px-2 py-3 text-center text-xs font-semibold text-[#a0a5aa]">{day}</p>)}</div><div className="grid grid-cols-7">{days.map((day) => <div role="button" tabIndex={0} key={day.toISOString()} onClick={() => openAddForDate(day)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") openAddForDate(day); }} className={`min-h-24 w-full cursor-pointer text-left border-b border-r p-2 ${day.getMonth() !== month.getMonth() ? "text-[#b6b9bc]" : ""} ${day.toDateString() === currentDate.toDateString() ? "bg-[#fff4ed]" : ""}`}><span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${day.toDateString() === currentDate.toDateString() ? "bg-[#ff6b35] text-white" : ""}`}>{day.getDate()}</span>{eventsFor(day).map((event) => <button key={event.id} type="button" onClick={(clickEvent) => { clickEvent.stopPropagation(); setSelectedEvent(event); }} className={`mt-1 block w-full truncate rounded px-1 text-left text-xs hover:bg-[#ffe3d5] ${event.status === "completed" ? "bg-[#eefbf4] text-[#24734b]" : "bg-[#fff1e9] text-[#a04420]"}`}>{event.title}</button>)}</div>)}</div></section>{message && <p className="mt-4 text-sm text-[#24734b]">{message}</p>}
      </div></main>
      {reviewEvent && <WaitingConfirmationModal event={reviewEvent} onClose={() => setReviewEvent(null)} />}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-5">
          <div className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-7">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-[#ff6b35]">{selectedEvent.type}</p>
                <h2 className="mt-2 text-2xl font-semibold">{selectedEvent.title}</h2>
              </div>
              <button type="button" onClick={() => setSelectedEvent(null)} className="text-2xl">&times;</button>
            </div>
              <div className="mt-6 space-y-4 text-sm">
                <p><b>When</b><br />{new Date(selectedEvent.starts_at).toLocaleString()} &rarr; {new Date(selectedEvent.ends_at).toLocaleTimeString()}</p>
                {selectedEvent.location && <p><b>Location</b><br />{selectedEvent.location}</p>}
                {selectedEvent.notes && <p className="whitespace-pre-wrap"><b>Notes</b><br />{selectedEvent.notes}</p>}
                {selectedEvent.cost_cents != null && selectedEvent.cost_cents > 0 && (
                  <p><b>Cost</b><br />{currencyFormatter.format(selectedEvent.cost_cents / 100)}</p>
                )}
              </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              {canModifySelectedEvent && <button type="button" onClick={() => void startEdit(selectedEvent)} className="rounded-xl bg-[#ff6b35] py-3 text-sm font-semibold text-white">Edit</button>}
              <button type="button" onClick={() => setSelectedEvent(null)} className="rounded-xl bg-[#f5f2ee] py-3 text-sm font-semibold">Close</button>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {canModifySelectedEvent && (
                <>
                  <button type="button" onClick={() => void removeEvent(false)} className="rounded-xl border border-[#e7b4a7] bg-[#fff4ed] px-3 py-2.5 text-sm font-semibold text-[#a04420] hover:bg-[#ffe5dc]">Delete event</button>
                  {selectedEvent.series_id && <button type="button" onClick={() => void removeEvent(true)} className="rounded-xl border border-[#d99b8d] bg-[#fce9e4] px-3 py-2.5 text-sm font-semibold text-[#8e2f1e] hover:bg-[#f8d9d1]">Delete series</button>}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {isEditing && editEventForm()}
      {isOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-5"><form onSubmit={(event) => { event.preventDefault(); void submit(new FormData(event.currentTarget)); }} className="w-full max-w-lg space-y-4 rounded-3xl bg-white p-7"><div className="flex items-center justify-between"><h2 className="text-2xl font-semibold">Add event</h2><button type="button" onClick={() => setIsOpen(false)} className="text-2xl">&times;</button></div><select name="type" className="h-11 w-full rounded-xl border px-3"><option value="practice">Practice</option><option value="gig">Gig</option></select><input name="title" placeholder="Title" className="h-11 w-full rounded-xl border px-3" />{isAdmin && <><input name="costCents" type="number" min="0" step="0.01" placeholder="Total cost" className="h-11 w-full rounded-xl border px-3" /><details className="rounded-xl border border-[#e8e1e9] p-4"><summary className="cursor-pointer text-sm font-semibold text-[#303942]">Member charges</summary><div className="mt-4 space-y-3">{members.map((member) => <div key={member.id} className="grid grid-cols-[1fr_7rem] items-center gap-3"><select aria-label={`Member charge for ${member.name}`} className="h-10 rounded-lg border px-3 text-sm"><option value={member.id}>{member.name}</option></select><input name={`charge_${member.id}`} type="number" min="0" step="0.01" defaultValue="0" aria-label={`Charge amount for ${member.name}`} className="h-10 rounded-lg border px-3 text-sm" /></div>)}</div></details></>} {message && <p className="rounded-xl bg-[#fff4ed] px-4 py-3 text-sm text-[#a04420]" role="alert">{message}</p>}<input name="date" type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} required className="h-11 w-full rounded-xl border px-3" /><div className="grid grid-cols-2 gap-3"><input name="startsAt" type="time" required className="h-11 rounded-xl border px-3" /><input name="endsAt" type="time" required className="h-11 rounded-xl border px-3" /></div><select name="repeatWeeks" value={repeatWeeks} onChange={(event) => { setRepeatWeeks(event.target.value); setRepeatIndefinitely(true); }} className="h-11 w-full rounded-xl border px-3"><option value="0">Does not repeat</option><option value="1">Every week</option><option value="2">Every 2 weeks</option><option value="3">Every 3 weeks</option></select>{repeatWeeks !== "0" && <><label className="flex items-center gap-2 text-sm"><input name="repeatIndefinitely" type="checkbox" checked={repeatIndefinitely} onChange={(event) => setRepeatIndefinitely(event.target.checked)} />Repeat indefinitely</label>{!repeatIndefinitely && <input name="repeatUntil" type="date" required className="h-11 w-full rounded-xl border px-3" />}</>}<input name="location" placeholder="Location" className="h-11 w-full rounded-xl border px-3" /><textarea name="notes" placeholder="Notes" className="w-full rounded-xl border px-3 py-2" /><button type="submit" className="h-11 w-full rounded-xl bg-[#ff6b35] font-semibold text-white">Save event</button></form></div>}
    </div>
  );
}