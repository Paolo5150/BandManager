import { sendCronNotification } from "@/lib/notifications/send-notification";

type CronNotificationRequest = {
  bandId: string;
  recipientMembershipIds: string[];
  notification: {
    title: string;
    body: string;
    url?: string;
  };
};

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const input = (await request.json().catch(() => null)) as CronNotificationRequest | null;
  if (
    !input ||
    typeof input.bandId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.bandId) ||
    !Array.isArray(input.recipientMembershipIds) || input.recipientMembershipIds.length === 0 || input.recipientMembershipIds.length > 500 ||
    !input.recipientMembershipIds.every((id) => typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) ||
    !input.notification || typeof input.notification.title !== "string" || !input.notification.title.trim() || input.notification.title.length > 120 ||
    typeof input.notification.body !== "string" || !input.notification.body.trim() || input.notification.body.length > 500 ||
    (input.notification.url !== undefined && (typeof input.notification.url !== "string" || !input.notification.url.startsWith("/") || input.notification.url.startsWith("//")))
  ) {
    return Response.json({ error: "Invalid notification request." }, { status: 400 });
  }

  try {
    const result = await sendCronNotification(input);
    return Response.json(result);
  } catch (error) {
    console.error("Cron notification send failed", error);
    return Response.json({ error: error instanceof Error ? error.message : "Unable to send notifications." }, { status: 502 });
  }
}