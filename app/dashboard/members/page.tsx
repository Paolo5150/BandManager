import Link from "next/link";
import { connection } from "next/server";
import { getBandMembers } from "@/lib/backend/members";
import InviteModal from "./invite-modal";

export const instant = false;

const navigation = ["Overview", "Members", "Songlist", "Sets", "Schedule", "Finance"];

export default async function MembersPage() {
  await connection();
  const { members, bandId } = await getBandMembers();
  return <div className="flex min-h-screen bg-[#f8f5f1]"><aside className="flex w-64 shrink-0 flex-col border-r border-[#e8e1d9] bg-white px-5 py-6"><div className="flex items-center gap-3 px-2"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ff6b35] text-lg font-bold text-white">B</div><span className="font-semibold tracking-tight text-[#17202a]">BandManager</span></div><nav className="mt-10 flex flex-1 flex-col gap-1" aria-label="Dashboard navigation"><p className="mb-3 px-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#a0a5aa]">Workspace</p>{navigation.map((label) => <Link key={label} href={label === "Overview" ? "/dashboard" : `/dashboard/${label.toLowerCase()}`} className={`rounded-xl px-3 py-3 text-sm font-medium ${label === "Members" ? "bg-[#fff1e9] text-[#e95a27]" : "text-[#69727d] hover:bg-[#f8f5f1]"}`}>{label}</Link>)}</nav></aside><main className="flex-1 px-6 py-8 sm:px-10 lg:px-14"><div className="mx-auto max-w-5xl"><div className="flex items-end justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#ff6b35]">Band</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#17202a]">Members</h1><p className="mt-2 text-sm text-[#69727d]">Everyone in your band.</p></div><InviteModal bandId={bandId} /></div><div className="mt-8 overflow-hidden rounded-2xl border border-[#e8e1d9] bg-white"><div className="grid grid-cols-[1.4fr_1fr_0.7fr] border-b border-[#eee9e3] px-5 py-3 text-xs font-semibold uppercase tracking-wider text-[#a0a5aa]"><span>Name</span><span>Phone</span><span>Role</span></div>{members.length ? members.map((member) => <div key={member.id} className="grid grid-cols-[1.4fr_1fr_0.7fr] items-center border-b border-[#f1ede8] px-5 py-4 text-sm last:border-0"><span className="font-medium text-[#303942]">{member.name}</span><span className="text-[#69727d]">{member.phone}</span><span className="capitalize text-[#69727d]">{member.role}</span></div>) : <p className="px-5 py-8 text-sm text-[#69727d]">No members found.</p>}</div></div></main></div>;
}