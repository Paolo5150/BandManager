"use client";

import { useState } from "react";
import { addBalanceAdjustment } from "@/lib/backend/finance";
import LoadingSpinner from "../loading-spinner";

export default function BalanceAdjustment({ membershipId, open, onOpen, onClose }: { membershipId: string; open: boolean; onOpen: () => void; onClose: () => void }) {
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const result = await addBalanceAdjustment(new FormData(event.currentTarget));
    if (result.error) setMessage(result.error);
    else { setMessage(""); onClose(); }
    setSaving(false);
  }

  if (!open) {
    return (
      <button type="button" onClick={onOpen} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#f0c5b8] bg-[#fff4ed] px-3 text-sm font-semibold text-[#a04420] transition hover:bg-[#ffe5dc]">
        <span aria-hidden="true" className="text-xs">+/−</span>Set balance
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="w-full rounded-xl border border-[#f3d9cf] bg-[#fffaf7] p-3">
      <input type="hidden" name="membershipId" value={membershipId} />
      <label className="block text-xs font-medium text-[#a04420]">Set fixed balance amount ($)
        <input name="amount" type="number" inputMode="decimal" step="0.01" placeholder="$0.00" required autoFocus className="mt-1.5 h-10 w-full rounded-lg border border-[#ddd8d1] bg-white px-3 text-sm text-[#17202a]" />
      </label>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => { setMessage(""); onClose(); }} className="h-10 rounded-lg bg-white text-sm font-semibold text-[#303942] ring-1 ring-[#e8e1e9]">Cancel</button>
        <button type="submit" disabled={saving} className="flex h-10 items-center justify-center rounded-lg bg-[#ff6b35] text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{saving ? <LoadingSpinner label="Saving..." /> : "Set balance"}</button>
      </div>
      {message && <p className="mt-2 text-xs text-[#a04420]">{message}</p>}
    </form>
  );
}