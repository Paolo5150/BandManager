"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition, type ReactNode, type MouseEvent } from "react";

export default function NavigationLink({ href, active, mobile = false, children }: { href: string; active: boolean; mobile?: boolean; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function navigate(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || href === pathname) return;
    event.preventDefault();
    startTransition(() => router.push(href));
  }

  return (
    <a href={href} onClick={navigate} aria-current={active ? "page" : undefined} aria-busy={isPending || undefined} className={`${mobile ? "shrink-0 rounded-lg px-3 py-2" : "rounded-xl px-3 py-3"} inline-flex items-center gap-2 text-sm font-medium transition ${active ? "bg-[#fff1e9] text-[#e95a27]" : "text-[#69727d] hover:bg-[#f8f5f1] hover:text-[#17202a]"} ${isPending ? "opacity-70" : ""}`}>
      {isPending && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current/30 border-t-current" aria-label="Loading" />}
      {children}
    </a>
  );
}