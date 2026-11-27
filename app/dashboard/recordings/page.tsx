import { connection } from "next/server";
import { getRecordings } from "@/lib/backend/recordings";
import DashboardShell from "../dashboard-shell";
import PageHeader from "../page-header";
import RecordingsClient from "./recordings-client";

export const instant = false;

export default async function RecordingsPage() {
  await connection();
  const { songs, recordings } = await getRecordings();
  return <DashboardShell active="Recordings"><PageHeader eyebrow="Music library" title="Recordings" description="Upload and listen to MP3 recordings of your songs." /><RecordingsClient songs={songs} initialRecordings={recordings} /></DashboardShell>;
}