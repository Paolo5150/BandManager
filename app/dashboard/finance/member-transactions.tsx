"use client";

import { useState } from "react";
import { getTransactionsForMembership, type LedgerTransaction } from "@/lib/backend/finance";
import { ChevronDownIcon } from "../icons";
import { formatDate } from "@/lib/date-format";

export default function MemberTransactions({ membershipId }: { membershipId: string }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<LedgerTransaction[]>([]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !loaded) {
      setLoading(true);
      setRows(await getTransactionsForMembership(membershipId));
      setLoaded(true);
      setLoading(false);
    }
  }

  return (
    <div className="mt-3 border-t border-[#f1ede8] pt-2">
      <button type="button" onClick={toggle} aria-expanded={open} className="-mx-1 inline-flex items-center gap-1 rounded-lg px-1 py-1.5 text-sm font-semibold text-[#69727d] hover:text-[#17202a]">
        {open ? "Hide transactions" : "Show transactions"}
        <ChevronDownIcon className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-1 divide-y divide-[#f1ede8]">
          {loading ? (
            <div className="flex items-center gap-2 py-2 text-sm text-[#69727d]"><span className="h-4 w-4 animate-spin rounded-full border-2 border-[#ddd8d1] border-t-[#ff6b35]" aria-hidden="true" />Loading transactions...</div>
          ) : rows.length ? rows.map((row) => (
            <div key={row.id} className="flex items-start justify-between gap-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="break-words text-[#303942]"><span className="capitalize">{row.kind}</span>{row.eventName ? ` · ${row.eventName}` : ""}</p>
                {row.note && <p className="break-words text-xs text-[#69727d]">{row.note}</p>}
                <p className="text-xs text-[#a0a5aa]">{formatDate(row.eventDate ?? row.createdAt)}</p>
              </div>
              <span className={`shrink-0 font-semibold tabular-nums ${row.amountCents < 0 ? "text-[#a04420]" : "text-[#24734b]"}`}>{row.amountCents < 0 ? "-$" : "$"}{Math.abs(row.amountCents / 100).toFixed(2)}</span>
            </div>
          )) : <p className="py-2 text-sm text-[#69727d]">No transactions yet.</p>}
        </div>
      )}
    </div>
  );
}