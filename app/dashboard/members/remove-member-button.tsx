"use client";

import { useState } from "react";
import { removeMember } from "@/lib/backend/members";

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

  return <button type="button" onClick={handleRemove} disabled={isRemoving} className="text-xs font-semibold text-[#b14b36] hover:text-[#8e2f1e] disabled:opacity-50">{isRemoving ? "Removing..." : "Remove"}</button>;
}