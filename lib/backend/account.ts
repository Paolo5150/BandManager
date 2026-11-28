"use server";

import { revalidatePath } from "next/cache";
import { getAccessToken } from "@/lib/backend/session";

export type AccountDetails = { name: string; phone: string };

async function getAuthUser() {
  const token = await getAccessToken();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!token || !url || !key) return null;
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: key, Authorization: `Bearer ${token}` }, cache: "no-store",
  });
  if (!response.ok) return null;
  return await response.json() as { id?: string; phone?: string; user_metadata?: { name?: string } };
}

export async function getAccountDetails(): Promise<AccountDetails> {
  const user = await getAuthUser();
  if (!user?.id) return { name: "", phone: "" };
  return { name: user.user_metadata?.name ?? "", phone: user.phone ?? "" };
}

export async function updateAccountName(name: string): Promise<{ error?: string }> {
  const trimmedName = name.trim();
  if (!trimmedName || trimmedName.length > 100) return { error: "Enter a name between 1 and 100 characters." };
  const token = await getAccessToken();
  const url = process.env.SUPABASE_URL;
  const authKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!token || !url || !authKey) return { error: "Your session has expired. Please sign in again." };

  // Resolve the account ID from the verified session; never accept a user ID from the client.
  const userResponse = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: authKey, Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const user = await userResponse.json().catch(() => null) as { id?: string } | null;
  if (!userResponse.ok || !user?.id) return { error: "Your session has expired. Please sign in again." };

  const response = await fetch(`${url}/auth/v1/user`, {
    method: "PUT",
    headers: { apikey: authKey, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ data: { name: trimmedName } }),
    cache: "no-store",
  });
  if (!response.ok) return { error: "Unable to update your name. Please try again." };

  // Keep the name shown to band members in sync for every band the user belongs to.
  if (!secretKey) return { error: "Your account name was updated, but membership names could not be synced. Please contact support." };
  const membershipResponse = await fetch(
    `${url}/rest/v1/memberships?user_id=eq.${encodeURIComponent(user.id)}`,
    {
      method: "PATCH",
      headers: {
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ display_name: trimmedName }),
      cache: "no-store",
    },
  );
  if (!membershipResponse.ok) {
    return { error: "Your account name was updated, but membership names could not be synced. Please try again." };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/account");
  return {};
}