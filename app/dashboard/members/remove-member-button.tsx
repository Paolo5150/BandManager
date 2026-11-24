"use client";

import { useState } from "react";
import { removeMember } from "@/lib/backend/members";
import { TrashIcon } from "../icons";

export default function RemoveMemberButton({ membershipId, name }: { membershipId: string; name: string }) {
  const [isRemoving, setIsRemoving] = useState(false);

  async function handleRemove() {
    if (!window.confirm(`Remove ${name} from the band?`)) return;
    setIsRemoving(true);
    const formData = new FormData();
    formData.set("membershipId", membershipId);
    await removeMember(formData);
    setIsRemoving(false);
  }

  return <button type="button" onClick={handleRemove} disabled={isRemoving} aria-label={`Remove ${name}`} title={isRemoving ? "Removing..." : "Remove member"} className="flex h-9 w-9 items-center justify-center rounded-lg text-[#b14b36] hover:bg-[#fff4ed] hover:text-[#8e2f1e] disabled:opacity-50">{isRemoving ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#e6b7aa] border-t-[#8e2f1e]" aria-hidden="true" /> : <TrashIcon className="h-[18px] w-[18px]" />}</button>;
}