"use server";

import { getAccessToken } from "@/lib/backend/session";
import { revalidatePath } from "next/cache";
import { sendMemberFinanceNotification } from "@/lib/notifications/send-notification";

export type MemberBalance = { membershipId: string; name: string; balanceCents: number };
export type LedgerTransaction = { id: string; memberName?: string | null; kind: string; amountCents: number; note?: string | null; createdAt: string; eventName?: string | null; eventDate?: string | null };

export async function addFunds(formData: FormData): Promise<{ error?: string; notificationWarning?: string }> {
  const token = await getAccessToken();
  const url = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  const publishable = process.env.SUPABASE_PUBLISHABLE_KEY;
  const membershipId = String(formData.get("membershipId") ?? "");
  const amountCents = Math.round((Number(formData.get("amount") ?? 0) || 0) * 100);
  const note = String(formData.get("note") ?? "").trim() || null;
  if (!token || !url || !secret || !publishable || !membershipId || amountCents <= 0) return { error: "Enter a positive amount to add funds." };
  const auth = await fetch(`${url}/auth/v1/user`, { headers: { apikey: publishable, Authorization: `Bearer ${token}` }, cache: "no-store" });
  const user = (await auth.json().catch(() => null)) as { id?: string } | null;
  if (!auth.ok || !user?.id) return { error: "You must be signed in." };
  const headers = { apikey: secret, Authorization: `Bearer ${secret}` };
  const ownResponse = await fetch(`${url}/rest/v1/memberships?select=id,band_id,role&user_id=eq.${encodeURIComponent(user.id)}&confirmed=eq.true&limit=1`, { headers, cache: "no-store" });
  const own = (await ownResponse.json().catch(() => null)) as { id?: string; band_id?: string; role?: string }[] | null;
  if (!own?.[0]?.band_id || !["admin", "financial_admin"].includes(own[0].role ?? "")) return { error: "Only admins or financial admins can add funds." };
  const targetResponse = await fetch(`${url}/rest/v1/memberships?select=id,display_name&band_id=eq.${encodeURIComponent(own[0].band_id)}&id=eq.${encodeURIComponent(membershipId)}&confirmed=eq.true&limit=1`, { headers, cache: "no-store" });
  const target = (await targetResponse.json().catch(() => null)) as { id?: string; display_name?: string | null }[] | null;
  if (!target?.[0]?.id) return { error: "Member not found in your band." };
  const response = await fetch(`${url}/rest/v1/member_ledger`, { method: "POST", headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ band_id: own[0].band_id, membership_id: membershipId, member_name: target[0].display_name, kind: "deposit", amount_cents: amountCents, note, created_by: user.id, added_by: own[0].id }), cache: "no-store" });
  if (!response.ok) return { error: "Unable to add funds." };
  revalidatePath("/dashboard/finance");
  try {
    const notification = await sendMemberFinanceNotification({ membershipId, notification: { title: "Funds added to your band balance", body: `$${(amountCents / 100).toFixed(2)} was added to your balance.${note ? ` Note: ${note}` : ""}`, url: "/dashboard/finance" } });
    if (!notification.sent) return { notificationWarning: "Funds were added, but the member has no active push subscription." };
    if (notification.failed) return { notificationWarning: "Funds were added, but some member devices could not be notified." };
  } catch {
    return { notificationWarning: "Funds were added, but the member could not be notified." };
  }
  return {};
}

