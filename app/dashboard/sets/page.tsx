import { connection } from "next/server";
import { getScheduleAccess } from "@/lib/backend/schedule";
import { getSongs } from "@/lib/backend/songs";
import { getSets } from "@/lib/backend/sets";
import DashboardShell from "../dashboard-shell";
import SetsClient from "./sets-client";

export const instant = false;

export default async function SetsPage() {
  await connection();
  const [sets, songs, isAdmin] = await Promise.all([getSets(), getSongs(), getScheduleAccess()]);
  return <DashboardShell active="Sets"><SetsClient initialSets={sets} songs={songs} isAdmin={isAdmin} /></DashboardShell>;
}