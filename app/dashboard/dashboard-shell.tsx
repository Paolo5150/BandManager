import type { ReactNode } from "react";
import { logout } from "@/lib/backend/dashboard-data";
import NavigationLink from "./navigation-link";
import LogoutButton from "./logout-button";
import { navigation } from "./navigation";

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
            <NavigationLink key={item.href} href={item.href} active={item.label === active}>
              {item.label}
            </NavigationLink>
          ))}
        </nav>
        <form action={logout} className="border-t border-[#eee9e3] pt-4">
          <LogoutButton className="w-full rounded-xl px-3 py-3 text-left text-sm font-medium text-[#69727d] transition hover:bg-[#f8f5f1] hover:text-[#17202a]" />
        </form>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-[#e8e1e9] bg-white/95 backdrop-blur md:hidden">
          <div className="flex items-center justify-between px-4 pt-3">
            <Logo />
            <form action={logout}>
              <LogoutButton className="rounded-lg px-2 py-1.5 text-sm font-medium text-[#69727d] hover:bg-[#f8f5f1]" />
            </form>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Mobile dashboard navigation">
            {navigation.map((item) => (
              <NavigationLink key={item.href} href={item.href} active={item.label === active} mobile>
                {item.label}
              </NavigationLink>
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