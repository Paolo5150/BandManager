"use client";

import { useFormStatus } from "react-dom";
import LoadingSpinner from "./loading-spinner";
import { LogoutIcon } from "./icons";

export default function LogoutButton({ className = "", iconOnly = false }: { className?: string; iconOnly?: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      onClick={(event) => {
        if (!window.confirm("Are you sure you want to log out?")) event.preventDefault();
      }}
      disabled={pending}
      aria-busy={pending || undefined}
      aria-label={iconOnly ? "Log out" : undefined}
      className={`${className} disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {pending ? <LoadingSpinner label="Logging out..." /> : iconOnly ? <LogoutIcon className="h-5 w-5" /> : "Log out"}
    </button>
  );
}