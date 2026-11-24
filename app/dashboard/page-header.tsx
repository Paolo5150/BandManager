import type { ReactNode } from "react";

export default function PageHeader({ eyebrow, title, description, action, children }: { eyebrow: string; title: string; description?: ReactNode; action?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#ff6b35] sm:text-sm">{eyebrow}</p>
        <h1 className="mt-1.5 break-words text-2xl font-semibold tracking-tight text-[#17202a] sm:mt-2 sm:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-[#69727d] sm:mt-2">{description}</p>}
        {children}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}