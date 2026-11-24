"use server";

import { normalizePhoneNumber } from "@/lib/phone";

type CreateBandResult = { error?: string; bandId?: string };

export async function createBand(
  name: string,
  userId: string,
  displayName: string,
  phone: string,
  existingBandId?: string,
): Promise<CreateBandResult> {
  const normalizedPhone = normalizePhoneNumber(phone);
  if (!normalizedPhone) {
    return { error: "Enter a valid Australian mobile number, for example 0412 345 678." };
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !secretKey) {
    return { error: "Supabase is not configured on the server." };
  }

  const headers = {
    apikey: secretKey,
    Authorization: `Bearer ${secretKey}`,
    "Content-Type": "application/json",
  };

  const bandResponse = existingBandId ? null : await fetch(`${supabaseUrl}/rest/v1/bands`, {
    method: "POST",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify({ name }),
    cache: "no-store",
  });

  const bandBody = bandResponse ? await bandResponse.json().catch(() => null) : null;
  const bands = Array.isArray(bandBody) ? (bandBody as { id?: string }[]) : null;
  const bandError = !Array.isArray(bandBody) && bandBody && typeof bandBody === "object"
    ? (bandBody as { message?: string; hint?: string })
    : null;
  const band = existingBandId ? { id: existingBandId } : bands?.find((item) => item.id);

  if ((!existingBandId && !bandResponse?.ok) || !band) {
    return {
      error: bandError?.message ?? bandError?.hint ?? "Unable to create the band.",
    };
  }

  // Confirm the foreign-key target exists before attempting the membership insert.
  if (existingBandId) {
    const bandCheckResponse = await fetch(
      `${supabaseUrl}/rest/v1/bands?select=id&id=eq.${encodeURIComponent(existingBandId)}&limit=1`,
      { headers, cache: "no-store" },
    );
    const existingBands = (await bandCheckResponse.json().catch(() => [])) as { id?: string }[];
    if (!bandCheckResponse.ok || existingBands[0]?.id !== existingBandId) {
      return { error: "The invitation refers to a band that no longer exists." };
    }
  }

  const membershipRole = existingBandId ? "member" : "admin";

  const membershipResponse = await fetch(`${supabaseUrl}/rest/v1/memberships`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      user_id: userId,
      band_id: band.id,
      role: membershipRole,
      display_name: displayName,
      phone: normalizedPhone,
      confirmed: !existingBandId,
    }),
    cache: "no-store",
  });

  if (!membershipResponse.ok) {
    const membershipError = (await membershipResponse.json().catch(() => null)) as
      | { message?: string; details?: string; hint?: string; code?: string }
      | null;

    if (membershipError?.code === "23505") {
      return { bandId: band.id };
    }

    return {
      error:
        membershipError?.message ??
        membershipError?.details ??
        membershipError?.hint ??
        `Membership setup failed (${membershipResponse.status}).`,
    };
  }

  return { bandId: band.id };
}