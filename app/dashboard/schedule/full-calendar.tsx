"use client";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import "@fullcalendar/core/index.css";
import "@fullcalendar/daygrid/index.css";
import "@fullcalendar/timegrid/index.css";
import type { ScheduleEvent, ScheduleUnavailability } from "@/lib/backend/schedule";

export default function FullScheduleCalendar({ events, unavailability, onEvent }: { events: ScheduleEvent[]; unavailability: ScheduleUnavailability[]; onEvent: (event: ScheduleEvent) => void }) {
  const calendarEvents = [
    ...events.map((event) => ({ id: event.id, title: event.title, start: event.starts_at, end: event.ends_at, extendedProps: { scheduleEvent: event } })),
    ...unavailability.map((entry) => ({ id: `unavailable-${entry.id}`, title: `! ${entry.member_name}`, start: entry.start_date, end: entry.end_date, display: "background", backgroundColor: "#ffe5dc", borderColor: "#e95a27", extendedProps: { unavailable: true } })),
  ];
  return <div className="full-calendar-wrapper"><FullCalendar plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]} initialView="dayGridMonth" headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay" }} height="auto" expandRows events={calendarEvents} eventClick={(info) => { const event = info.event.extendedProps.scheduleEvent as ScheduleEvent | undefined; if (event) onEvent(event); }} dateClick={() => undefined} /></div>;
}