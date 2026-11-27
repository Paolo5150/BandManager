"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const DISMISSED_KEY = "bandmanager-install-prompt-dismissed";

export default function InstallPrompt() {
  const pathname = usePathname();
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [isDismissed, setIsDismissed] = useState(true);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    const ios = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    setIsIos(ios);
    setIsDismissed(standalone || window.localStorage.getItem(DISMISSED_KEY) === "true");

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstallEvent(null);
      setIsDismissed(true);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    const result = await installEvent.userChoice;
    setInstallEvent(null);
    if (result.outcome === "accepted") setIsDismissed(true);
  }

  function dismiss() {
    window.localStorage.setItem(DISMISSED_KEY, "true");
    setIsDismissed(true);
    setShowIosHelp(false);
  }

  if (!pathname.startsWith("/dashboard") || isDismissed || (!installEvent && !isIos)) return null;

  return <aside aria-label="Install BandManager" className="fixed inset-x-3 bottom-3 z-[60] mx-auto flex max-w-lg items-center gap-3 rounded-2xl border border-[#e8e1e9] bg-white p-3 shadow-xl sm:inset-x-auto sm:bottom-5 sm:right-5">
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#ff6b35] text-xl font-bold text-white">B</div>
    <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-[#17202a]">Install BandManager</p><p className="text-xs text-[#69727d]">Add it to your home screen for quick access.</p>{showIosHelp && <p className="mt-2 text-xs leading-5 text-[#303942]">Tap the Share button in Safari, then choose <b>Add to Home Screen</b>.</p>}</div>
    {installEvent ? <button type="button" onClick={() => void install()} className="min-h-10 shrink-0 rounded-lg bg-[#ff6b35] px-3 text-sm font-semibold text-white">Install</button> : <button type="button" onClick={() => setShowIosHelp(true)} className="min-h-10 shrink-0 rounded-lg bg-[#fff1e9] px-3 text-sm font-semibold text-[#a04420]">How to</button>}
    <button type="button" onClick={dismiss} aria-label="Dismiss install suggestion" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xl text-[#69727d] hover:bg-[#f5f2ee]">×</button>
  </aside>;
}