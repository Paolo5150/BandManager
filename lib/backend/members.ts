"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

export type BandMember = { id: string; userId: string; name: string; phone: string; role: string };
export type PendingMember = BandMember;

export async function confirmMember(formData: FormData): Promise<void> {
  const token = (await cookies()).get("band-manager-access-token")?.value;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  const secret = process.env.SUPABASE_SECRET_KEY;
  const id = String(formData.get("membershipId") ?? "");
  if (!token || !url || !key || !secret || !id) return;
  const userResponse = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${token}` }, cache: "no-store" });
  const user = (await userResponse.json().catch(() => null)) as { id?: string } | null;
  if (!user?.id) return;
  const headers = { apikey: secret, Authorization: `Bearer ${secret}` };
  const ownResponse = await fetch(`${url}/rest/v1/memberships?select=band_id,confirmed&user_id=eq.${encodeURIComponent(user.id)}&limit=1`, { headers, cache: "no-store" });
  const own = (await ownResponse.json().catch(() => null)) as { band_id?: string; confirmed?: boolean }[] | null;
  if (!own?.[0]?.band_id || own[0].confirmed === false) return;
  await fetch(`${url}/rest/v1/memberships?id=eq.${encodeURIComponent(id)}&band_id=eq.${encodeURIComponent(own[0].band_id)}&confirmed=eq.false`, { method: "PATCH", headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ confirmed: true }), cache: "no-store" });
  revalidatePath("/dashboard/members");
}

export async function declineMember(formData: FormData): Promise<void> {
  const token = (await cookies()).get("band-manager-access-token")?.value;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  const secret = process.env.SUPABASE_SECRET_KEY;
  const id = String(formData.get("membershipId") ?? "");
  if (!token || !url || !key || !secret || !id) return;

  const userResponse = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: key, Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const user = (await userResponse.json().catch(() => null)) as { id?: string } | null;
  if (!user?.id) return;

  const headers = { apikey: secret, Authorization: `Bearer ${secret}` };
  const ownResponse = await fetch(
    `${url}/rest/v1/memberships?select=band_id,confirmed&user_id=eq.${encodeURIComponent(user.id)}&limit=1`,
    { headers, cache: "no-store" },
  );
  const own = (await ownResponse.json().catch(() => null)) as
    | { band_id?: string; confirmed?: boolean }[]
    | null;
  if (!own?.[0]?.band_id || own[0].confirmed === false) return;

  const deleteResponse = await fetch(
    `${url}/rest/v1/memberships?id=eq.${encodeURIComponent(id)}&band_id=eq.${encodeURIComponent(own[0].band_id)}&confirmed=eq.false`,
    { method: "DELETE", headers: { ...headers, Prefer: "return=minimal" }, cache: "no-store" },
  );
  if (deleteResponse.ok) revalidatePath("/dashboard/members");
}

export async function removeMember(formData: FormData): Promise<void> {
  const token = (await cookies()).get("band-manager-access-token")?.value;
  const supabaseUrl = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  const membershipId = String(formData.get("membershipId") ?? "");

  if (!token || !supabaseUrl || !publishableKey || !membershipId) return;

  await fetch(`${supabaseUrl}/rest/v1/rpc/remove_band_member`, {
    method: "POST",
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ target_membership_id: membershipId }),
    cache: "no-store",
  });

  revalidatePath("/dashboard/members");
}

export async function getBandMembers(): Promise<{ bandId?: string; members: BandMember[]; pendingMembers: PendingMember[]; isAdmin: boolean }> {
  const token = (await cookies()).get("band-manager-access-token")?.value;
  const supabaseUrl = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!token || !supabaseUrl || !secretKey || !publishableKey) return { members: [], pendingMembers: [], isAdmin: false };
  const headers = { apikey: secretKey, Authorization: `Bearer ${secretKey}` };
  const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: publishableKey, Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!authResponse.ok) return { members: [], pendingMembers: [], isAdmin: false };
  const currentUser = (await authResponse.json().catch(() => null)) as { id?: string } | null;
  if (!currentUser?.id) return { members: [], pendingMembers: [], isAdmin: false };
  const ownMembershipResponse = await fetch(`${supabaseUrl}/rest/v1/memberships?select=band_id,role,confirmed&user_id=eq.${encodeURIComponent(currentUser.id)}&limit=1`, { headers, cache: "no-store" });
  const ownMemberships = (await ownMembershipResponse.json().catch(() => null)) as { band_id?: string; role?: string; confirmed?: boolean }[] | null;
  const bandId = ownMemberships?.[0]?.band_id;
  const isAdmin = ownMemberships?.[0]?.role === "admin";
  if (!bandId) return { members: [], pendingMembers: [], isAdmin };
  const membershipResponse = await fetch(`${supabaseUrl}/rest/v1/memberships?select=id,user_id,role,display_name,phone,confirmed&band_id=eq.${encodeURIComponent(bandId)}&order=created_at.asc`, { headers, cache: "no-store" });
  if (!membershipResponse.ok) return { bandId, members: [], pendingMembers: [], isAdmin };
  const memberships = (await membershipResponse.json().catch(() => null)) as { id: string; user_id: string; role: string; display_name?: string | null; phone?: string | null; confirmed?: boolean }[] | null;
  const toMember = (membership: NonNullable<typeof memberships>[number]) => ({ id: membership.id, userId: membership.user_id, name: membership.display_name || "Unnamed member", phone: membership.phone || "No phone number", role: membership.role });
  const uniquePending = new Map<string, NonNullable<typeof memberships>[number]>();
  for (const membership of memberships ?? []) {
    if (membership.confirmed === false && !uniquePending.has(membership.user_id)) uniquePending.set(membership.user_id, membership);
  }
  return {
    bandId,
    members: (memberships ?? []).filter((membership) => membership.confirmed !== false).map(toMember),
    pendingMembers: [...uniquePending.values()].map(toMember),
    isAdmin,
  };
}