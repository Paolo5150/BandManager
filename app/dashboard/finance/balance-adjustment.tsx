"use client";

import { useState } from "react";
import { addBalanceAdjustment } from "@/lib/backend/finance";

export default function BalanceAdjustment({ membershipId, open, onOpen, onClose }: { membershipId: string; open: boolean; onOpen: () => void; onClose: () => void }) {
  
  const [message, setMessage] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await addBalanceAdjustment(new FormData(event.currentTarget));
    if (result.error) setMessage(result.error); else { setMessage(""); onClose(); }
  }
  if (!open) return <button type="button" onClick={onOpen} aria-label="Set fixed balance" className="mt-3 inline-flex items-center gap-2 rounded-xl border border-[#f0c5b8] bg-[#fff4ed] px-3 py-2 text-sm font-semibold text-[#a04420] shadow-sm transition hover:bg-[#ffe5dc]" title="Set fixed balance"><span aria-hidden="true">+/-</span> Set balance</button>;
  return <form onSubmit={submit} className="mt-3 flex flex-wrap items-center gap-2"><input type="hidden" name="membershipId" value={membershipId} /><label className="w-full text-xs font-medium text-[#69727d]">Set fixed balance amount</label><input name="amount" type="number" step="0.01" placeholder="Balance amount" required className="h-9 w-32 max-w-full rounded-lg border px-2 text-sm" /><button className="rounded-lg bg-[#ff6b35] px-3 text-sm font-semibold text-white">Save</button><button type="button" onClick={onClose} className="rounded-lg bg-[#f5f2ee] px-3 text-sm">Cancel</button>{message && <p className="w-full text-xs text-[#a04420]">{message}</p>}</form>;
}