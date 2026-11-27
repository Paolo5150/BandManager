"use client";

import { useState } from "react";
import { sendScheduleReminder } from "@/lib/backend/schedule";
import LoadingSpinner from "./loading-spinner";

export default function SendUpcomingReminderButton({ eventId }: { eventId: string }) {
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");

  async function sendReminder() {
    if (sending) return;
    setSending(true);
    setMessage("");
    try {
      const result = await sendScheduleReminder(eventId);
      setMessage(result.error || result.warning || `Reminder sent to ${result.sent ?? 0} device${result.sent === 1 ? "" : "s"}.`);
    } catch {
      setMessage("Unable to send the reminder right now.");
    } finally {
      setSending(false);
    }
  }

  return <div className="mt-4"><button type="button" onClick={() => void sendReminder()} disabled={sending} className="flex min-h-10 items-center justify-center rounded-lg border border-[#f0d4c5] bg-[#fff8f3] px-3 text-sm font-semibold text-[#a04420] disabled:cursor-not-allowed disabled:opacity-50">{sending ? <LoadingSpinner label="Sending reminder..." /> : "Send reminder"}</button>{message && <p role="status" className="mt-2 text-xs text-[#a04420]">{message}</p>}</div>;
}