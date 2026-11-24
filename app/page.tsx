import AuthForm from "./auth-form";
import { connection } from "next/server";

export const instant = false;

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ bandId?: string }>;
}) {
  await connection();
  const { bandId } = await searchParams;

  return (
    <main className="flex min-h-screen flex-1 items-center justify-center px-5 py-10 sm:px-8">
      <AuthForm inviteBandId={bandId} />
    </main>
  );
}
