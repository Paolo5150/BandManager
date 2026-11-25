"use client";

import { useState, type InputHTMLAttributes } from "react";
import {
  createScheduleEvent,
  getEventCharges,
  deleteScheduleEvent,
  saveEventMemberCharges,
  updateScheduleEvent,
  type ScheduleEvent,
  type ScheduleMember,
  type ScheduleUnavailability,
} from "@/lib/backend/schedule";
import WaitingConfirmationModal from "./waiting-confirmation-modal";
import { logout } from "@/lib/backend/dashboard-data";
import LoadingSpinner from "../loading-spinner";
import LogoutButton from "../logout-button";
import NavigationLink from "../navigation-link";
import FullScheduleCalendar from "./full-calendar";

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const navigation = [
  "Overview",
  "Members",
  "Songlist",
  "Sets",
  "Schedule",
  "Unavailable",
  "Finance",
];
const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});
const monthFormatter = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "Australia/Sydney" });

const eventDateFormatter = new Intl.DateTimeFormat("en-AU", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Australia/Sydney",
});
const eventTimeFormatter = new Intl.DateTimeFormat("en-AU", {
  timeStyle: "short",
  timeZone: "Australia/Sydney",
});

function formatEventDate(value: string) {
  return eventDateFormatter.format(new Date(value));
}

function formatEventTime(value: string) {
  return eventTimeFormatter.format(new Date(value));
}

