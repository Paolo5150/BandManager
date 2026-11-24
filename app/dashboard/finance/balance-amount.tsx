"use client";

export default function BalanceAmount({ cents }: { cents: number }) {
  return <span className={`font-semibold ${cents < 0 ? "text-[#a04420]" : "text-[#24734b]"}`}>{(cents / 100).toFixed(2)}</span>;
}