"use server";

import { cookies } from "next/headers";

export type BandMember = { id: string; name: string; phone: string; role: string };

export async function getBandMembers(): Promise<{ bandId?: string; members: BandMember[] }> {
  const token = (await cookies()).get("band-manager-access-token")?.value;
  const supabaseUrl = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!token || !supabaseUrl || !secretKey || !publishableKey) return { members: [] };
  const headers = { apikey: secretKey, Authorization: `Bearer ${secretKey}` };
  const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: publishableKey, Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!authResponse.ok) return { members: [] };
  const currentUser = (await authResponse.json().catch(() => null)) as { id?: string } | null;
  if (!currentUser?.id) return { members: [] };
  const ownMembershipResponse = await fetch(`${supabaseUrl}/rest/v1/memberships?select=band_id&user_id=eq.${encodeURIComponent(currentUser.id)}&limit=1`, { headers, cache: "no-store" });
  const ownMemberships = (await ownMembershipResponse.json().catch(() => null)) as { band_id?: string }[] | null;
  const bandId = ownMemberships?.[0]?.band_id;
  if (!bandId) return { members: [] };
  const membershipResponse = await fetch(`${supabaseUrl}/rest/v1/memberships?select=id,role,display_name,phone&band_id=eq.${encodeURIComponent(bandId)}&order=created_at.asc`, { headers, cache: "no-store" });
  if (!membershipResponse.ok) return { bandId, members: [] };
  const memberships = (await membershipResponse.json().catch(() => null)) as { id: string; role: string; display_name?: string | null; phone?: string | null }[] | null;
  return {
    bandId,
    members: (memberships ?? []).map((membership) => ({ id: membership.id, name: membership.display_name || "Unnamed member", phone: membership.phone || "No phone number", role: membership.role })),
  };
}