function calendarDateKey(value: string | Date) {
  if (typeof value === "string") {
    // The event date is already encoded in the first ten characters of the
    // database ISO value. Do not convert it through the browser timezone: a
    // Sydney event can otherwise move from the 23rd to the 24th.
    return value.slice(0, 10);
  }

  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

// text-base (16px) stops iOS Safari zooming the page when a field is focused
const fieldClass =
  "block h-11 w-full min-w-0 max-w-full rounded-xl border bg-white px-3 text-base";

// Native date/time input with a visible icon. On iOS the native control ignores
// width and has no icon, so we reset appearance, constrain width, draw our own
// icon, and stretch the (invisible) native picker indicator over the whole field
// so tapping anywhere opens the picker.
function PickerInput({
  label,
  icon,
  className = "",
  ...props
}: {
  label: string;
  icon: "calendar" | "clock";
} & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block min-w-0 text-sm font-medium text-[#303942]">
      {label}
      <div className="relative mt-1.5 min-w-0">
        <input
          {...props}
          className={`${fieldClass} appearance-none pr-10 text-left [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-date-and-time-value]:min-h-[1.5em] [&::-webkit-date-and-time-value]:text-left ${className}`}
        />
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#69727d]"
        >
          {icon === "calendar" ? (
            <>
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </>
          ) : (
            <>
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </>
          )}
        </svg>
      </div>
    </label>
  );
}

export default function ScheduleCalendar({
  events,
  members,
  isAdmin,
  waitingConfirmations,
  unavailability,
}: {
  events: ScheduleEvent[];
  members: ScheduleMember[];
  isAdmin: boolean;
  waitingConfirmations: ScheduleEvent[];
  unavailability: ScheduleUnavailability[];
}) {
  const currentDate = new Date();
  const firstEventDate = events.length
    ? new Date(
        Math.min(
          ...events.map((event) => new Date(event.starts_at).getTime()),
        ),
      )
    : currentDate;
  const [month, setMonth] = useState(
    new Date(firstEventDate.getFullYear(), firstEventDate.getMonth(), 1),
  );
  const [calendarView, setCalendarView] = useState<"month" | "week">("month");
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<ScheduleEvent | null>(
    null,
  );
  const [reviewEvent, setReviewEvent] = useState<ScheduleEvent | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  // membership_id -> amount in dollars (as typed)
  const [chargeInputs, setChargeInputs] = useState<Record<string, string>>({});
  const [chargesLoading, setChargesLoading] = useState(false);
  const [eventSaving, setEventSaving] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [deleteAction, setDeleteAction] = useState<"event" | "series" | null>(null);
  const [editScope, setEditScope] = useState<"instance" | "series">("instance");
  const [selectedDate, setSelectedDate] = useState("");
  const [repeatWeeks, setRepeatWeeks] = useState("0");
  const [repeatIndefinitely, setRepeatIndefinitely] = useState(true);

  const firstDay = new Date(month.getFullYear(), month.getMonth(), calendarView === "week" ? currentDate.getDate() : 1);
  firstDay.setDate(firstDay.getDate() - firstDay.getDay());
  const days = Array.from({ length: calendarView === "week" ? 7 : 42 }, (_, index) => {
    const day = new Date(firstDay);
    day.setDate(firstDay.getDate() + index);
    return day;
  });

  function eventsFor(day: Date) {
    const dayKey = calendarDateKey(day);
    return events.filter(
      (event) =>
        calendarDateKey(event.starts_at) === dayKey,
    );
  }

  function unavailableFor(day: Date) {
    const dayStart = new Date(`${calendarDateKey(day)}T00:00:00+11:00`).getTime();
    const dayEnd = dayStart + 86400000;
    return unavailability.filter((entry) => new Date(entry.start_date).getTime() < dayEnd && new Date(entry.end_date).getTime() > dayStart);
  }

  function weekEventStyle(event: ScheduleEvent) {
    const start = new Date(event.starts_at);
    const end = new Date(event.ends_at);
    const startMinutes = start.getHours() * 60 + start.getMinutes();
    const duration = Math.max(45, (end.getTime() - start.getTime()) / 60000);
    return { top: `${(startMinutes / 60) * 4}rem`, height: `${(duration / 60) * 4}rem` };
  }

  async function submit(formData: FormData) {
    setEventSaving(true);
    setMessage("");
    const cost = Math.round(
      (Number(formData.get("costCents") ?? 0) || 0) * 100,
    );
    const charges = Array.from(formData.entries())
      .filter(([key]) => key.startsWith("charge_"))
      .reduce(
        (sum, [, value]) => sum + Math.round((Number(value) || 0) * 100),
        0,
      );
    if (charges !== cost) {
      setMessage(
        `Member charges must add up to the event cost. Current total: $${(charges / 100).toFixed(2)}.`,
      );
      setEventSaving(false);
      return;
    }
    const result = await createScheduleEvent(formData);
    if (result.error) setMessage(result.error);
    else {
      setMessage("Event added.");
      setIsOpen(false);
    }
    setEventSaving(false);
  }

  async function startEdit(event: ScheduleEvent) {
    setIsOpen(false);
    setSelectedEvent(event);
    setMessage("");
    setEditScope("instance");
    setChargeInputs({});
    setChargesLoading(true);
    setIsEditing(true);
    const charges = await getEventCharges(event.id);
    const inputs: Record<string, string> = {};
    for (const charge of charges) {
      if (charge.membership_id)
        inputs[charge.membership_id] = (charge.amount_cents / 100).toFixed(2);
    }
    setChargeInputs(inputs);
    setChargesLoading(false);
  }

  async function saveEdit(formData: FormData) {
    setEditSaving(true);
    setMessage("");
    const cost = Math.round(
      (Number(formData.get("costCents") ?? 0) || 0) * 100,
    );
    const total = members.reduce(
      (sum, member) =>
        sum + Math.round((Number(chargeInputs[member.id]) || 0) * 100),
      0,
    );
    if (total !== cost) {
      setMessage(
          `Member charges must add up to the event cost. Current total: $${(total / 100).toFixed(2)}.`,
      );
      setEditSaving(false);
      return;
    }
    const result = await updateScheduleEvent(formData);
    if (result.error) {
      setMessage(result.error);
      setEditSaving(false);
      return;
    }
    const chargesResult = await saveEventMemberCharges(formData);
    if (chargesResult.error) {
      setMessage(chargesResult.error);
      setEditSaving(false);
      return;
    }
    setSelectedEvent(null);
    setIsEditing(false);
    setMessage("Event updated.");
    setEditSaving(false);
  }

  function editEventForm() {
    if (!selectedEvent) return null;
    const start = new Date(selectedEvent.starts_at);
    const end = new Date(selectedEvent.ends_at);
    const date = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-5">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void saveEdit(new FormData(event.currentTarget));
          }}
          className="max-h-[92vh] w-full max-w-lg space-y-4 overflow-y-auto overflow-x-hidden rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-3xl sm:p-7"
        >
          <input type="hidden" name="eventId" value={selectedEvent.id} />
          {selectedEvent.series_id && (
            <input
              type="hidden"
              name="seriesId"
              value={selectedEvent.series_id}
            />
          )}
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Edit event</h2>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-2 text-2xl"
              aria-label="Close"
            >
              &times;
            </button>
          </div>
          {selectedEvent.series_id && (
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="editScope"
                  value="instance"
                  checked={editScope === "instance"}
                  onChange={() => setEditScope("instance")}
                />
                <span>This event</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="editScope"
                  value="series"
                  checked={editScope === "series"}
                  onChange={() => setEditScope("series")}
                />
                <span>Entire series</span>
              </label>
            </div>
          )}
          <label className="block text-sm font-medium text-[#303942]">
            Type
            <select
              name="type"
              defaultValue={selectedEvent.type}
              className={`${fieldClass} mt-1.5`}
            >
              <option value="practice">Practice</option>
              <option value="gig">Gig</option>
            </select>
          </label>
          <label className="block text-sm font-medium text-[#303942]">
            Title
            <input
              name="title"
              defaultValue={selectedEvent.title}
              className={`${fieldClass} mt-1.5`}
            />
          </label>
          <label className="block text-sm font-medium text-[#303942]">
            Total cost
            <input
              name="costCents"
              type="number"
              inputMode="decimal"
              step="0.01"
              defaultValue={
                selectedEvent.cost_cents ? selectedEvent.cost_cents / 100 : 0
              }
              className={`${fieldClass} mt-1.5`}
            />
          </label>
          <details className="rounded-xl border border-[#e8e1e9] p-4">
            <summary className="cursor-pointer text-sm font-semibold text-[#303942]">
              Member charges
            </summary>
            {chargesLoading ? (
              <p className="mt-4 text-sm text-[#69727d]">Loading charges...</p>
            ) : (
              <div className="mt-4 space-y-3">
                {members.map((member) => (
                  <label
                    key={member.id}
                    className="grid grid-cols-[minmax(0,1fr)_7rem] items-center gap-3 text-sm"
                  >
                    <span className="truncate">{member.name}</span>
                    <input
                      name={`charge_${member.id}`}
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={chargeInputs[member.id] ?? "0"}
                      onChange={(event) =>
                        setChargeInputs((prev) => ({
                          ...prev,
                          [member.id]: event.target.value,
                        }))
                      }
                      className="h-10 w-full min-w-0 rounded-lg border px-3 text-base"
                    />
                  </label>
                ))}
              </div>
            )}
          </details>
          <PickerInput
            label="Date"
            icon="calendar"
            name="date"
            type="date"
            defaultValue={date}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <PickerInput
              label="Starts"
              icon="clock"
              name="startsAt"
              type="time"
              defaultValue={start.toTimeString().slice(0, 5)}
              required
            />
            <PickerInput
              label="Ends"
              icon="clock"
              name="endsAt"
              type="time"
              defaultValue={end.toTimeString().slice(0, 5)}
              required
            />
          </div>
          <label className="block text-sm font-medium text-[#303942]">
            Location
            <input
              name="location"
              defaultValue={selectedEvent.location ?? ""}
              className={`${fieldClass} mt-1.5`}
            />
          </label>
          <label className="block text-sm font-medium text-[#303942]">
            Notes
            <textarea
              name="notes"
              defaultValue={selectedEvent.notes ?? ""}
              rows={3}
              className="mt-1.5 block w-full min-w-0 rounded-xl border px-3 py-2 text-base"
            />
          </label>
          {message && (
            <p
              className="rounded-xl bg-[#fff4ed] px-4 py-3 text-sm text-[#a04420]"
              role="alert"
            >
              {message}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="submit"
              disabled={chargesLoading}
              className="rounded-xl bg-[#ff6b35] py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="rounded-xl bg-[#f5f2ee] py-3 text-sm font-semibold"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  async function removeEvent(all: boolean) {
    if (
      !selectedEvent ||
      !window.confirm(all ? "Delete the entire series?" : "Delete this event?")
    )
      return;
    setDeleteAction(all ? "series" : "event");
    const data = new FormData();
    data.set("eventId", selectedEvent.id);
    if (all && selectedEvent.series_id)
      data.set("seriesId", selectedEvent.series_id);
    const result = await deleteScheduleEvent(data);
    if (result.error) setMessage(result.error);
    else {
      setSelectedEvent(null);
      setMessage("Event deleted.");
    }
    setDeleteAction(null);
  }

  function openAddForDate(day: Date) {
    const dayEvents = eventsFor(day);
    if (dayEvents.length) {
      const event = dayEvents[0];
      setIsOpen(false);
      setMessage("");
      setSelectedEvent(event);
      setIsEditing(isAdmin && event.status !== "completed");
      if (isAdmin && event.status !== "completed") {
        void startEdit(event);
      }
      return;
    }
    if (!isAdmin) return;
    setMessage("");
    setSelectedDate(
      `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`,
    );
    setIsOpen(true);
  }

  function openAddEvent() {
    if (!isAdmin) return;
    setMessage("");
    setSelectedDate("");
    setIsOpen(true);
  }

  const selectedEventIsCompleted = selectedEvent?.status === "completed";
  const canModifySelectedEvent = Boolean(
    isAdmin && selectedEvent && !selectedEventIsCompleted,
  );

  return (
    <div className="flex min-h-screen bg-[#f8f5f1]">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-[#e8e1e9] bg-white px-5 py-6 md:flex">
        <div className="flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ff6b35] text-lg font-bold text-white">
            B
          </div>
          <span className="font-semibold text-[#17202a]">BandManager</span>
        </div>
        <nav
          className="mt-10 flex flex-1 flex-col gap-1"
          aria-label="Dashboard navigation"
        >
          <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-[#a0a5aa]">
            Workspace
          </p>
          {navigation.map((item) => (
            <NavigationLink
              key={item}
              href={item === "Overview" ? "/dashboard" : `/dashboard/${item === "Unavailable" ? "unavailability" : item.toLowerCase()}`}
              active={item === "Schedule"}
            >
              {item}
            </NavigationLink>
          ))}
        </nav>
        <form action={logout}>
          <LogoutButton className="w-full border-t border-[#eee9e3] px-3 pt-5 text-left text-sm text-[#69727d]" />
        </form>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-5 sm:px-10 sm:py-8 lg:px-14">
        <div className="mx-auto min-w-0 max-w-6xl">
          <nav className="mb-6 flex gap-2 overflow-x-auto pb-1 md:hidden">
            {navigation.map((item) => (
              <NavigationLink
                key={item}
                href={item === "Overview" ? "/dashboard" : `/dashboard/${item === "Unavailable" ? "unavailability" : item.toLowerCase()}`}
                active={item === "Schedule"}
                mobile
              >
                {item}
              </NavigationLink>
            ))}
          </nav>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-[#ff6b35]">
                Workspace
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-[#17202a]">
                Schedule
              </h1>
              <p className="mt-2 text-sm text-[#69727d]">
                See your band&apos;s week at a glance.
              </p>
            </div>
            {isAdmin && (
              <button
                type="button"
                onClick={openAddEvent}
                className="rounded-xl bg-[#ff6b35] px-4 py-2.5 text-sm font-semibold text-white"
              >
                Add event
              </button>
            )}
          </div>
          {isAdmin && waitingConfirmations.length > 0 && (
            <section className="mt-8 rounded-2xl border border-[#f0d4c5] bg-[#fff8f3] p-5">
              <h2 className="font-semibold text-[#17202a]">
                Waiting confirmations
              </h2>
              <div className="mt-3 space-y-2">
                {waitingConfirmations.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => setReviewEvent(event)}
                    className="flex w-full items-center justify-between rounded-xl border border-[#f0d4c5] bg-white px-4 py-3 text-left text-sm"
                  >
                    <span>
                      <b>{event.title}</b>
                      <br />
                      <span className="text-[#69727d]">
                        {formatEventDate(event.ends_at)}
                      </span>
                    </span>
                    <span className="font-semibold text-[#e95a27]">Review</span>
                  </button>
                ))}
              </div>
            </section>
          )}
          <section className="mt-8 rounded-2xl border border-[#e8e1e9] bg-white p-3 shadow-sm sm:p-5">
            <FullScheduleCalendar events={events} unavailability={unavailability} onEvent={(event) => setSelectedEvent(event)} onDate={(date) => { if (isAdmin) { setSelectedDate(date); setIsOpen(true); } }} onUnavailable={(names) => setMessage(`Unavailable: ${names.join(", ")}`)} />
          </section>
          <section className="hidden mt-8 overflow-hidden rounded-2xl border border-[#e8e1e9] bg-white shadow-sm">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="text-lg font-semibold text-[#17202a]">
                {calendarView === "week" ? `${monthFormatter.format(days[0])} - ${monthFormatter.format(days[6])}` : monthFormatter.format(month)}
              </h2>
              <div className="flex rounded-lg bg-[#f5f2ee] p-1"><button type="button" onClick={() => setCalendarView("month")} className={`rounded-md px-2 py-1 text-xs font-semibold ${calendarView === "month" ? "bg-white shadow-sm" : "text-[#69727d]"}`}>Month</button><button type="button" onClick={() => setCalendarView("week")} className={`rounded-md px-2 py-1 text-xs font-semibold ${calendarView === "week" ? "bg-white shadow-sm" : "text-[#69727d]"}`}>Week</button></div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setMonth(
                      new Date(month.getFullYear(), month.getMonth() - 1, 1),
                    )
                  }
                  className="rounded-lg border px-3 py-2 text-sm"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setMonth(new Date())}
                  className="rounded-lg border px-3 py-2 text-sm"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setMonth(
                      new Date(month.getFullYear(), month.getMonth() + 1, 1),
                    )
                  }
                  className="rounded-lg border px-3 py-2 text-sm"
                >
                  Next
                </button>
              </div>
            </div>
            {calendarView === "week" ? <div className="overflow-x-auto"><div className="grid min-w-[48rem] grid-cols-[4rem_repeat(7,minmax(6rem,1fr))] border-b"><div className="border-r" />{days.map((day) => <p key={day.toISOString()} className="border-r px-1 py-3 text-center text-xs font-semibold text-[#a0a5aa]">{day.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit" })}</p>)}<div className="relative border-r">{Array.from({ length: 24 }, (_, hour) => <div key={hour} className="h-16 border-b px-1 pt-1 text-[10px] text-[#a0a5aa]">{String(hour).padStart(2, "0")}:00</div>)}</div>{days.map((day) => <div key={day.toISOString()} className="relative border-r"><div className="absolute inset-0">{Array.from({ length: 24 }, (_, hour) => <div key={hour} className="h-16 border-b" />)}</div>{eventsFor(day).map((event) => <button key={event.id} type="button" onClick={() => setSelectedEvent(event)} style={weekEventStyle(event)} className="absolute left-1 right-1 z-10 overflow-hidden rounded-lg bg-[#fff1e9] px-2 py-1 text-left text-xs font-semibold text-[#a04420] shadow-sm">{event.title}</button>)}</div>)}</div></div> : <div className="grid grid-cols-7 border-b">
              {weekdays.map((day) => (
                <p
                  key={day}
                  className="border-r px-2 py-3 text-center text-xs font-semibold text-[#a0a5aa]"
                >
                  {day}
                </p>
              ))}
            </div>}
            <div className="grid grid-cols-7">
              {days.map((day) => (
                <div
                  role="button"
                  tabIndex={0}
                  key={day.toISOString()}
                  onClick={() => openAddForDate(day)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ")
                      openAddForDate(day);
                  }}
                  className={`min-h-24 w-full cursor-pointer text-left border-b border-r p-2 ${day.getMonth() !== month.getMonth() ? "text-[#b6b9bc]" : ""} ${day.toDateString() === currentDate.toDateString() ? "bg-[#fff4ed]" : ""}`}
                >
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${day.toDateString() === currentDate.toDateString() ? "bg-[#ff6b35] text-white" : ""}`}
                  >
                    {day.getDate()}
                  </span>
                  {unavailableFor(day).length > 0 && <button type="button" onClick={(event) => { event.stopPropagation(); setMessage(`Unavailable: ${unavailableFor(day).map((entry) => entry.member_name).join(", ")}`); }} className="mt-1 flex h-7 w-7 items-center justify-center rounded-full bg-[#fce9e4] text-sm font-bold text-[#a04420]" aria-label="Show unavailable members">!</button>}
                  {eventsFor(day).map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      onClick={(clickEvent) => {
                        clickEvent.stopPropagation();
                        setSelectedEvent(event);
                      }}
                      className={`mt-1 flex min-h-8 w-full items-center gap-1.5 truncate rounded-lg px-2 py-1.5 text-left text-sm font-medium leading-5 hover:bg-[#ffe3d5] ${event.status === "completed" ? "bg-[#eefbf4] text-[#24734b]" : "bg-[#fff1e9] text-[#a04420]"}`}
                    >
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-current" aria-hidden="true" />
                      {event.title}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </section>
          {message && <p className="mt-4 text-sm text-[#24734b]">{message}</p>}
        </div>
      </main>
      {reviewEvent && (
        <WaitingConfirmationModal
          event={reviewEvent}
          onClose={() => setReviewEvent(null)}
        />
      )}
      {selectedEvent && !isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-5">
          <div className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-7">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-[#ff6b35]">
                  {selectedEvent.type}
                </p>
                <h2 className="mt-2 text-2xl font-semibold">
                  {selectedEvent.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="text-2xl"
              >
                &times;
              </button>
            </div>
            <div className="mt-6 space-y-4 text-sm">
              <p>
                <b>When</b>
                <br />
                {formatEventDate(selectedEvent.starts_at)} &rarr;{" "}
                {formatEventTime(selectedEvent.ends_at)}
              </p>
              {selectedEvent.location && (
                <p>
                  <b>Location</b>
                  <br />
                  {selectedEvent.location}
                </p>
              )}
              {selectedEvent.notes && (
                <p className="whitespace-pre-wrap">
                  <b>Notes</b>
                  <br />
                  {selectedEvent.notes}
                </p>
              )}
              {selectedEvent.cost_cents != null &&
                selectedEvent.cost_cents > 0 && (
                  <p>
                    <b>Cost</b>
                    <br />
                    {currencyFormatter.format(selectedEvent.cost_cents / 100)}
                  </p>
                )}
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              {canModifySelectedEvent && (
                <button
                  type="button"
                  onClick={() => void startEdit(selectedEvent)}
                  className="rounded-xl bg-[#ff6b35] py-3 text-sm font-semibold text-white"
                >
                  Edit
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="rounded-xl bg-[#f5f2ee] py-3 text-sm font-semibold"
              >
                Close
              </button>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {canModifySelectedEvent && (
                <>
                  <button
                    type="button"
                    onClick={() => void removeEvent(false)}
                    disabled={deleteAction !== null}
                    className="flex items-center justify-center rounded-xl border border-[#e7b4a7] bg-[#fff4ed] px-3 py-2.5 text-sm font-semibold text-[#a04420] hover:bg-[#ffe5dc] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {deleteAction === "event" ? <LoadingSpinner label="Deleting..." /> : "Delete event"}
                  </button>
                  {selectedEvent.series_id && (
                    <button
                      type="button"
                      onClick={() => void removeEvent(true)}
                      disabled={deleteAction !== null}
                      className="flex items-center justify-center rounded-xl border border-[#d99b8d] bg-[#fce9e4] px-3 py-2.5 text-sm font-semibold text-[#8e2f1e] hover:bg-[#f8d9d1] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {deleteAction === "series" ? <LoadingSpinner label="Deleting..." /> : "Delete series"}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {isEditing && editEventForm()}
      {isOpen && !selectedEvent && !isEditing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-5">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submit(new FormData(event.currentTarget));
            }}
            className="max-h-[92vh] w-full max-w-lg space-y-4 overflow-y-auto overflow-x-hidden rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-3xl sm:p-7"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">Add event</h2>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-2 text-2xl"
                aria-label="Close"
              >
                &times;
              </button>
            </div>
            <label className="block text-sm font-medium text-[#303942]">
              Type
              <select name="type" className={`${fieldClass} mt-1.5`}>
                <option value="practice">Practice</option>
                <option value="gig">Gig</option>
              </select>
            </label>
            <label className="block text-sm font-medium text-[#303942]">
              Title
              <input
                name="title"
                placeholder="Title"
                className={`${fieldClass} mt-1.5`}
              />
            </label>
            {isAdmin && (
              <>
                <label className="block text-sm font-medium text-[#303942]">
                  Total cost ($)
                  <input
                    name="costCents"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    placeholder="$0.00"
                    className={`${fieldClass} mt-1.5`}
                  />
                </label>
                <details className="rounded-xl border border-[#e8e1e9] p-4">
                  <summary className="cursor-pointer text-sm font-semibold text-[#303942]">
                    Member charges
                  </summary>
                  <div className="mt-4 space-y-3">
                    {members.map((member) => (
                      <label
                        key={member.id}
                        className="grid grid-cols-[minmax(0,1fr)_7rem] items-center gap-3 text-sm"
                      >
                        <span className="truncate">{member.name} ($)</span>
                        <input
                          name={`charge_${member.id}`}
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                           defaultValue="0"
                           placeholder="$0.00"
                          className="h-10 w-full min-w-0 rounded-lg border px-3 text-base"
                        />
                      </label>
                    ))}
                  </div>
                </details>
              </>
            )}
            <PickerInput
              label="Date"
              icon="calendar"
              name="date"
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <PickerInput
                label="Starts"
                icon="clock"
                name="startsAt"
                type="time"
                required
              />
              <PickerInput
                label="Ends"
                icon="clock"
                name="endsAt"
                type="time"
                required
              />
            </div>
            <label className="block text-sm font-medium text-[#303942]">
              Repeat
              <select
                name="repeatWeeks"
                value={repeatWeeks}
                onChange={(event) => {
                  setRepeatWeeks(event.target.value);
                  setRepeatIndefinitely(true);
                }}
                className={`${fieldClass} mt-1.5`}
              >
                <option value="0">Does not repeat</option>
                <option value="1">Every week</option>
                <option value="2">Every 2 weeks</option>
                <option value="3">Every 3 weeks</option>
              </select>
            </label>
            {repeatWeeks !== "0" && (
              <>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    name="repeatIndefinitely"
                    type="checkbox"
                    checked={repeatIndefinitely}
                    onChange={(event) =>
                      setRepeatIndefinitely(event.target.checked)
                    }
                  />
                  Repeat indefinitely
                </label>
                {!repeatIndefinitely && (
                  <PickerInput
                    label="Repeat until"
                    icon="calendar"
                    name="repeatUntil"
                    type="date"
                    required
                  />
                )}
              </>
            )}
            <label className="block text-sm font-medium text-[#303942]">
              Location
              <input
                name="location"
                placeholder="Location"
                className={`${fieldClass} mt-1.5`}
              />
            </label>
            <label className="block text-sm font-medium text-[#303942]">
              Notes
              <textarea
                name="notes"
                placeholder="Notes"
                rows={3}
                className="mt-1.5 block w-full min-w-0 rounded-xl border px-3 py-2 text-base"
              />
            </label>
            {message && (
              <p
                className="rounded-xl bg-[#fff4ed] px-4 py-3 text-sm text-[#a04420]"
                role="alert"
              >
                {message}
              </p>
            )}
            <button
              type="submit"
              disabled={eventSaving}
              className="flex h-11 w-full items-center justify-center rounded-xl bg-[#ff6b35] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {eventSaving ? <LoadingSpinner label="Saving event..." /> : "Save event"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
