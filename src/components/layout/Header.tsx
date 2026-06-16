import Link from "next/link";
import { FileSearch } from "lucide-react";

const NAV = [
  { href: "/tenders", label: "Tenders" },
  { href: "/wiki", label: "Wiki" },
  { href: "/learn", label: "Learn" },
  { href: "/dashboard", label: "Dashboard" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sa-green text-white">
            <FileSearch className="h-5 w-5" />
          </span>
          <span className="text-lg font-bold tracking-tight text-gray-900">
            Tender<span className="text-sa-green">Intel</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-sa-green"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
