// Shared session helpers. No "use server" directive: used by proxy.ts and server code.

export const ACCESS_COOKIE = "band-manager-access-token";
export const REFRESH_COOKIE = "band-manager-refresh-token";

export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};

/** True when the JWT is expired (or will be within `skewSeconds`) or can't be read. */
export function isTokenExpired(token: string, skewSeconds = 60): boolean {
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const { exp } = JSON.parse(atob(payload)) as { exp?: number };
    return typeof exp !== "number" || exp * 1000 <= Date.now() + skewSeconds * 1000;
  } catch {
    return true;
  }
}

/** Exchanges a refresh token for a new session. Returns null if Supabase rejects it. */
export async function refreshTokens(refreshToken: string): Promise<{ accessToken: string; refreshToken: string } | null> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  const response = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
    cache: "no-store",
  });
  const body = (await response.json().catch(() => null)) as { access_token?: string; refresh_token?: string } | null;
  if (!response.ok || !body?.access_token) return null;
  return { accessToken: body.access_token, refreshToken: body.refresh_token ?? refreshToken };
}