"use client";

import { FormEvent, useState } from "react";

export default function InviteModal({ bandId }: { bandId?: string }) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [inviteLink, setInviteLink] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!bandId) return;
    const link = `${window.location.origin}/?bandId=${encodeURIComponent(bandId)}`;
    setInviteLink(link);
  }

  function close() {
    setOpen(false);
    setPhone("");
    setInviteLink("");
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="rounded-xl bg-[#ff6b35] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-orange-100 transition hover:bg-[#e95a27]">Invite member</button>
      {open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#17202a]/30 px-5" role="dialog" aria-modal="true" aria-labelledby="invite-title">
        <div className="w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl">
          <div className="flex items-start justify-between"><div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#ff6b35]">Band invite</p><h2 id="invite-title" className="mt-2 text-2xl font-semibold text-[#17202a]">Invite a member</h2></div><button type="button" onClick={close} aria-label="Close invite dialog" className="text-2xl leading-none text-[#8a929a]">×</button></div>
          <p className="mt-3 text-sm leading-6 text-[#69727d]">Enter their phone number. SMS delivery will be connected later; for now, the invite link will appear here.</p>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4"><label className="block text-sm font-medium text-[#303942]">Phone number<input value={phone} onChange={(event) => setPhone(event.target.value)} type="tel" placeholder="+1 (555) 000-0000" required className="mt-2 h-12 w-full rounded-xl border border-[#ddd8d1] bg-[#fcfbf9] px-4 text-[#17202a] outline-none focus:border-[#ff6b35] focus:ring-4 focus:ring-orange-100" /></label><button type="submit" disabled={!bandId} className="h-12 w-full rounded-xl bg-[#ff6b35] text-sm font-semibold text-white disabled:opacity-50">Send invite</button></form>
          {inviteLink && <div className="mt-5 rounded-xl bg-[#fff4ed] p-4"><p className="text-xs font-semibold uppercase tracking-wider text-[#a04420]">Invitation link</p><a href={inviteLink} className="mt-2 block break-all text-sm text-[#a04420] underline">{inviteLink}</a><p className="mt-3 text-xs text-[#a04420]">Send this link to {phone} manually for now.</p></div>}
        </div>
      </div>}
    </>
  );
}