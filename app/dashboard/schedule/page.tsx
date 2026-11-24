import ScheduleCalendar from "./schedule-calendar";
import { connection } from "next/server";
import { getScheduleEvents, getScheduleMembers, getScheduleAccess, getWaitingConfirmations } from "@/lib/backend/schedule";

export const instant = false;

export default async function SchedulePage() {
  await connection();
  const [events, members, isAdmin, waitingConfirmations] = await Promise.all([getScheduleEvents(), getScheduleMembers(), getScheduleAccess(), getWaitingConfirmations()]);
  return <ScheduleCalendar events={events} members={members} isAdmin={isAdmin} waitingConfirmations={waitingConfirmations} />;
}