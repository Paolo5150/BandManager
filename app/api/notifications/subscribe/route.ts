import { getBandContext } from "@/lib/backend/band-context";

type PushSubscriptionPayload = {
  endpoint: string;
  expirationTime?: number | null;
  keys: { p256dh: string; auth: string };
};

function isBrowserPushEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint);
    const host = url.hostname.toLowerCase();
    return url.protocol === "https:" && (
      host === "fcm.googleapis.com" || host.endsWith(".push.apple.com") || host.endsWith(".push.services.mozilla.com") || host.endsWith(".notify.windows.com")
    );
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const context = await getBandContext();
  if (!context) return Response.json({ error: "Sign in to check notifications." }, { status: 401 });
  const endpoint = new URL(request.url).searchParams.get("endpoint");
  if (!endpoint || endpoint.length > 4096 || !isBrowserPushEndpoint(endpoint)) {
    return Response.json({ error: "Invalid push subscription endpoint." }, { status: 400 });
  }
  const query = new URLSearchParams({
    select: "id",
    endpoint: `eq.${endpoint}`,
    membership_id: `eq.${context.membershipId}`,
    band_id: `eq.${context.bandId}`,
    enabled: "eq.true",
    limit: "1",
  });
  const response = await fetch(`${context.url}/rest/v1/push_subscriptions?${query}`, { headers: context.headers, cache: "no-store" });
  if (!response.ok) return Response.json({ error: "Unable to check this device subscription." }, { status: 502 });
  const rows = (await response.json().catch(() => [])) as { id?: string }[];
  return Response.json({ subscribed: Boolean(rows[0]?.id) });
}

export async function POST(request: Request) {
  const context = await getBandContext();
  if (!context) return Response.json({ error: "Sign in to enable notifications." }, { status: 401 });
  const payload = (await request.json().catch(() => null)) as PushSubscriptionPayload | null;
  if (!payload || typeof payload.endpoint !== "string" || !isBrowserPushEndpoint(payload.endpoint) || typeof payload.keys?.p256dh !== "string" || typeof payload.keys?.auth !== "string") {
    return Response.json({ error: "Invalid push subscription." }, { status: 400 });
  }
  if (payload.endpoint.length > 4096 || payload.keys.p256dh.length > 512 || payload.keys.auth.length > 512) {
    return Response.json({ error: "Push subscription is too large." }, { status: 400 });
  }
  const response = await fetch(`${context.url}/rest/v1/push_subscriptions?on_conflict=endpoint`, {
    method: "POST",
    headers: { ...context.headers, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ endpoint: payload.endpoint, membership_id: context.membershipId, band_id: context.bandId, subscription: payload, enabled: true, updated_at: new Date().toISOString() }),
    cache: "no-store",
  });
  if (!response.ok) return Response.json({ error: "Unable to save this device subscription." }, { status: 502 });
  return Response.json({ ok: true, storage: "supabase" }, { status: 201 });
}