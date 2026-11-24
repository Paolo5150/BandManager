import Link from "next/link";
import type { ReactNode } from "react";
import { logout } from "@/lib/backend/dashboard-data";

const navigation = [
  { label: "Overview", href: "/dashboard" },
  { label: "Members", href: "/dashboard/members" },
  { label: "Songlist", href: "/dashboard/songlist" },
  { label: "Sets", href: "/dashboard/sets" },
  { label: "Schedule", href: "/dashboard/schedule" },
  { label: "Finance", href: "/dashboard/finance" },
];

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ff6b35] text-base font-bold text-white">B</div>
      <span className="font-semibold tracking-tight text-[#17202a]">BandManager</span>
    </div>
  );
}

/** Shared dashboard layout: desktop sidebar + sticky mobile top bar. */
export default function DashboardShell({ active, wide = false, children }: { active: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className="flex min-h-screen w-full bg-[#f8f5f1]">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-[#e8e1e9] bg-white px-5 py-6 md:flex">
        <Logo />
        <nav className="mt-10 flex flex-1 flex-col gap-1" aria-label="Dashboard navigation">
          <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#a0a5aa]">Workspace</p>
          {navigation.map((item) => (
            <Link key={item.href} href={item.href} aria-current={item.label === active ? "page" : undefined} className={`rounded-xl px-3 py-3 text-sm font-medium transition ${item.label === active ? "bg-[#fff1e9] text-[#e95a27]" : "text-[#69727d] hover:bg-[#f8f5f1] hover:text-[#17202a]"}`}>
              {item.label}
            </Link>
          ))}
        </nav>
        <form action={logout} className="border-t border-[#eee9e3] pt-4">
          <button type="submit" className="w-full rounded-xl px-3 py-3 text-left text-sm font-medium text-[#69727d] transition hover:bg-[#f8f5f1] hover:text-[#17202a]">Log out</button>
        </form>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-[#e8e1e9] bg-white/95 backdrop-blur md:hidden">
          <div className="flex items-center justify-between px-4 pt-3">
            <Logo />
            <form action={logout}>
              <button type="submit" className="rounded-lg px-2 py-1.5 text-sm font-medium text-[#69727d] hover:bg-[#f8f5f1]">Log out</button>
            </form>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Mobile dashboard navigation">
            {navigation.map((item) => (
              <Link key={item.href} href={item.href} aria-current={item.label === active ? "page" : undefined} className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium ${item.label === active ? "bg-[#fff1e9] text-[#e95a27]" : "text-[#69727d]"}`}>
                {item.label}
              </Link>
            ))}
          </nav>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8 lg:px-12">
          <div className={`mx-auto w-full min-w-0 ${wide ? "max-w-6xl" : "max-w-5xl"}`}>{children}</div>
        </main>
      </div>
    </div>
  );
}