export async function addBalanceAdjustment(formData: FormData): Promise<{ error?: string; notificationWarning?: string }> {
  const token = await getAccessToken();
  const url = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  const publishable = process.env.SUPABASE_PUBLISHABLE_KEY;
  const membershipId = String(formData.get("membershipId") ?? "");
  const amountCents = Math.round((Number(formData.get("amount") ?? 0) || 0) * 100);
  const note = String(formData.get("note") ?? "").trim() || null;
  if (!token || !url || !secret || !publishable || !membershipId || amountCents === 0) return { error: "Enter a non-zero adjustment amount." };
  const auth = await fetch(`${url}/auth/v1/user`, { headers: { apikey: publishable, Authorization: `Bearer ${token}` }, cache: "no-store" });
  const user = (await auth.json().catch(() => null)) as { id?: string } | null;
  if (!auth.ok || !user?.id) return { error: "You must be signed in." };
  const headers = { apikey: secret, Authorization: `Bearer ${secret}` };
  const ownResponse = await fetch(`${url}/rest/v1/memberships?select=id,band_id,role&user_id=eq.${encodeURIComponent(user.id)}&confirmed=eq.true&limit=1`, { headers, cache: "no-store" });
  const own = (await ownResponse.json().catch(() => null)) as { id?: string; band_id?: string; role?: string }[] | null;
  if (!own?.[0]?.band_id || own[0].role !== "admin") return { error: "Only admins can adjust member balances." };
  const targetResponse = await fetch(`${url}/rest/v1/memberships?select=id,display_name&band_id=eq.${encodeURIComponent(own[0].band_id)}&id=eq.${encodeURIComponent(membershipId)}&confirmed=eq.true&limit=1`, { headers, cache: "no-store" });
  const target = (await targetResponse.json().catch(() => null)) as { id?: string; display_name?: string | null }[] | null;
  if (!target?.[0]?.id) return { error: "Member not found in your band." };
  const response = await fetch(`${url}/rest/v1/member_ledger`, { method: "POST", headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ band_id: own[0].band_id, membership_id: membershipId, member_name: target[0].display_name, kind: "adjustment", amount_cents: amountCents, note, created_by: user.id, added_by: own[0].id }), cache: "no-store" });
  if (!response.ok) return { error: "Unable to save the balance adjustment." };
  revalidatePath("/dashboard/finance");
  try {
    const direction = amountCents > 0 ? "increased" : "decreased";
    const notification = await sendMemberFinanceNotification({ membershipId, notification: { title: "Your band balance was adjusted", body: `Your balance was ${direction} by $${(Math.abs(amountCents) / 100).toFixed(2)}.${note ? ` Note: ${note}` : ""}`, url: "/dashboard/finance" } });
    if (!notification.sent) return { notificationWarning: "The balance was adjusted, but the member has no active push subscription." };
    if (notification.failed) return { notificationWarning: "The balance was adjusted, but some member devices could not be notified." };
  } catch {
    return { notificationWarning: "The balance was adjusted, but the member could not be notified." };
  }
  return {};
}

export async function getMemberBalances(): Promise<{ balances: MemberBalance[]; isAdmin: boolean }> {
  const token = await getAccessToken();
  const url = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  const publishable = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!token || !url || !secret || !publishable) return { balances: [], isAdmin: false };
  const authResponse = await fetch(`${url}/auth/v1/user`, { headers: { apikey: publishable, Authorization: `Bearer ${token}` }, cache: "no-store" });
  const user = (await authResponse.json().catch(() => null)) as { id?: string } | null;
  if (!authResponse.ok || !user?.id) return { balances: [], isAdmin: false };
  const headers = { apikey: secret, Authorization: `Bearer ${secret}` };
  const ownResponse = await fetch(`${url}/rest/v1/memberships?select=id,band_id,role&user_id=eq.${encodeURIComponent(user.id)}&confirmed=eq.true&limit=1`, { headers, cache: "no-store" });
  const own = (await ownResponse.json().catch(() => null)) as { id?: string; band_id?: string; role?: string }[] | null;
  if (!own?.[0]?.id || !own[0].band_id) return { balances: [], isAdmin: false };
  const isAdmin = own[0].role === "admin";
  const membershipsResponse = await fetch(`${url}/rest/v1/memberships?select=id,display_name&band_id=eq.${encodeURIComponent(own[0].band_id)}&confirmed=eq.true&order=display_name.asc`, { headers, cache: "no-store" });
  const memberships = (await membershipsResponse.json().catch(() => [])) as { id: string; display_name?: string | null }[];
  const balancesResponse = await fetch(`${url}/rest/v1/member_balances?select=membership_id,balance_cents&band_id=eq.${encodeURIComponent(own[0].band_id)}`, { headers, cache: "no-store" });
  const balanceRows = (await balancesResponse.json().catch(() => [])) as { membership_id: string; balance_cents?: number | string | null }[];
  const balanceByMembership = new Map(balanceRows.map((row) => [row.membership_id, Number(row.balance_cents ?? 0)]));
  const visible = isAdmin ? memberships : memberships.filter((membership) => membership.id === own[0].id);
  return { isAdmin, balances: visible.map((membership) => ({ membershipId: membership.id, name: membership.display_name || "Unnamed member", balanceCents: balanceByMembership.get(membership.id) ?? 0 })) };
}

