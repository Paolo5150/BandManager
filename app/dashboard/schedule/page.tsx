import ScheduleCalendar from "./schedule-calendar";
import { connection } from "next/server";
import { getScheduleEvents, getScheduleMembers } from "@/lib/backend/schedule";

export const instant = false;

export default async function SchedulePage() {
  await connection();
  const [events, members] = await Promise.all([getScheduleEvents(), getScheduleMembers()]);
  return <ScheduleCalendar events={events} members={members} />;
}