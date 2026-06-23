"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Building2, LifeBuoy } from "lucide-react";

const LINKS = [
  { href: "/workspace", label: "My Matches", icon: LayoutGrid, exact: true },
  { href: "/workspace/profile", label: "Company Profile", icon: Building2, exact: false },
  { href: "/workspace/requests", label: "My Requests", icon: LifeBuoy, exact: false },
];

export function WorkspaceNav({ email }: { email?: string }) {
  const pathname = usePathname();

  return (
    <div className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <nav className="flex flex-wrap gap-1">
          {LINKS.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active ? "bg-sa-green/10 text-sa-green" : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-3 text-sm text-gray-500">
          {email && <span className="hidden sm:inline">{email}</span>}
          <form action="/api/auth/signout" method="post">
            <button type="submit" className="rounded-lg px-3 py-1.5 font-medium text-gray-600 hover:bg-gray-100">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
