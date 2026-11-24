import { connection } from "next/server";
import { getBandMembers } from "@/lib/backend/members";
import DashboardShell from "../dashboard-shell";
import PageHeader from "../page-header";
import InviteModal from "./invite-modal";
import RemoveMemberButton from "./remove-member-button";
import ConfirmMemberButton from "./confirm-member-button";
import RoleSelect from "./role-select";

export const instant = false;

export default async function MembersPage() {
  await connection();
  const { members, bandId, isAdmin, pendingMembers } = await getBandMembers();
  return (
    <DashboardShell active="Members">
      <PageHeader eyebrow="Band" title="Members" description="Everyone in your band." action={<InviteModal bandId={bandId} />} />

      {isAdmin && pendingMembers.length > 0 && (
        <section className="mt-6 rounded-2xl border border-[#f0d4c5] bg-[#fff8f3] p-4 sm:mt-8 sm:p-5">
          <h2 className="font-semibold text-[#17202a]">Pending confirmations</h2>
          {pendingMembers.map((member) => (
            <div key={member.id} className="mt-3 flex flex-col gap-3 border-t border-[#f0d4c5] pt-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate font-medium text-[#303942]">{member.name}</p>
                <p className="text-[#69727d]">{member.phone}</p>
              </div>
              <ConfirmMemberButton membershipId={member.id} />
            </div>
          ))}
        </section>
      )}

      <section className="mt-6 overflow-hidden rounded-2xl border border-[#e8e1d9] bg-white sm:mt-8">
        <div className="hidden grid-cols-[1.4fr_1fr_0.8fr_2.5rem] gap-4 border-b border-[#eee9e3] px-5 py-3 text-xs font-semibold uppercase tracking-wider text-[#a0a5aa] sm:grid">
          <span>Name</span><span>Phone</span><span>Role</span><span />
        </div>
        {members.length ? members.map((member) => (
          <div key={member.id} className="flex items-center gap-3 border-b border-[#f1ede8] px-4 py-3.5 text-sm last:border-0 sm:grid sm:grid-cols-[1.4fr_1fr_0.8fr_2.5rem] sm:gap-4 sm:px-5 sm:py-4">
            <div className="min-w-0 flex-1 sm:contents">
              <p className="truncate font-medium text-[#303942]">{member.name}</p>
              <p className="truncate text-[#69727d]">{member.phone}</p>
            </div>
            <div className="shrink-0">{isAdmin ? <RoleSelect membershipId={member.id} role={member.role} /> : <span className="capitalize text-[#69727d]">{member.role}</span>}</div>
            <div className="flex w-9 shrink-0 justify-end sm:w-auto">{isAdmin && <RemoveMemberButton membershipId={member.id} name={member.name} />}</div>
          </div>
        )) : <p className="px-5 py-8 text-sm text-[#69727d]">No members found.</p>}
      </section>
    </DashboardShell>
  );
}