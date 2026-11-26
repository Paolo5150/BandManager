"use client";

import { useFormStatus } from "react-dom";
import LoadingSpinner from "./loading-spinner";

export default function LogoutButton({ className = "" }: { className?: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending || undefined}
      className={`${className} disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {pending ? <LoadingSpinner label="Logging out..." /> : "Log out"}
    </button>
  );
}