export async function getMemberTransactions(): Promise<LedgerTransaction[]> {
  const token = await getAccessToken(); const url = process.env.SUPABASE_URL; const secret = process.env.SUPABASE_SECRET_KEY; const publishable = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!token || !url || !secret || !publishable) return [];
  const auth = await fetch(`${url}/auth/v1/user`, { headers: { apikey: publishable, Authorization: `Bearer ${token}` }, cache: "no-store" });
  const user = (await auth.json().catch(() => null)) as { id?: string } | null;
  if (!auth.ok || !user?.id) return [];
  const headers = { apikey: secret, Authorization: `Bearer ${secret}` };
  const ownResponse = await fetch(`${url}/rest/v1/memberships?select=id,band_id,role&user_id=eq.${encodeURIComponent(user.id)}&confirmed=eq.true&limit=1`, { headers, cache: "no-store" });
  const own = (await ownResponse.json().catch(() => null)) as { id?: string; band_id?: string; role?: string }[] | null;
  if (!own?.[0]?.id || !own[0].band_id) return [];
  const filter = own[0].role === "admin" ? `band_id=eq.${encodeURIComponent(own[0].band_id)}` : `band_id=eq.${encodeURIComponent(own[0].band_id)}&membership_id=eq.${encodeURIComponent(own[0].id)}`;
  const response = await fetch(`${url}/rest/v1/member_ledger?select=id,member_name,kind,amount_cents,note,created_at,event_charge_id&${filter}&order=created_at.desc`, { headers, cache: "no-store" });
  const rows = (await response.json().catch(() => [])) as { id: string; member_name?: string | null; kind: string; amount_cents: number; note?: string | null; created_at: string; event_charge_id?: string | null }[];
  if (!response.ok) return [];
  const chargeIds = rows.map((row) => row.event_charge_id).filter((id): id is string => Boolean(id));
  const eventNames = new Map<string, string>();
  const rowEventDates = new Map<string, string | null>();
  if (chargeIds.length) {
    const chargesResponse = await fetch(`${url}/rest/v1/event_charges?select=id,event_id&band_id=eq.${encodeURIComponent(own[0].band_id)}&id=in.(${chargeIds.map(encodeURIComponent).join(",")})`, { headers, cache: "no-store" });
    const charges = (await chargesResponse.json().catch(() => [])) as { id: string; event_id: string }[];
    const eventIds = charges.map((charge) => charge.event_id).filter(Boolean);
    if (chargesResponse.ok && eventIds.length) {
      const eventsResponse = await fetch(`${url}/rest/v1/events?select=id,title,starts_at&band_id=eq.${encodeURIComponent(own[0].band_id)}&id=in.(${eventIds.map(encodeURIComponent).join(",")})`, { headers, cache: "no-store" });
      const events = (await eventsResponse.json().catch(() => [])) as { id: string; title: string; starts_at: string }[];
      const titles = new Map(events.map((event) => [event.id, event.title]));
      const dates = new Map(events.map((event) => [event.id, event.starts_at]));
      charges.forEach((charge) => {
        const title = titles.get(charge.event_id);
        if (title) eventNames.set(charge.id, title);
      });
      rows.forEach((row) => { if (row.event_charge_id) { const charge = charges.find((item) => item.id === row.event_charge_id); if (charge) rowEventDates.set(row.event_charge_id, dates.get(charge.event_id) ?? null); } });
    }
  }
  return rows.map((row) => ({ id: row.id, memberName: row.member_name, kind: row.kind, amountCents: row.amount_cents, note: row.note, createdAt: row.created_at, eventName: row.event_charge_id ? eventNames.get(row.event_charge_id) : undefined, eventDate: row.event_charge_id ? rowEventDates.get(row.event_charge_id) : undefined }));
}

