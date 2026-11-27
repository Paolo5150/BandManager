"use client";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { ScheduleEvent, ScheduleUnavailability } from "@/lib/backend/schedule";
import type { Unavailability } from "@/lib/backend/unavailability";
import { unavailableColor } from "../unavailability-colors";
import { formatEventDateTime, getSydneyDateTimeParts } from "@/lib/date-format";

function calendarValue(value: string) {
  const parts = getSydneyDateTimeParts(value);
  return `${parts.date}T${parts.time}:00`;
}

export default function FullScheduleCalendar({ events = [], unavailability = [], personalEntries = [], onEvent, onDate, onUnavailable }: { events?: ScheduleEvent[]; unavailability?: ScheduleUnavailability[]; personalEntries?: Unavailability[]; onEvent?: (event: ScheduleEvent) => void; onDate: (date: string) => void; onUnavailable?: (details: string[]) => void }) {
  const calendarEvents = [
    ...events.map((event) => ({
      id: event.id,
      title: event.title,
      start: calendarValue(event.starts_at),
      end: calendarValue(event.ends_at),
      backgroundColor: event.status === "completed" ? "#dff5e9" : "#fff4ed",
      borderColor: event.status === "completed" ? "#78c99a" : "#ffb08e",
      textColor: event.status === "completed" ? "#24734b" : "#a04420",
      extendedProps: { scheduleEvent: event },
    })),
    ...unavailability.map((entry) => ({ id: `unavailable-${entry.id}`, title: `! ${entry.member_name}`, start: calendarValue(entry.start_date), end: calendarValue(entry.end_date), ...unavailableColor(entry.membership_id, entry.member_name), extendedProps: { unavailable: true, memberName: entry.member_name, startDate: entry.start_date, endDate: entry.end_date } })),
    ...personalEntries.map((entry) => ({ id: entry.id, title: `! ${entry.member_name}`, start: calendarValue(entry.start_date), end: calendarValue(entry.end_date), ...unavailableColor(entry.membership_id, entry.member_name), extendedProps: { personalEntry: entry, memberName: entry.member_name, startDate: entry.start_date, endDate: entry.end_date } })),
  ];
  return (
    <div className="full-calendar-wrapper">
      <p className="calendar-scroll-hint">Swipe sideways to see the rest of the week.</p>
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek" }}
        height="auto"
        expandRows
        dayMaxEvents={2}
        displayEventTime={false}
        slotDuration="01:00:00"
        events={calendarEvents}
        viewDidMount={(info) => {
          const container = info.el.parentElement;
          if (!container) return;
          if (info.view.type === "timeGridWeek") {
            container.tabIndex = 0;
            container.setAttribute("role", "region");
            container.setAttribute("aria-label", "Weekly calendar, scroll horizontally to see all days");
          } else {
            container.removeAttribute("tabindex");
            container.removeAttribute("role");
            container.removeAttribute("aria-label");
          }
        }}
        eventClick={(info) => {
          const event = info.event.extendedProps.scheduleEvent as ScheduleEvent | undefined;
          if (event) onEvent?.(event);
          else if (info.event.extendedProps.unavailable || info.event.extendedProps.personalEntry) onUnavailable?.([`${String(info.event.extendedProps.memberName)}: ${formatEventDateTime(String(info.event.extendedProps.startDate))} – ${formatEventDateTime(String(info.event.extendedProps.endDate))}`]);
        }}
        dateClick={(info) => onDate(info.dateStr.slice(0, 10))}
      />
    </div>
  );
}