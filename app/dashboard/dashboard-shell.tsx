import type { ReactNode } from "react";
import Link from "next/link";
import { logout } from "@/lib/backend/dashboard-data";
import NavigationLink from "./navigation-link";
import LogoutButton from "./logout-button";
import { navigation } from "./navigation";
import InstallPrompt from "../install-prompt";
import { AccountIcon } from "./icons";

const APP_VERSION = "1.1.2"; // TODO: dynamically get this from package.json or environment variable

function Logo() {

  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ff6b35] text-base font-bold text-white">
        B
      </div>
      <div className="flex flex-col">
        <span className="font-semibold tracking-tight text-[#17202a]">
          BandManager
        </span>
        <span className="text-[10px] text-gray-400">
          {APP_VERSION}
        </span>
      </div>
    </div>
  );
}

/** Shared dashboard layout: desktop sidebar + sticky mobile top bar. */
export default function DashboardShell({ active, wide = false, children }: { active: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className="flex min-h-screen w-full bg-[#f8f5f1]">
      <InstallPrompt />
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
        <div className="border-t border-[#eee9e3] pt-4">
          <Link href="/dashboard/account" aria-current={active === "Account" ? "page" : undefined} className={`mb-1 flex items-center gap-2 rounded-xl px-3 py-3 text-sm font-medium transition ${active === "Account" ? "bg-[#fff1e9] text-[#e95a27]" : "text-[#69727d] hover:bg-[#f8f5f1] hover:text-[#17202a]"}`}>
            <AccountIcon className="h-5 w-5" />
            Account
          </Link>
          <form action={logout}>
            <LogoutButton className="w-full rounded-xl px-3 py-3 text-left text-sm font-medium text-[#69727d] transition hover:bg-[#f8f5f1] hover:text-[#17202a]" />
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-[#e8e1e9] bg-white/95 backdrop-blur md:hidden">
          <div className="flex items-center justify-between px-4 pt-3">
            <Logo />
            <div className="flex items-center gap-1">
              <Link href="/dashboard/account" aria-label="Account" title="Account" aria-current={active === "Account" ? "page" : undefined} className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${active === "Account" ? "bg-[#fff1e9] text-[#e95a27]" : "text-[#69727d] hover:bg-[#f8f5f1] hover:text-[#17202a]"}`}>
                <AccountIcon className="h-5 w-5" />
              </Link>
              <form action={logout}>
                <LogoutButton iconOnly className="flex h-10 w-10 items-center justify-center rounded-xl text-[#69727d] transition hover:bg-[#f8f5f1] hover:text-[#17202a]" />
              </form>
            </div>
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
          <div className={`mx-auto w-full min-w-0 ${wide ? "max-w-6xl" : "max-w-5xl"}`}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}