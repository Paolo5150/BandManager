import { connection } from "next/server";
import { getDashboardData } from "@/lib/backend/dashboard-data";
import { getUpcomingOverviewEvents, type ScheduleEvent } from "@/lib/backend/schedule";
import DashboardShell from "./dashboard-shell";
import PageHeader from "./page-header";
import NotificationControls from "./notification-controls";
import { getScheduleAccess } from "@/lib/backend/schedule";
import SendUpcomingReminderButton from "./send-upcoming-reminder-button";
import OpenInMapsLink from "./open-in-maps-link";
import { formatDate, formatEventTime, formatWeekday } from "@/lib/date-format";

export const instant = false;

function EventCard({ event, label, canSendReminder = false }: { event: ScheduleEvent | null; label: string; canSendReminder?: boolean }) {
  return (
    <section className="min-w-0 rounded-2xl border border-[#e8e1e9] bg-white p-4 shadow-sm sm:p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-[#ff6b35]">{label}</p>
      {event ? (
        <>
          <h2 className="mt-2 break-words text-lg font-semibold text-[#17202a] sm:text-xl">{event.title}</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div>
              <dt className="font-medium text-[#303942]">When</dt>
              <dd className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-xl font-bold leading-tight text-[#17202a] sm:text-2xl">{formatWeekday(event.starts_at)}, {formatDate(event.starts_at)}</span>
                <span className="text-base font-semibold text-[#ff6b35]">{formatEventTime(event.starts_at)}</span>
                <span className="text-xs text-[#69727d]">until {formatEventTime(event.ends_at)}</span>
              </dd>
            </div>
            {event.location && <div><dt className="font-medium text-[#303942]">Location</dt><dd className="break-words text-[#69727d]">{event.location}<OpenInMapsLink location={event.location} /></dd></div>}
            {event.notes && <div><dt className="font-medium text-[#303942]">Notes</dt><dd className="whitespace-pre-wrap break-words text-[#69727d]">{event.notes}</dd></div>}
          </dl>
          {canSendReminder && <SendUpcomingReminderButton eventId={event.id} />}
        </>
      ) : <p className="mt-3 text-sm text-[#69727d]">No upcoming event.</p>}
    </section>
  );
}

export default async function DashboardPage() {
  await connection();
  const [{ userName, bandName }, { next, nextGig }, isAdmin] = await Promise.all([getDashboardData(), getUpcomingOverviewEvents(), getScheduleAccess()]);
  return (
    <DashboardShell active="Overview">
      <PageHeader eyebrow={bandName} title={`Good to see you, ${userName}`} description="Here's what's coming up for your band." />
      <NotificationControls vapidPublicKey={process.env.VAPID_PUBLIC_KEY ?? ""} />
      <div className="mt-6 grid gap-4 sm:mt-8 md:grid-cols-2">
        <EventCard event={next} label="Next event" canSendReminder={isAdmin} />
        <EventCard event={nextGig} label="Next gig" />
      </div>
    </DashboardShell>
  );
}