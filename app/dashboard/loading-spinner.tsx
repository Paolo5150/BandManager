export default function LoadingSpinner({ label = "Loading" }: { label?: string }) {
  return <span className="inline-flex items-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" aria-hidden="true" /><span>{label}</span></span>;
}