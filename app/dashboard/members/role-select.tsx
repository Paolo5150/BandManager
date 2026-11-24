"use client";

import { useState } from "react";
import { updateMemberRole } from "@/lib/backend/members";

export default function RoleSelect({ membershipId, role }: { membershipId: string; role: string }) {
  const [selectedRole, setSelectedRole] = useState(role);
  const [isSaving, setIsSaving] = useState(false);

  async function save() {
    setIsSaving(true);
    const data = new FormData();
    data.set("membershipId", membershipId);
    data.set("role", selectedRole);
    await updateMemberRole(data);
    setIsSaving(false);
  }

  function discard() {
    setSelectedRole(role);
  }

  const changed = selectedRole !== role;

  return <div className="flex items-center gap-2"><select name="role" value={selectedRole} onChange={(event) => setSelectedRole(event.target.value)} className="h-9 rounded-lg border border-[#ddd8d1] bg-white px-2 text-sm capitalize"><option value="member">Member</option><option value="admin">Admin</option></select>{changed && <><button type="button" onClick={save} disabled={isSaving} title="Save role" aria-label="Save role" className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#eefbf4] text-sm text-[#24734b] hover:bg-[#dff5e9] disabled:opacity-50">✓</button><button type="button" onClick={discard} disabled={isSaving} title="Discard role change" aria-label="Discard role change" className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f5f2ee] text-sm text-[#69727d] hover:bg-[#ebe6df] disabled:opacity-50">×</button></>}</div>;
}