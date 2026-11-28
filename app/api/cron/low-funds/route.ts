import { sendCronNotification } from "@/lib/notifications/send-notification";

const fmt = (cents: number) =>
  (cents / 100).toLocaleString("en-AU", { style: "currency", currency: "AUD" });

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SECRET_KEY!;

  const res = await fetch(`${url}/rest/v1/rpc/low_balance_members`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ threshold_cents: 1000 }),
    cache: "no-store",
  });
  if (!res.ok) return Response.json({ error: "Query failed." }, { status: 502 });

  const rows = (await res.json()) as { band_id: string; membership_id: string; balance_cents: number }[];

  let sent = 0, failed = 0, expired = 0;
  for (const r of rows) {
    try {
      const out = await sendCronNotification({
        bandId: r.band_id,
        recipientMembershipIds: [r.membership_id],
        notification: {
          title: "Low band balance",
          body: `Your balance is ${fmt(r.balance_cents)}. Please top up when you can.`,
          url: "/", // change to your finance page path
        },
      });
      sent += out.sent; failed += out.failed; expired += out.expired;
    } catch (e) {
      console.error("low-funds notify failed", r.membership_id, e);
      failed += 1;
    }
  }
  return Response.json({ checked: rows.length, sent, failed, expired });
}