import Link from "next/link";
import { connection } from "next/server";
import { getDashboardData, logout } from "@/lib/backend/dashboard-data";

const navigation = [
  { label: "Overview", href: "/dashboard" },
  { label: "Members", href: "/dashboard/members" },
  { label: "Songlist", href: "/dashboard/songlist" },
  { label: "Sets", href: "/dashboard/sets" },
  { label: "Schedule", href: "/dashboard/schedule" },
  { label: "Finance", href: "/dashboard/finance" },
];

export default async function DashboardPage() {
  await connection();
  const { userName, bandName } = await getDashboardData();

  return (
    <div className="flex min-h-screen bg-[#f8f5f1]">
      <aside className="flex w-64 shrink-0 flex-col border-r border-[#e8e1d9] bg-white px-5 py-6">
        <div className="flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ff6b35] text-lg font-bold text-white shadow-md shadow-orange-100">
            B
          </div>
          <span className="font-semibold tracking-tight text-[#17202a]">BandManager</span>
        </div>

        <nav className="mt-10 flex flex-1 flex-col gap-1" aria-label="Dashboard navigation">
          <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#a0a5aa]">
            Workspace
          </p>
          {navigation.map((item, index) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-xl px-3 py-3 text-sm font-medium transition ${
                index === 0
                  ? "bg-[#fff1e9] text-[#e95a27]"
                  : "text-[#69727d] hover:bg-[#f8f5f1] hover:text-[#17202a]"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-[#eee9e3] px-3 pt-5">
          <p className="text-xs text-[#a0a5aa]">Current band</p>
          <p className="mt-1 truncate text-sm font-semibold text-[#303942]">{bandName}</p>
          <form action={logout}>
            <button
              type="submit"
              className="mt-5 block w-full rounded-xl px-3 py-3 text-left text-sm font-medium text-[#69727d] transition hover:bg-[#f8f5f1] hover:text-[#17202a]"
            >
              Log out
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 px-6 py-8 sm:px-10 lg:px-14">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#ff6b35]">Overview</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#17202a]">Good to see you, {userName}</h1>
          <p className="mt-2 text-sm text-[#69727d]">Your band workspace is ready to take shape.</p>
        </div>
      </main>
    </div>
  );
}