"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { signup } from "@/lib/backend/signup";
import { createBand } from "@/lib/backend/create-band";
import { login } from "@/lib/backend/login";

type Mode = "signup" | "login";

export default function AuthForm() {
  const [mode, setMode] = useState<Mode>("signup");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isError, setIsError] = useState(false);
  const [userId, setUserId] = useState<string>();
  const [bandName, setBandName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const router = useRouter();
  const isSignup = mode === "signup";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    setIsSubmitting(true);
    setIsError(false);
    setMessage("");

    try {
      const result = isSignup
        ? await signup({
            name: String(formData.get("name") ?? "").trim(),
            phone: String(formData.get("phone") ?? "").trim(),
            password: String(formData.get("password") ?? ""),
          })
        : await login(
            String(formData.get("phone") ?? "").trim(),
            String(formData.get("password") ?? ""),
          );

      if (result.error) {
        setIsError(true);
        setMessage(result.error);
      } else if (result.userId && (isSignup || !result.hasBand)) {
        setUserId(result.userId);
        setDisplayName(isSignup ? String(formData.get("name") ?? "").trim() : "");
        setPhoneNumber(String(formData.get("phone") ?? "").trim());
        setMessage("");
      } else {
        router.push("/dashboard");
      }
    } catch {
      setIsError(true);
      setMessage(isSignup ? "Something went wrong while creating your account." : "Something went wrong while logging in.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleBandSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) return;
    setIsSubmitting(true);
    setIsError(false);
    const result = await createBand(bandName.trim(), userId, displayName, phoneNumber);
    if (result.error) {
      setMessage(result.error);
      setIsError(true);
    } else {
      router.push("/dashboard");
    }
    setIsSubmitting(false);
  }

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setMessage("");
    setIsError(false);
  }

  return (
    <section className="w-full max-w-md">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#ff6b35] text-xl font-bold text-white shadow-lg shadow-orange-200">B</div>
        <span className="text-xl font-semibold tracking-tight text-[#17202a]">BandManager</span>
      </div>
      <div className="rounded-3xl border border-[#e8e1d9] bg-white p-7 shadow-[0_24px_70px_rgba(52,38,24,0.10)] sm:p-9">
        {userId ? (
          <>
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[#ff6b35]">One last step</p>
            <h1 className="text-3xl font-semibold tracking-tight text-[#17202a]">Create your band</h1>
            <p className="mt-2 text-sm leading-6 text-[#69727d]">Give your band a name to get started.</p>
            <form onSubmit={handleBandSubmit} className="mt-7 space-y-5">
              <label className="block text-sm font-medium text-[#303942]">Band name<input value={bandName} onChange={(event) => setBandName(event.target.value)} type="text" placeholder="The Midnight Signals" required className="mt-2 h-12 w-full rounded-xl border border-[#ddd8d1] bg-[#fcfbf9] px-4 text-[#17202a] outline-none focus:border-[#ff6b35] focus:ring-4 focus:ring-orange-100" /></label>
              <button type="submit" disabled={isSubmitting} className="h-12 w-full rounded-xl bg-[#ff6b35] text-sm font-semibold text-white disabled:opacity-60">{isSubmitting ? "Creating band..." : "Create band"}</button>
            </form>
          </>
        ) : <>
        <div className="mb-7">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[#ff6b35]">Your band, together</p>
          <h1 className="text-3xl font-semibold tracking-tight text-[#17202a]">{isSignup ? "Set up your band space" : "Welcome back"}</h1>
          <p className="mt-2 text-sm leading-6 text-[#69727d]">{isSignup ? "Keep rehearsals, gigs, and the whole crew in sync." : "Sign in to keep your band moving forward."}</p>
        </div>
        <div className="mb-7 grid grid-cols-2 rounded-xl bg-[#f5f2ee] p-1" role="tablist">
          {(["signup", "login"] as const).map((tab) => (
            <button key={tab} type="button" onClick={() => switchMode(tab)} role="tab" aria-selected={mode === tab} className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition ${mode === tab ? "bg-white text-[#17202a] shadow-sm" : "text-[#8a929a] hover:text-[#17202a]"}`}>
              {tab === "signup" ? "Sign up" : "Log in"}
            </button>
          ))}
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          {isSignup && <label className="block text-sm font-medium text-[#303942]">Your name<input name="name" type="text" autoComplete="name" placeholder="Alex Morgan" required className="mt-2 h-12 w-full rounded-xl border border-[#ddd8d1] bg-[#fcfbf9] px-4 text-[#17202a] outline-none transition placeholder:text-[#a5aaaf] focus:border-[#ff6b35] focus:ring-4 focus:ring-orange-100" /></label>}
          <label className="block text-sm font-medium text-[#303942]">Phone number<input name="phone" type="tel" autoComplete="tel" placeholder="+1 (555) 000-0000" required className="mt-2 h-12 w-full rounded-xl border border-[#ddd8d1] bg-[#fcfbf9] px-4 text-[#17202a] outline-none transition placeholder:text-[#a5aaaf] focus:border-[#ff6b35] focus:ring-4 focus:ring-orange-100" /></label>
          <label className="block text-sm font-medium text-[#303942]">Password<input name="password" type="password" autoComplete={isSignup ? "new-password" : "current-password"} placeholder="At least 8 characters" minLength={8} required className="mt-2 h-12 w-full rounded-xl border border-[#ddd8d1] bg-[#fcfbf9] px-4 text-[#17202a] outline-none transition placeholder:text-[#a5aaaf] focus:border-[#ff6b35] focus:ring-4 focus:ring-orange-100" /></label>
          <button type="submit" disabled={isSubmitting} className="h-12 w-full rounded-xl bg-[#ff6b35] px-5 text-sm font-semibold text-white shadow-lg shadow-orange-100 transition hover:bg-[#e95a27] focus:outline-none focus:ring-4 focus:ring-orange-200 disabled:cursor-not-allowed disabled:opacity-60">{isSubmitting ? "Creating account..." : isSignup ? "Create my account" : "Log in to BandManager"}</button>
        </form>
        {message && <p className={`mt-5 rounded-xl px-4 py-3 text-sm leading-5 ${isError ? "bg-[#fff4ed] text-[#a04420]" : "bg-[#eefbf4] text-[#24734b]"}`} role="status">{message}</p>}
        </>}
      </div>
      <p className="mt-6 text-center text-xs leading-5 text-[#8a929a]">By continuing, you agree to use BandManager to make great music together.</p>
    </section>
  );
}