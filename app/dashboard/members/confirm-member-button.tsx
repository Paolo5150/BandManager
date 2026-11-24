"use client";
import { confirmMember, declineMember } from "@/lib/backend/members";

export default function ConfirmMemberButton({ membershipId }: { membershipId: string }) {
  return (
    <div className="flex items-center gap-2">
      <form action={confirmMember}><input type="hidden" name="membershipId" value={membershipId} /><button className="h-9 rounded-lg bg-[#eefbf4] px-3 text-sm font-semibold text-[#24734b] hover:bg-[#dff5e9]">Confirm</button></form>
      <form action={declineMember}><input type="hidden" name="membershipId" value={membershipId} /><button className="h-9 rounded-lg bg-[#fff4ed] px-3 text-sm font-semibold text-[#b14b36] hover:bg-[#ffe5dc]">Decline</button></form>
    </div>
  );
}