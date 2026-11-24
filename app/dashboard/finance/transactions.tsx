"use client";

import type { LedgerTransaction } from "@/lib/backend/finance";
import { formatDateTime } from "@/lib/date-format";

export default function Transactions({ transactions }: { transactions: LedgerTransaction[] }) {
  return <details className="mt-8 rounded-2xl border border-[#e8e1e9] bg-white p-5"><summary className="cursor-pointer font-semibold text-[#17202a]">Transactions</summary>{transactions.length ? <div className="mt-4 space-y-3">{transactions.map((transaction) => <div key={transaction.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-[#eee9e3] pt-3 text-sm"><div><p className="font-medium capitalize text-[#303942]">{transaction.kind}{transaction.memberName ? ` - ${transaction.memberName}` : ""}{transaction.eventName ? ` - ${transaction.eventName}` : ""}</p><p className="text-xs text-[#69727d]">{formatDateTime(transaction.createdAt)}{transaction.note ? ` - ${transaction.note}` : ""}</p></div><span className={transaction.amountCents < 0 ? "font-semibold text-[#a04420]" : "font-semibold text-[#24734b]"}>{(transaction.amountCents / 100).toFixed(2)}</span></div>)}</div> : <p className="mt-4 text-sm text-[#69727d]">No transactions yet.</p>}</details>;
}