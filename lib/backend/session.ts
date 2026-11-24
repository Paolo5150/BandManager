"use server";

import { cookies } from "next/headers";
import { ACCESS_COOKIE, REFRESH_COOKIE, cookieOptions, isTokenExpired, refreshTokens } from "@/lib/backend/auth-tokens";

export async function saveSession(accessToken?: string, refreshToken?: string) {
  const store = await cookies();
  if (accessToken) store.set(ACCESS_COOKIE, accessToken, cookieOptions);
  if (refreshToken) store.set(REFRESH_COOKIE, refreshToken, cookieOptions);
}

export async function getAccessToken(): Promise<string | undefined> {
  const store = await cookies();
  const accessToken = store.get(ACCESS_COOKIE)?.value;
  // Only trust the token while it is still valid (the cookie outlives the JWT).
  if (accessToken && !isTokenExpired(accessToken, 0)) return accessToken;

  const refreshToken = store.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) return undefined;
  const tokens = await refreshTokens(refreshToken);
  if (!tokens) return undefined;
  try {
    await saveSession(tokens.accessToken, tokens.refreshToken);
  } catch {
    // Cookies can't be written while a page renders; proxy.ts handles that case.
  }
  return tokens.accessToken;
}

export async function clearSession() {
  const store = await cookies();
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
}