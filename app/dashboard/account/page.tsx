import { connection } from "next/server";
import { getAccountDetails } from "@/lib/backend/account";
import { AccountIcon } from "../icons";
import DashboardShell from "../dashboard-shell";
import PageHeader from "../page-header";
import AccountForm from "./account-form";

export const instant = false;

export default async function AccountPage() {
  await connection();
  const account = await getAccountDetails();
  return (
    <DashboardShell active="Account">
      <PageHeader eyebrow="Your profile" title="Account" description="Manage the personal details on your account.">
        <div className="mt-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff1e9] text-[#e95a27] sm:mt-5 sm:h-14 sm:w-14">
          <AccountIcon className="h-7 w-7" />
        </div>
      </PageHeader>
      <AccountForm name={account.name} phone={account.phone} />
    </DashboardShell>
  );
}