"use server";

import { saveSession } from "@/lib/backend/session";
import { normalizePhoneNumber } from "@/lib/phone";

type SignupInput = {
  name: string;
  phone: string;
  password: string;
};

type SignupResult = {
  error?: string;
  userId?: string;
  hasBand?: boolean;
  displayName?: string;
  confirmed?: boolean;
};

export async function signup({
  name,
  phone,
  password,
}: SignupInput): Promise<SignupResult> {
  const normalizedPhone = normalizePhoneNumber(phone);
  if (!normalizedPhone) {
    return { error: "Enter a valid Australian mobile number, for example 0412 345 678." };
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !publishableKey) {
    return { error: "Supabase is not configured on the server." };
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/signup`, {
    method: "POST",
    headers: {
      apikey: publishableKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      phone: normalizedPhone,
      password,
      data: { name },
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { msg?: string; message?: string; error_description?: string }
      | null;

    return {
      error:
        body?.msg ??
        body?.message ??
        body?.error_description ??
        "Unable to create your account.",
    };
  }

  const body = (await response.json().catch(() => null)) as
    | { id?: string; user?: { id?: string }; access_token?: string; refresh_token?: string }
    | null;

  let userId = body?.user?.id ?? body?.id;

  if (!userId && process.env.SUPABASE_SECRET_KEY) {
    const usersResponse = await fetch(
      `${supabaseUrl}/auth/v1/admin/users?per_page=1000`,
      {
        headers: {
          apikey: process.env.SUPABASE_SECRET_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_SECRET_KEY}`,
        },
        cache: "no-store",
      },
    );
    const usersBody = (await usersResponse.json().catch(() => null)) as
      | { users?: { id: string; phone?: string }[] }
      | null;
    userId = usersBody?.users?.find((user) => user.phone === normalizedPhone)?.id;
  }

  if (!userId) {
    return { error: "Account was created, but its Auth user ID could not be found." };
  }

  await saveSession(body?.access_token, body?.refresh_token);

  return { userId, displayName: name, confirmed: true };
}