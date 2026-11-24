"use client";

import { useState } from "react";
import { addBalanceAdjustment } from "@/lib/backend/finance";

export default function BalanceAdjustment({ membershipId }: { membershipId: string }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await addBalanceAdjustment(new FormData(event.currentTarget));
    if (result.error) setMessage(result.error); else { setMessage(""); setOpen(false); }
  }
  if (!open) return <button type="button" onClick={() => setOpen(true)} aria-label="Adjust balance" className="mt-3 flex h-9 w-9 items-center justify-center rounded-xl border border-[#f0c5b8] bg-[#fff4ed] text-sm font-semibold text-[#a04420] shadow-sm transition hover:bg-[#ffe5dc]" title="Adjust balance">+/-</button>;
  return <form onSubmit={submit} className="mt-3 flex flex-wrap gap-2"><input type="hidden" name="membershipId" value={membershipId} /><input name="amount" type="number" step="0.01" placeholder="+/- amount" required className="h-9 w-28 max-w-full rounded-lg border px-2 text-sm" /><input name="note" placeholder="Note" className="h-9 min-w-0 flex-1 rounded-lg border px-2 text-sm" /><button className="rounded-lg bg-[#ff6b35] px-3 text-sm font-semibold text-white">Save</button><button type="button" onClick={() => setOpen(false)} className="rounded-lg bg-[#f5f2ee] px-3 text-sm">Cancel</button>{message && <p className="w-full text-xs text-[#a04420]">{message}</p>}</form>;
}