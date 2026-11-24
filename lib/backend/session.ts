"use server";

import { cookies } from "next/headers";

const accessCookie = "band-manager-access-token";
const refreshCookie = "band-manager-refresh-token";

export async function saveSession(accessToken?: string, refreshToken?: string) {
  const store = await cookies();
  const options = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 };
  if (accessToken) store.set(accessCookie, accessToken, options);
  if (refreshToken) store.set(refreshCookie, refreshToken, options);
}

export async function getAccessToken(): Promise<string | undefined> {
  const store = await cookies();
  const accessToken = store.get(accessCookie)?.value;
  const refreshToken = store.get(refreshCookie)?.value;
  if (accessToken) return accessToken;
  if (!refreshToken || !process.env.SUPABASE_URL || !process.env.SUPABASE_PUBLISHABLE_KEY) return undefined;

  const response = await fetch(`${process.env.SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { apikey: process.env.SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
    cache: "no-store",
  });
  const body = (await response.json().catch(() => null)) as { access_token?: string; refresh_token?: string } | null;
  if (!response.ok || !body?.access_token) return undefined;
  await saveSession(body.access_token, body.refresh_token ?? refreshToken);
  return body.access_token;
}

export async function clearSession() {
  const store = await cookies();
  store.delete(accessCookie);
  store.delete(refreshCookie);
}