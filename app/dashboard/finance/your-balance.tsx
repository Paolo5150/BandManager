"use client";

import type { MemberBalance } from "@/lib/backend/finance";
import BalanceAmount from "./balance-amount";
import MemberTransactions from "./member-transactions";

export default function YourBalance({ balance }: { balance?: MemberBalance }) {
  return (
    <section className="rounded-2xl border border-[#e8e1e9] bg-white p-4 shadow-sm sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 truncate font-medium text-[#303942]">{balance?.name ?? "Your account"}</span>
        <span className="text-lg"><BalanceAmount cents={balance?.balanceCents ?? 0} /></span>
      </div>
      {balance && <MemberTransactions membershipId={balance.membershipId} />}
    </section>
  );
}