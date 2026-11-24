"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

type DashboardData = {
  userName: string;
  bandName: string;
};

export async function logout(): Promise<void> {
  (await cookies()).delete("band-manager-access-token");
  redirect("/");
}

export async function getDashboardData(): Promise<DashboardData> {
  const token = (await cookies()).get("band-manager-access-token")?.value;
  const supabaseUrl = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!token || !supabaseUrl || !secretKey) {
    return { userName: "Band member", bandName: "Your band" };
  }

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

  const membershipResponse = await fetch(
    `${supabaseUrl}/rest/v1/memberships?select=bands(name)&user_id=eq.${encodeURIComponent(authUser?.id ?? "")}&limit=1`,
    {
      headers: {
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`,
      },
      cache: "no-store",
    },
  );
  const memberships = (await membershipResponse.json().catch(() => null)) as
    | { bands?: { name?: string } | null }[]
    | null;

  return {
    userName: authUser?.user_metadata?.name || "Band member",
    bandName: memberships?.[0]?.bands?.name || "Your band",
  };
}