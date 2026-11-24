import Link from "next/link";
import { connection } from "next/server";
import { getMemberBalances } from "@/lib/backend/finance";
import AdminBalancesList from "./admin-balances-list";
import YourBalance from "./your-balance";

export const instant = false;
const navigation = ["Overview", "Members", "Songlist", "Sets", "Schedule", "Finance"];

export default async function FinancePage() {
  await connection();
  const { balances, isAdmin } = await getMemberBalances();
  return <div className="flex min-h-screen bg-[#f8f5f1]"><aside className="hidden w-64 shrink-0 flex-col border-r border-[#e8e1e9] bg-white px-5 py-6 md:flex"><b className="px-2 text-lg text-[#17202a]">BandManager</b><nav className="mt-10 flex flex-1 flex-col gap-1"><p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-[#a0a5aa]">Workspace</p>{navigation.map((item) => <Link key={item} href={item === "Overview" ? "/dashboard" : `/dashboard/${item.toLowerCase()}`} className={`rounded-xl px-3 py-3 text-sm ${item === "Finance" ? "bg-[#fff1e9] text-[#e95a27]" : "text-[#69727d]"}`}>{item}</Link>)}</nav></aside><main className="min-w-0 flex-1 px-4 py-5 sm:px-10 sm:py-8"><nav className="mb-6 flex gap-2 overflow-x-auto md:hidden">{navigation.map((item) => <Link key={item} href={item === "Overview" ? "/dashboard" : `/dashboard/${item.toLowerCase()}`} className="shrink-0 rounded-lg bg-white px-3 py-2 text-sm text-[#69727d]">{item}</Link>)}</nav><div className="mx-auto max-w-5xl"><p className="text-sm font-semibold uppercase tracking-wider text-[#ff6b35]">Finance</p><h1 className="mt-2 text-3xl font-semibold text-[#17202a]">{isAdmin ? "Member balances" : "Your balance"}</h1><p className="mt-2 text-sm text-[#69727d]">{isAdmin ? "Balances for every confirmed member." : "Your current balance."}</p><div className="mt-8">{isAdmin ? <AdminBalancesList balances={balances} /> : <YourBalance balance={balances[0]} />}</div></div></main></div>;
}