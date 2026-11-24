"use client";

import type { MemberBalance } from "@/lib/backend/finance";
import BalanceAmount from "./balance-amount";
import MemberTransactions from "./member-transactions";

export default function YourBalance({ balance }: { balance?: MemberBalance }) {
  return <section className="rounded-3xl border border-[#e8e1e9] bg-white p-6 shadow-sm"><p className="text-sm font-semibold uppercase tracking-wider text-[#ff6b35]">Your balance</p><div className="mt-5 flex items-center justify-between"><span className="font-medium text-[#303942]">{balance?.name ?? "Your account"}</span><BalanceAmount cents={balance?.balanceCents ?? 0} /></div>{balance && <MemberTransactions membershipId={balance.membershipId} />}</section>;
}