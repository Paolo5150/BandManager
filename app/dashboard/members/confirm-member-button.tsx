"use client";
import { useState } from "react";
import { confirmMember, declineMember } from "@/lib/backend/members";
import LoadingSpinner from "../loading-spinner";

export default function ConfirmMemberButton({ membershipId }: { membershipId: string }) {
  const [pendingAction, setPendingAction] = useState<"confirm" | "decline" | null>(null);

  return (
    <div className="flex items-center gap-2">
      <form action={confirmMember} onSubmit={() => setPendingAction("confirm")}>
        <input type="hidden" name="membershipId" value={membershipId} />
        <button type="submit" disabled={pendingAction !== null} className="flex h-9 items-center justify-center rounded-lg bg-[#eefbf4] px-3 text-sm font-semibold text-[#24734b] hover:bg-[#dff5e9] disabled:cursor-not-allowed disabled:opacity-50">
          {pendingAction === "confirm" ? <LoadingSpinner label="Confirming..." /> : "Confirm"}
        </button>
      </form>
      <form action={declineMember} onSubmit={() => setPendingAction("decline")}>
        <input type="hidden" name="membershipId" value={membershipId} />
        <button type="submit" disabled={pendingAction !== null} className="flex h-9 items-center justify-center rounded-lg bg-[#fff4ed] px-3 text-sm font-semibold text-[#b14b36] hover:bg-[#ffe5dc] disabled:cursor-not-allowed disabled:opacity-50">
          {pendingAction === "decline" ? <LoadingSpinner label="Declining..." /> : "Decline"}
        </button>
      </form>
    </div>
  );
}