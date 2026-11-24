"use server";

type CreateBandResult = { error?: string; bandId?: string };

export async function createBand(
  name: string,
  userId: string,
  displayName: string,
  phone: string,
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

  const bandResponse = await fetch(`${supabaseUrl}/rest/v1/bands`, {
    method: "POST",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify({ name }),
    cache: "no-store",
  });

  const bands = (await bandResponse.json().catch(() => null)) as
    | { id: string }[]
    | { message?: string; hint?: string }
    | null;
  const band = Array.isArray(bands) ? bands[0] : undefined;

  if (!bandResponse.ok || !band) {
    return {
      error:
        (!Array.isArray(bands) && (bands?.message || bands?.hint)) ||
        "Unable to create the band.",
    };
  }

  const membershipResponse = await fetch(`${supabaseUrl}/rest/v1/memberships`, {
    method: "POST",
    headers,
    body: JSON.stringify({ user_id: userId, band_id: band.id, role: "admin", display_name: displayName, phone }),
    cache: "no-store",
  });

  if (!membershipResponse.ok) {
    return { error: "The band was created, but membership setup failed." };
  }

  return { bandId: band.id };
}