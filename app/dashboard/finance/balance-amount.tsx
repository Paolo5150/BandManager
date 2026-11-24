"use client";

export default function BalanceAmount({ cents }: { cents: number }) {
  return <span className={`shrink-0 font-semibold tabular-nums ${cents < 0 ? "text-[#a04420]" : "text-[#24734b]"}`}>{cents < 0 ? "-$" : "$"}{Math.abs(cents / 100).toFixed(2)}</span>;
}