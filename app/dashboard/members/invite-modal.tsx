"use client";

import { FormEvent, useState } from "react";
import { CloseIcon, PlusIcon } from "../icons";
import LoadingSpinner from "../loading-spinner";

export default function InviteModal({ bandId }: { bandId?: string }) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!bandId) return;
    setIsGenerating(true);
    const link = `${window.location.origin}/?bandId=${encodeURIComponent(bandId)}`;
    setInviteLink(link);
    setIsGenerating(false);
  }

  function close() {
    setOpen(false);
    setPhone("");
    setInviteLink("");
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#ff6b35] px-4 text-sm font-semibold text-white shadow-md shadow-orange-100 transition hover:bg-[#e95a27]"><PlusIcon className="h-4 w-4" />Invite member</button>
      {open && <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#17202a]/30 sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-labelledby="invite-title">
        <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-7">
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#ff6b35]">Band invite</p><h2 id="invite-title" className="mt-1.5 text-xl font-semibold text-[#17202a] sm:text-2xl">Invite a member</h2></div><button type="button" onClick={close} aria-label="Close invite dialog" className="-mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#8a929a] hover:bg-[#f5f2ee]"><CloseIcon /></button></div>
          <p className="mt-3 text-sm leading-6 text-[#69727d]">Enter their phone number. SMS delivery will be connected later; for now, the invite link will appear here.</p>
           <form onSubmit={handleSubmit} className="mt-6 space-y-4"><label className="block text-sm font-medium text-[#303942]">Phone number<input value={phone} onChange={(event) => setPhone(event.target.value)} type="tel" placeholder="04xx xxx xxx" required className="mt-2 h-12 w-full rounded-xl border border-[#ddd8d1] bg-[#fcfbf9] px-4 text-[#17202a] outline-none focus:border-[#ff6b35] focus:ring-4 focus:ring-orange-100" /></label><button type="submit" disabled={!bandId || isGenerating} className="flex h-12 w-full items-center justify-center rounded-xl bg-[#ff6b35] text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{isGenerating ? <LoadingSpinner label="Generating link..." /> : "Send invite"}</button></form>
          {inviteLink && <div className="mt-5 rounded-xl bg-[#fff4ed] p-4"><p className="text-xs font-semibold uppercase tracking-wider text-[#a04420]">Invitation link</p><a href={inviteLink} className="mt-2 block break-all text-sm text-[#a04420] underline">{inviteLink}</a><p className="mt-3 text-xs text-[#a04420]">Send this link to {phone} manually for now.</p></div>}
        </div>
      </div>}
    </>
  );
}