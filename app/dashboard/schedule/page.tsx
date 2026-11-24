import ScheduleCalendar from "./schedule-calendar";
import { connection } from "next/server";
import { getScheduleEvents } from "@/lib/backend/schedule";

export const instant = false;

export default async function SchedulePage() {
  await connection();
  return <ScheduleCalendar events={await getScheduleEvents()} />;
}