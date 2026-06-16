"use client";

import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export function SearchInput({
  value,
  onChange,
  onSubmit,
  placeholder = "Search tenders…",
  className,
  name,
  defaultValue,
}: {
  value?: string;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
  placeholder?: string;
  className?: string;
  name?: string;
  defaultValue?: string;
}) {
  return (
    <div className={cn("relative w-full", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
      <input
        type="search"
        name={name}
        value={value}
        defaultValue={defaultValue}
        onChange={(e) => onChange?.(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && onSubmit) {
            onSubmit((e.target as HTMLInputElement).value);
          }
        }}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-300 bg-white py-3 pl-11 pr-4 text-gray-900 shadow-sm outline-none focus:border-sa-green focus:ring-2 focus:ring-sa-green/20"
      />
    </div>
  );
}
