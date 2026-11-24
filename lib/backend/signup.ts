"use server";

import { cookies } from "next/headers";

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
};

export async function signup({
  name,
  phone,
  password,
}: SignupInput): Promise<SignupResult> {
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
      phone,
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
    | { id?: string; user?: { id?: string }; access_token?: string }
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
    userId = usersBody?.users?.find((user) => user.phone === phone)?.id;
  }

  if (!userId) {
    return { error: "Account was created, but its Auth user ID could not be found." };
  }

  if (body?.access_token) {
    (await cookies()).set("band-manager-access-token", body.access_token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
  }

  return { userId, displayName: name };
}