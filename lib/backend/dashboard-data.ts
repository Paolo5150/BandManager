"use server";

import { clearSession, getAccessToken } from "@/lib/backend/session";
import { redirect } from "next/navigation";

type DashboardData = {
  userName: string;
  bandName: string;
};

export async function logout(): Promise<void> {
  await clearSession();
  redirect("/");
}

export async function getDashboardData(): Promise<DashboardData> {
  const token = await getAccessToken();
  const supabaseUrl = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !secretKey) {
    return { userName: "Band member", bandName: "Your band" };
  }
  // Not signed in (or session expired): go to login, not "waiting for confirmation".
  if (!token) redirect("/");

  const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: process.env.SUPABASE_PUBLISHABLE_KEY ?? secretKey,
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });
  const authUser = (await authResponse.json().catch(() => null)) as
    | { id?: string; user_metadata?: { name?: string } }
    | null;
  if (!authResponse.ok || !authUser?.id) redirect("/");

  // Prefer a confirmed membership if the user has more than one.
  const membershipResponse = await fetch(
    `${supabaseUrl}/rest/v1/memberships?select=confirmed,bands(name)&user_id=eq.${encodeURIComponent(authUser.id)}&order=confirmed.desc.nullslast&limit=1`,
    {
      headers: {
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`,
      },
      cache: "no-store",
    },
  );
  if (!membershipResponse.ok) {
    throw new Error("Unable to load your band membership.");
  }

  const memberships = (await membershipResponse.json().catch(() => null)) as
    | { bands?: { name?: string } | null; confirmed?: boolean | string }[]
    | null;

  const confirmed = memberships?.[0]?.confirmed === true || memberships?.[0]?.confirmed === "true";
  if (!memberships?.[0] || !confirmed) {
    redirect("/pending-confirmation");
  }

  return {
    userName: authUser?.user_metadata?.name || "Band member",
    bandName: memberships?.[0]?.bands?.name || "Your band",
  };
}