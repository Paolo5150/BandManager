"use client";

import Link from "next/link";
import { useState } from "react";
import { createScheduleEvent, type ScheduleEvent } from "@/lib/backend/schedule";
import { logout } from "@/lib/backend/dashboard-data";

const navigation = ["Overview", "Members", "Songlist", "Sets", "Schedule", "Finance"];
const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function ScheduleCalendar({ events }: { events: ScheduleEvent[] }) {
  const currentDate = new Date();
  const [month, setMonth] = useState(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1));
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
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
    const result = await createScheduleEvent(formData);
    if (result.error) setMessage(result.error);
    else { setMessage("Event added."); setIsOpen(false); }
  }

  return (
    <div className="flex min-h-screen bg-[#f8f5f1]">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-[#e8e1e9] bg-white px-5 py-6 md:flex">
        <div className="flex items-center gap-3 px-2"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ff6b35] text-lg font-bold text-white">B</div><span className="font-semibold text-[#17202a]">BandManager</span></div>
        <nav className="mt-10 flex flex-1 flex-col gap-1" aria-label="Dashboard navigation"><p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-[#a0a5aa]">Workspace</p>{navigation.map((item) => <Link key={item} href={item === "Overview" ? "/dashboard" : `/dashboard/${item.toLowerCase()}`} className={`rounded-xl px-3 py-3 text-sm ${item === "Schedule" ? "bg-[#fff1e9] text-[#e95a27]" : "text-[#69727d] hover:bg-[#f8f5f1]"}`}>{item}</Link>)}</nav>
        <form action={logout}><button type="submit" className="w-full border-t border-[#eee9e3] px-3 pt-5 text-left text-sm text-[#69727d]">Log out</button></form>
      </aside>

      <main className="flex-1 px-4 py-5 sm:px-10 sm:py-8 lg:px-14"><div className="mx-auto max-w-6xl"><nav className="mb-6 flex gap-2 overflow-x-auto pb-1 md:hidden">{navigation.map((item) => <Link key={item} href={item === "Overview" ? "/dashboard" : `/dashboard/${item.toLowerCase()}`} className="shrink-0 rounded-lg bg-white px-3 py-2 text-sm text-[#69727d]">{item}</Link>)}</nav>
        <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-wider text-[#ff6b35]">Workspace</p><h1 className="mt-2 text-3xl font-semibold text-[#17202a]">Schedule</h1><p className="mt-2 text-sm text-[#69727d]">See your band&apos;s week at a glance.</p></div><button type="button" onClick={() => setIsOpen(true)} className="rounded-xl bg-[#ff6b35] px-4 py-2.5 text-sm font-semibold text-white">Add event</button></div>
        <section className="mt-8 overflow-hidden rounded-2xl border border-[#e8e1e9] bg-white shadow-sm"><div className="flex items-center justify-between border-b px-5 py-4"><h2 className="text-lg font-semibold text-[#17202a]">{month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h2><div className="flex gap-2"><button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="rounded-lg border px-3 py-2 text-sm">Previous</button><button type="button" onClick={() => setMonth(new Date())} className="rounded-lg border px-3 py-2 text-sm">Today</button><button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="rounded-lg border px-3 py-2 text-sm">Next</button></div></div><div className="grid grid-cols-7 border-b">{weekdays.map((day) => <p key={day} className="border-r px-2 py-3 text-center text-xs font-semibold text-[#a0a5aa]">{day}</p>)}</div><div className="grid grid-cols-7">{days.map((day) => <div key={day.toISOString()} className={`min-h-24 border-b border-r p-2 ${day.getMonth() !== month.getMonth() ? "text-[#b6b9bc]" : ""} ${day.toDateString() === currentDate.toDateString() ? "bg-[#fff4ed]" : ""}`}><span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${day.toDateString() === currentDate.toDateString() ? "bg-[#ff6b35] text-white" : ""}`}>{day.getDate()}</span>{eventsFor(day).map((event) => <p key={event.id} className="mt-1 truncate rounded bg-[#fff1e9] px-1 text-xs text-[#a04420]">{event.title}</p>)}</div>)}</div></section>{message && <p className="mt-4 text-sm text-[#24734b]">{message}</p>}
      </div></main>

      {isOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-5"><form action={submit} className="w-full max-w-lg space-y-4 rounded-3xl bg-white p-7"><div className="flex items-center justify-between"><h2 className="text-2xl font-semibold">Add event</h2><button type="button" onClick={() => setIsOpen(false)} className="text-2xl">×</button></div><select name="type" className="h-11 w-full rounded-xl border px-3"><option value="practice">Practice</option><option value="gig">Gig</option></select><input name="title" placeholder="Title" className="h-11 w-full rounded-xl border px-3" /><input name="date" type="date" required className="h-11 w-full rounded-xl border px-3" /><div className="grid grid-cols-2 gap-3"><input name="startsAt" type="time" required className="h-11 rounded-xl border px-3" /><input name="endsAt" type="time" required className="h-11 rounded-xl border px-3" /></div><select name="repeatWeeks" value={repeatWeeks} onChange={(event) => { setRepeatWeeks(event.target.value); setRepeatIndefinitely(true); }} className="h-11 w-full rounded-xl border px-3"><option value="0">Does not repeat</option><option value="1">Every week</option><option value="2">Every 2 weeks</option><option value="3">Every 3 weeks</option></select>{repeatWeeks !== "0" && <><label className="flex items-center gap-2 text-sm"><input name="repeatIndefinitely" type="checkbox" checked={repeatIndefinitely} onChange={(event) => setRepeatIndefinitely(event.target.checked)} />Repeat indefinitely</label>{!repeatIndefinitely && <input name="repeatUntil" type="date" required className="h-11 w-full rounded-xl border px-3" />}</>}<input name="location" placeholder="Location" className="h-11 w-full rounded-xl border px-3" /><textarea name="notes" placeholder="Notes" className="w-full rounded-xl border px-3 py-2" /><button type="submit" className="h-11 w-full rounded-xl bg-[#ff6b35] font-semibold text-white">Save event</button></form></div>}
    </div>
  );
}