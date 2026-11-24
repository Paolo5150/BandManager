import { connection } from "next/server";
import DashboardShell from "../dashboard-shell";
import PageHeader from "../page-header";
import { getUnavailability } from "@/lib/backend/unavailability";
import UnavailabilityCalendar from "./unavailability-calendar";

export const instant = false;

export default async function UnavailabilityPage() {
  await connection();
  const entries = await getUnavailability();
  return <DashboardShell active="Unavailable"><PageHeader eyebrow="Schedule" title="Unavailability" description="Tell the band when you are not available." /><UnavailabilityCalendar initialEntries={entries} /></DashboardShell>;
}