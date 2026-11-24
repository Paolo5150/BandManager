"use server";

type CreateBandResult = { error?: string; bandId?: string };

export async function createBand(
  name: string,
  userId: string,
  displayName: string,
  phone: string,
  existingBandId?: string,
): Promise<CreateBandResult> {
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

  const bands = bandResponse
    ? ((await bandResponse.json().catch(() => null)) as
        | { id: string }[]
        | { message?: string; hint?: string }
        | null)
    : null;
  const band = existingBandId ? { id: existingBandId } : Array.isArray(bands) ? bands[0] : undefined;

  if ((!existingBandId && !bandResponse?.ok) || !band) {
    return {
      error:
        (!Array.isArray(bands) && (bands?.message || bands?.hint)) ||
        "Unable to create the band.",
    };
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
      phone,
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