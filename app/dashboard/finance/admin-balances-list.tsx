"use client";

import type { MemberBalance } from "@/lib/backend/finance";
import BalanceAmount from "./balance-amount";
import BalanceAdjustment from "./balance-adjustment";
import AddFunds from "./add-funds";
import MemberTransactions from "./member-transactions";

export default function AdminBalancesList({ balances }: { balances: MemberBalance[] }) {
  if (!balances.length) return <div className="rounded-2xl border border-[#e8e1e9] bg-white px-5 py-8 text-sm text-[#69727d]">No balance information available.</div>;
  return <div className="space-y-3">{balances.map((balance) => <div key={balance.membershipId} className="rounded-2xl border border-[#e8e1e9] bg-white px-5 py-4"><div className="flex items-center justify-between"><span className="font-medium text-[#303942]">{balance.name}</span><BalanceAmount cents={balance.balanceCents} /></div><div className="flex flex-wrap gap-4"><BalanceAdjustment membershipId={balance.membershipId} /><AddFunds membershipId={balance.membershipId} /></div><MemberTransactions membershipId={balance.membershipId} /></div>)}</div>;
}