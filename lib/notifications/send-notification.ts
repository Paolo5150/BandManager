import "server-only";

import * as webPush from "web-push";
import { getBandContext } from "@/lib/backend/band-context";
import { getAccessToken } from "@/lib/backend/session";

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

  return sendToBandMembers(context, input.recipientMembershipIds, input.notification);
}

/** Send an approval reminder only for the caller's newly-created pending invitation membership. */
export async function sendInvitationApprovalReminder(input: {
  bandId: string;
  membershipId: string;
  memberName: string;
}): Promise<SendNotificationResult> {
  const token = await getAccessToken();
  const url = process.env.SUPABASE_URL;
  const publishable = process.env.SUPABASE_PUBLISHABLE_KEY;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!token || !url || !publishable || !secret) throw new Error("A valid signed-in session is required.");
  const authResponse = await fetch(`${url}/auth/v1/user`, { headers: { apikey: publishable, Authorization: `Bearer ${token}` }, cache: "no-store" });
  const authUser = (await authResponse.json().catch(() => null)) as { id?: string } | null;
  if (!authResponse.ok || !authUser?.id) throw new Error("Unable to verify the signed-in user.");
  const headers = { apikey: secret, Authorization: `Bearer ${secret}` };
  const membershipResponse = await fetch(`${url}/rest/v1/memberships?select=id,user_id,band_id,confirmed&id=eq.${encodeURIComponent(input.membershipId)}&band_id=eq.${encodeURIComponent(input.bandId)}&user_id=eq.${encodeURIComponent(authUser.id)}&confirmed=eq.false&limit=1`, { headers, cache: "no-store" });
  const pendingRows = (await membershipResponse.json().catch(() => [])) as { id: string }[];
  if (!membershipResponse.ok || !pendingRows[0]?.id) throw new Error("The invitation membership is not a pending membership for the signed-in user.");
  const adminsResponse = await fetch(`${url}/rest/v1/memberships?select=id&band_id=eq.${encodeURIComponent(input.bandId)}&confirmed=eq.true&role=eq.admin`, { headers, cache: "no-store" });
  const admins = (await adminsResponse.json().catch(() => [])) as { id: string }[];
  if (!adminsResponse.ok) throw new Error("Unable to load band admins for the approval reminder.");
  return sendToBandMembers({ url, headers, bandId: input.bandId }, admins.map((admin) => admin.id), {
    title: `Reminder: ${input.memberName.trim() || "A new member"} is waiting for approval`,
    body: `${input.memberName.trim() || "A new member"} has requested to join your band and is waiting for an admin to approve their membership.`,
    url: "/dashboard/members",
  });
}

async function sendToBandMembers(context: { url: string; headers: Record<string, string>; bandId: string }, requestedRecipientIds: string[], notification: PushNotificationPayload): Promise<SendNotificationResult> {

  const recipientIds = [...new Set(requestedRecipientIds.filter((id) => typeof id === "string" && id.length > 0))];
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
  const payload = JSON.stringify({ title: notification.title.slice(0, 120), body: notification.body.slice(0, 500), url: notificationUrl(notification.url) });
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