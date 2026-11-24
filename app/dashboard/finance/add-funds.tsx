"use client";

import { useState } from "react";
import { addFunds } from "@/lib/backend/finance";
import { PlusIcon } from "../icons";
import LoadingSpinner from "../loading-spinner";

export default function AddFunds({ membershipId, open, onOpen, onClose }: { membershipId: string; open: boolean; onOpen: () => void; onClose: () => void }) {
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const result = await addFunds(new FormData(event.currentTarget));
    if (result.error) setMessage(result.error);
    else { setMessage(""); onClose(); }
    setSaving(false);
  }

  if (!open) {
    return (
      <button type="button" onClick={onOpen} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#b7dec5] bg-[#eefbf4] px-3 text-sm font-semibold text-[#24734b] transition hover:bg-[#ddf5e7]">
        <PlusIcon className="h-4 w-4" />Add funds
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="w-full rounded-xl border border-[#d7ecdf] bg-[#f6fcf8] p-3">
      <input type="hidden" name="membershipId" value={membershipId} />
      <label className="block text-xs font-medium text-[#24734b]">Amount to add
        <input name="amount" type="number" inputMode="decimal" min="0.01" step="0.01" placeholder="0.00" required autoFocus className="mt-1.5 h-10 w-full rounded-lg border border-[#ddd8d1] bg-white px-3 text-sm text-[#17202a]" />
      </label>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => { setMessage(""); onClose(); }} className="h-10 rounded-lg bg-white text-sm font-semibold text-[#303942] ring-1 ring-[#e8e1e9]">Cancel</button>
        <button type="submit" disabled={saving} className="flex h-10 items-center justify-center rounded-lg bg-[#24734b] text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{saving ? <LoadingSpinner label="Saving..." /> : "Add funds"}</button>
      </div>
      {message && <p className="mt-2 text-xs text-[#a04420]">{message}</p>}
    </form>
  );
}