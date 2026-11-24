"use server";

export async function getInvitedBandName(bandId?: string): Promise<string | null> {
  if (!bandId) return null;

  const supabaseUrl = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !secretKey) return null;

  const response = await fetch(
    `${supabaseUrl}/rest/v1/bands?select=name&id=eq.${encodeURIComponent(bandId)}&limit=1`,
    {
      headers: {
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`,
      },
      cache: "no-store",
    },
  );

  if (!response.ok) return null;

  const bands = (await response.json().catch(() => [])) as { name?: string | null }[];
  return bands[0]?.name?.trim() || null;
}