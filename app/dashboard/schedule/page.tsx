import ScheduleCalendar from "./schedule-calendar";
import { connection } from "next/server";
import { getScheduleEvents, getScheduleMembers, getScheduleAccess } from "@/lib/backend/schedule";

export const instant = false;

export default async function SchedulePage() {
  await connection();
  const [events, members, isAdmin] = await Promise.all([getScheduleEvents(), getScheduleMembers(), getScheduleAccess()]);
  return <ScheduleCalendar events={events} members={members} isAdmin={isAdmin} />;
}