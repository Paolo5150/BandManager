import { connection } from "next/server";
import { getMemberBalances } from "@/lib/backend/finance";
import DashboardShell from "../dashboard-shell";
import PageHeader from "../page-header";
import AdminBalancesList from "./admin-balances-list";
import YourBalance from "./your-balance";

export const instant = false;

export default async function FinancePage() {
  await connection();
  const { balances, isAdmin } = await getMemberBalances();
  return (
    <DashboardShell active="Finance">
      <PageHeader eyebrow="Finance" title={isAdmin ? "Member balances" : "Your balance"} description={isAdmin ? "Balances for every confirmed member." : "Your current balance."} />
      <div className="mt-6 sm:mt-8">{isAdmin ? <AdminBalancesList balances={balances} /> : <YourBalance balance={balances[0]} />}</div>
    </DashboardShell>
  );
}