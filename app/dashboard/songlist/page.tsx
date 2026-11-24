import { connection } from "next/server";
import { getScheduleAccess } from "@/lib/backend/schedule";
import { getSongs } from "@/lib/backend/songs";
import DashboardShell from "../dashboard-shell";
import SonglistClient from "./songlist-client";

export const instant = false;

export default async function SonglistPage() {
  await connection();
  const [songs, isAdmin] = await Promise.all([getSongs(), getScheduleAccess()]);
  return <DashboardShell active="Songlist"><SonglistClient initialSongs={songs} isAdmin={isAdmin} /></DashboardShell>;
}