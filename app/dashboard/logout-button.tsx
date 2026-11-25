"use client";

import { useState } from "react";
import LoadingSpinner from "./loading-spinner";

export default function LogoutButton({ className = "" }: { className?: string }) {
  const [pending, setPending] = useState(false);

  return (
    <button
      type="submit"
      onClick={() => setPending(true)}
      disabled={pending}
      aria-busy={pending || undefined}
      className={`${className} disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {pending ? <LoadingSpinner label="Logging out..." /> : "Log out"}
    </button>
  );
}