"use server";

import { cookies } from "next/headers";

type LoginResult = {
  error?: string;
  userId?: string;
  hasBand?: boolean;
  displayName?: string;
  confirmed?: boolean;
};

export async function login(
  phone: string,
  password: string,
): Promise<LoginResult> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !publishableKey || !secretKey) {
    return { error: "Supabase is not configured on the server." };
  }

  const authResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: publishableKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ phone, password }),
    cache: "no-store",
  });

  const authBody = (await authResponse.json().catch(() => null)) as
    | { user?: { id?: string; user_metadata?: { name?: string } }; access_token?: string; msg?: string; error_description?: string }
    | null;

  if (!authResponse.ok || !authBody?.user?.id) {
    return {
      error:
        authBody?.msg ??
        authBody?.error_description ??
        "Unable to log in with those credentials.",
    };
  }

  if (authBody.access_token) {
    (await cookies()).set("band-manager-access-token", authBody.access_token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
  }

  const membershipResponse = await fetch(
    `${supabaseUrl}/rest/v1/memberships?select=id,confirmed&user_id=eq.${encodeURIComponent(authBody.user.id)}&limit=1`,
    {
      headers: {
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`,
      },
      cache: "no-store",
    },
  );

  if (!membershipResponse.ok) {
    return { error: "Logged in, but we could not check your band membership." };
  }

  const memberships = (await membershipResponse.json().catch(() => null)) as
    | { id: string; confirmed?: boolean }[]
    | null;

  return {
    userId: authBody.user.id,
    hasBand: Boolean(memberships?.length),
    displayName: authBody.user.user_metadata?.name ?? "",
    confirmed: memberships?.[0]?.confirmed ?? false,
  };
}