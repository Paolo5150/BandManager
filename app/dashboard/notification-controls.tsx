"use client";

import { useEffect, useState } from "react";

function decodeVapidPublicKey(value: string) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

export default function NotificationControls({ vapidPublicKey }: { vapidPublicKey: string }) {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [subscriptionChecked, setSubscriptionChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const available = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setSupported(available);
    if (!available) {
      setSubscriptionChecked(true);
      return;
    }
    navigator.serviceWorker.getRegistration("/").then(async (registration) => {
      const subscription = await registration?.pushManager.getSubscription();
      if (!subscription) {
        setSubscribed(false);
        return;
      }
      const response = await fetch(`/api/notifications/subscribe?endpoint=${encodeURIComponent(subscription.endpoint)}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to check this device subscription.");
      const result = (await response.json()) as { subscribed?: boolean };
      setSubscribed(result.subscribed === true);
    }).catch(() => {
      // If the lookup fails, let the user retry by enabling notifications.
      setSubscribed(false);
    }).finally(() => setSubscriptionChecked(true));
  }, []);

  async function enableNotifications() {
    if (!supported || busy) return;
    setBusy(true); setMessage("");
    try {
      if (!vapidPublicKey) throw new Error("VAPID_PUBLIC_KEY is missing from the server environment.");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error(permission === "denied" ? "Notifications are blocked in browser settings." : "Notification permission was not granted.");
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription() ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeVapidPublicKey(vapidPublicKey) });
      const response = await fetch("/api/notifications/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(subscription.toJSON()) });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error || "Unable to save this device subscription.");
      setSubscribed(true);
      setMessage("Notifications enabled on this device.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to enable notifications.");
    } finally {
      setBusy(false);
    }
  }

  if (!supported) return <p className="mt-4 rounded-xl border border-[#e8e1e9] bg-white px-4 py-3 text-sm text-[#69727d]">Push notifications are not supported by this browser. Try installing/opening BandManager in a supported browser over HTTPS.</p>;

  return <section className="mt-4 rounded-2xl border border-[#e8e1e9] bg-white p-4 shadow-sm sm:flex sm:items-center sm:justify-between sm:gap-4"><div><h2 className="font-semibold text-[#17202a]">Notifications</h2><p className="mt-1 text-xs text-[#69727d]">{subscribed ? "Notifications are enabled on this device." : "Enable push notifications on this device."}</p>{message && <p role="status" className="mt-2 text-xs text-[#a04420]">{message}</p>}</div>{subscriptionChecked && !subscribed && <div className="mt-3 shrink-0 sm:mt-0"><button type="button" onClick={() => void enableNotifications()} disabled={busy} className="min-h-10 rounded-lg bg-[#ff6b35] px-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Enabling..." : "Enable notifications"}</button></div>}</section>;
}