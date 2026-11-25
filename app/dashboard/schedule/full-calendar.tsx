"use client";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { ScheduleEvent, ScheduleUnavailability } from "@/lib/backend/schedule";
import type { Unavailability } from "@/lib/backend/unavailability";

export default function FullScheduleCalendar({ events = [], unavailability = [], personalEntries = [], onEvent, onDate, onUnavailable, personal = false }: { events?: ScheduleEvent[]; unavailability?: ScheduleUnavailability[]; personalEntries?: Unavailability[]; onEvent?: (event: ScheduleEvent) => void; onDate: (date: string) => void; onUnavailable?: (names: string[]) => void; personal?: boolean }) {
  const calendarEvents = [
    ...events.map((event) => ({ id: event.id, title: event.title, start: event.starts_at, end: event.ends_at, extendedProps: { scheduleEvent: event } })),
    ...unavailability.map((entry) => ({ id: `unavailable-${entry.id}`, title: `! ${entry.member_name}`, start: entry.start_date, end: entry.end_date, extendedProps: { unavailable: true, memberName: entry.member_name } })),
    ...personalEntries.map((entry) => ({ id: entry.id, title: "Unavailable", start: entry.start_date, end: entry.end_date, extendedProps: { personalEntry: entry } })),
  ];
  return <div className="full-calendar-wrapper"><FullCalendar plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]} initialView="dayGridMonth" headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay" }} height="auto" expandRows events={calendarEvents} eventContent={(info) => <span>{info.event.title}</span>} eventClick={(info) => { const event = info.event.extendedProps.scheduleEvent as ScheduleEvent | undefined; if (event) onEvent?.(event); else if (info.event.extendedProps.unavailable) onUnavailable?.([String(info.event.extendedProps.memberName)]); else if (personal && info.event.extendedProps.personalEntry) onUnavailable?.(["Your unavailability"]); }} dateClick={(info) => onDate(info.dateStr)} /></div>;
}