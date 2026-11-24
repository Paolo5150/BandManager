"use client";
import { confirmMember, declineMember } from "@/lib/backend/members";

export default function ConfirmMemberButton({ membershipId }: { membershipId: string }) {
  return <div className="flex items-center gap-4"><form action={confirmMember}><input type="hidden" name="membershipId" value={membershipId} /><button className="text-xs font-semibold text-[#24734b]">Confirm</button></form><form action={declineMember}><input type="hidden" name="membershipId" value={membershipId} /><button className="text-xs font-semibold text-[#b14b36]">Decline</button></form></div>;
}