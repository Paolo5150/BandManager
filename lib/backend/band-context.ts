import "server-only";

import { getAccessToken } from "@/lib/backend/session";

export async function getBandContext() {
  const token = await getAccessToken(); const url = process.env.SUPABASE_URL; const secret = process.env.SUPABASE_SECRET_KEY; const publishable = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!token || !url || !secret || !publishable) return null;
  const auth = await fetch(`${url}/auth/v1/user`, { headers: { apikey: publishable, Authorization: `Bearer ${token}` }, cache: "no-store" });
  const user = (await auth.json().catch(() => null)) as { id?: string } | null;
  if (!auth.ok || !user?.id) return null;
  const headers = { apikey: secret, Authorization: `Bearer ${secret}` };
  const membership = await fetch(`${url}/rest/v1/memberships?select=band_id,role&user_id=eq.${encodeURIComponent(user.id)}&confirmed=eq.true&limit=1`, { headers, cache: "no-store" });
  const rows = (await membership.json().catch(() => [])) as { band_id?: string; role?: string }[];
  return membership.ok && rows[0]?.band_id ? { url, headers, bandId: rows[0].band_id, userId: user.id, isAdmin: rows[0].role === "admin" } : null;
}
