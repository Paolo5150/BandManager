"use client";

import { useState } from "react";
import { addFunds } from "@/lib/backend/finance";

export default function AddFunds({ membershipId }: { membershipId: string }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await addFunds(new FormData(event.currentTarget));
    if (result.error) setMessage(result.error);
    else { setMessage(""); setOpen(false); }
  }

  if (!open) return <button type="button" onClick={() => setOpen(true)} aria-label="Add funds" className="mt-3 flex h-9 w-9 items-center justify-center rounded-xl border border-[#b7dec5] bg-[#eefbf4] text-xl font-semibold text-[#24734b] shadow-sm transition hover:bg-[#ddf5e7]" title="Add funds">+</button>;

  return <form onSubmit={submit} className="mt-3 flex flex-wrap gap-2"><input type="hidden" name="membershipId" value={membershipId} /><input name="amount" type="number" min="0.01" step="0.01" placeholder="Amount" required className="h-9 w-28 max-w-full rounded-lg border px-2 text-sm" /><input name="note" placeholder="Note" className="h-9 min-w-0 flex-1 rounded-lg border px-2 text-sm" /><button type="submit" className="rounded-lg bg-[#24734b] px-3 text-sm font-semibold text-white">Save</button><button type="button" onClick={() => { setMessage(""); setOpen(false); }} className="rounded-lg bg-[#f5f2ee] px-3 text-sm">Cancel</button>{message && <p className="w-full text-xs text-[#a04420]">{message}</p>}</form>;
}