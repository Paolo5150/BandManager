"use client";

import Link, { useLinkStatus } from "next/link";
import type { ReactNode } from "react";

function NavigationContent({ children }: { children: ReactNode }) {
  const { pending } = useLinkStatus();
  return (
    <span aria-busy={pending || undefined} className={`inline-flex items-center gap-2 ${pending ? "opacity-70" : ""}`}>
      {pending && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current/30 border-t-current" aria-label="Loading" />}
      {children}
    </span>
  );
}

export default function NavigationLink({ href, active, mobile = false, children }: { href: string; active: boolean; mobile?: boolean; children: ReactNode }) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={`${mobile ? "shrink-0 rounded-lg px-3 py-2" : "rounded-xl px-3 py-3"} inline-flex items-center gap-2 text-sm font-medium transition ${active ? "bg-[#fff1e9] text-[#e95a27]" : "text-[#69727d] hover:bg-[#f8f5f1] hover:text-[#17202a]"}`}>
      <NavigationContent>{children}</NavigationContent>
    </Link>
  );
}