export async function getTransactionsForMembership(membershipId: string): Promise<LedgerTransaction[]> {
  const token = await getAccessToken(); const url = process.env.SUPABASE_URL; const secret = process.env.SUPABASE_SECRET_KEY; const publishable = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!token || !url || !secret || !publishable || !membershipId) return [];
  const auth = await fetch(`${url}/auth/v1/user`, { headers: { apikey: publishable, Authorization: `Bearer ${token}` }, cache: "no-store" });
  const user = (await auth.json().catch(() => null)) as { id?: string } | null;
  if (!auth.ok || !user?.id) return [];
  const headers = { apikey: secret, Authorization: `Bearer ${secret}` };
  const ownResponse = await fetch(`${url}/rest/v1/memberships?select=id,band_id,role&user_id=eq.${encodeURIComponent(user.id)}&confirmed=eq.true&limit=1`, { headers, cache: "no-store" });
  const own = (await ownResponse.json().catch(() => null)) as { id?: string; band_id?: string; role?: string }[] | null;
  if (!own?.[0]?.id || !own[0].band_id) return [];
  const allowed = own[0].role === "admin" || own[0].id === membershipId;
  if (!allowed) return [];
  const response = await fetch(`${url}/rest/v1/member_ledger?select=id,member_name,kind,amount_cents,note,created_at,event_charge_id&band_id=eq.${encodeURIComponent(own[0].band_id)}&membership_id=eq.${encodeURIComponent(membershipId)}&order=created_at.desc`, { headers, cache: "no-store" });
  const rows = (await response.json().catch(() => [])) as { id: string; member_name?: string | null; kind: string; amount_cents: number; note?: string | null; created_at: string; event_charge_id?: string | null }[];
  if (!response.ok) return [];
  const chargeIds = rows.map((row) => row.event_charge_id).filter((id): id is string => Boolean(id));
  const eventNames = new Map<string, string>();
  const rowEventDates = new Map<string, string | null>();
  if (chargeIds.length) {
    const chargesResponse = await fetch(`${url}/rest/v1/event_charges?select=id,event_id&band_id=eq.${encodeURIComponent(own[0].band_id)}&id=in.(${chargeIds.map(encodeURIComponent).join(",")})`, { headers, cache: "no-store" });
    const charges = (await chargesResponse.json().catch(() => [])) as { id: string; event_id: string }[];
    const eventIds = charges.map((charge) => charge.event_id);
    if (eventIds.length) {
      const eventsResponse = await fetch(`${url}/rest/v1/events?select=id,title,starts_at&band_id=eq.${encodeURIComponent(own[0].band_id)}&id=in.(${eventIds.map(encodeURIComponent).join(",")})`, { headers, cache: "no-store" });
      const events = (await eventsResponse.json().catch(() => [])) as { id: string; title: string; starts_at: string }[];
      const titles = new Map(events.map((event) => [event.id, event.title]));
      const dates = new Map(events.map((event) => [event.id, event.starts_at]));
      charges.forEach((charge) => { const title = titles.get(charge.event_id); if (title) eventNames.set(charge.id, title); rowEventDates.set(charge.id, dates.get(charge.event_id) ?? null); });
    }
  }
  return rows.map((row) => ({ id: row.id, memberName: row.member_name, kind: row.kind, amountCents: row.amount_cents, note: row.note, createdAt: row.created_at, eventName: row.event_charge_id ? eventNames.get(row.event_charge_id) : undefined, eventDate: row.event_charge_id ? rowEventDates.get(row.event_charge_id) : undefined }));
}