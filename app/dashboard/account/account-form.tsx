"use client";

import { useState } from "react";
import { updateAccountName } from "@/lib/backend/account";

export default function AccountForm({ name, phone }: { name: string; phone: string }) {
  const [currentName, setCurrentName] = useState(name);
  const [draft, setDraft] = useState(name);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const dirty = draft.trim() !== currentName;

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const result = await updateAccountName(draft);
      if (result.error) setMessage(result.error);
      else { setCurrentName(draft.trim()); setDraft(draft.trim()); setMessage("Your name has been updated."); }
    } catch {
      setMessage("Unable to update your name. Please try again.");
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={save} className="mt-6 rounded-2xl border border-[#e8e1e9] bg-white p-5 shadow-sm sm:mt-8 sm:p-7">
      <div className="max-w-xl space-y-5">
        <div>
          <label htmlFor="account-name" className="mb-2 block text-sm font-semibold text-[#303942]">Name</label>
          <input id="account-name" name="name" autoComplete="name" required maxLength={100} value={draft} onChange={(event) => setDraft(event.target.value)} className="h-12 w-full rounded-xl border border-[#d9d3ce] bg-white px-4 text-base text-[#17202a] outline-none transition placeholder:text-[#a0a5aa] focus:border-[#ff6b35] focus:ring-2 focus:ring-[#ff6b35]/20" />
        </div>
        <div>
          <label htmlFor="account-phone" className="mb-2 block text-sm font-semibold text-[#303942]">Phone number</label>
          <input id="account-phone" type="tel" value={phone} readOnly aria-readonly="true" className="h-12 w-full rounded-xl border border-[#e8e1e9] bg-[#f8f5f1] px-4 text-base text-[#69727d]" />
          <p className="mt-2 text-xs text-[#69727d]">Your phone number can’t be changed here.</p>
        </div>
        <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center">
          <button type="submit" disabled={busy || !dirty} className="inline-flex h-11 items-center justify-center rounded-xl bg-[#ff6b35] px-5 text-sm font-semibold text-white transition hover:bg-[#ed5c2b] disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Saving…" : "Save changes"}</button>
          {message && <p role="status" aria-live="polite" className="text-sm text-[#69727d]">{message}</p>}
        </div>
      </div>
    </form>
  );
}