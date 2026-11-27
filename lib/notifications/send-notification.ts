import "server-only";

import * as webPush from "web-push";
import { getBandContext } from "@/lib/backend/band-context";

export type PushNotificationPayload = {
  title: string;
  body: string;
  /** App-relative path only, for example `/dashboard/schedule`. */
  url?: string;
};

export type SendNotificationResult = {
  sent: number;
  failed: number;
  expired: number;
};

type StoredSubscription = {
  id: string;
  membership_id: string;
  subscription: webPush.PushSubscription;
};

let configuredVapidPair = "";

function notificationUrl(value?: string) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

function configureVapid() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) throw new Error("VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be configured.");
  const pair = `${publicKey}:${privateKey}`;
  if (configuredVapidPair !== pair) {
    webPush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:notifications@bandmanager.app", publicKey, privateKey);
    configuredVapidPair = pair;
  }
}

/**
 * Sends a push notification to selected confirmed members of the caller's band.
 * Admin-only by design: the calling server action should still enforce its own
 * feature-specific authorization before calling this helper.
 */
export async function sendNotification(input: {
  recipientMembershipIds: string[];
  notification: PushNotificationPayload;
}): Promise<SendNotificationResult> {
  const context = await getBandContext();
  if (!context) throw new Error("You must be a confirmed band member to send notifications.");
  if (!context.isAdmin) throw new Error("Only band admins can send notifications.");

  const recipientIds = [...new Set(input.recipientMembershipIds.filter((id) => typeof id === "string" && id.length > 0))];
  if (!recipientIds.length) return { sent: 0, failed: 0, expired: 0 };
  if (recipientIds.length > 500) throw new Error("A notification can target at most 500 members at a time.");

  const membershipQuery = recipientIds.map(encodeURIComponent).join(",");
  const membershipResponse = await fetch(`${context.url}/rest/v1/memberships?select=id&band_id=eq.${encodeURIComponent(context.bandId)}&confirmed=eq.true&id=in.(${membershipQuery})`, { headers: context.headers, cache: "no-store" });
  const members = (await membershipResponse.json().catch(() => [])) as { id: string }[];
  if (!membershipResponse.ok) throw new Error("Unable to validate notification recipients.");
  if (members.length !== recipientIds.length) throw new Error("All notification recipients must be confirmed members of your band.");

  const subscriptionsResponse = await fetch(`${context.url}/rest/v1/push_subscriptions?select=id,membership_id,subscription&band_id=eq.${encodeURIComponent(context.bandId)}&membership_id=in.(${membershipQuery})`, { headers: context.headers, cache: "no-store" });
  const subscriptions = (await subscriptionsResponse.json().catch(() => [])) as StoredSubscription[];
  if (!subscriptionsResponse.ok) throw new Error("Unable to load push subscriptions.");
  if (!subscriptions.length) return { sent: 0, failed: 0, expired: 0 };

  configureVapid();
  const payload = JSON.stringify({ title: input.notification.title.slice(0, 120), body: input.notification.body.slice(0, 500), url: notificationUrl(input.notification.url) });
  const outcomes = await Promise.all(subscriptions.map(async (entry) => {
    try {
      await webPush.sendNotification(entry.subscription, payload);
      return { sent: 1, failed: 0, expiredId: null as string | null };
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      return { sent: 0, failed: 1, expiredId: status === 404 || status === 410 ? entry.id : null };
    }
  }));

  const expiredIds = outcomes.flatMap((result) => result.expiredId ? [result.expiredId] : []);
  if (expiredIds.length) {
    const cleanup = await fetch(`${context.url}/rest/v1/push_subscriptions?id=in.(${expiredIds.map(encodeURIComponent).join(",")})&band_id=eq.${encodeURIComponent(context.bandId)}`, { method: "DELETE", headers: context.headers, cache: "no-store" });
    if (!cleanup.ok) console.error("Could not remove expired push subscriptions", await cleanup.text().catch(() => ""));
  }

  return {
    sent: outcomes.reduce((sum, result) => sum + result.sent, 0),
    failed: outcomes.reduce((sum, result) => sum + result.failed, 0),
    expired: expiredIds.length,
  };
}