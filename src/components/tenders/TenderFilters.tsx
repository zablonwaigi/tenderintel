"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { STATUSES, PROVINCES } from "@/lib/utils";

export function TenderFilters({ categories }: { categories: string[] }) {
  const router = useRouter();
  const params = useSearchParams();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    router.push(`/tenders?${next.toString()}`);
  }

  const current = (key: string) => params.get(key) ?? "";

  return (
    <div className="space-y-6">
      <FilterGroup label="Status">
        <RadioOption
          name="status"
          label="All"
          checked={current("status") === ""}
          onChange={() => setParam("status", "")}
        />
        {STATUSES.map((s) => (
          <RadioOption
            key={s.value}
            name="status"
            label={s.label}
            checked={current("status") === s.value}
            onChange={() => setParam("status", s.value)}
          />
        ))}
      </FilterGroup>

      <FilterGroup label="Province">
        <select
          value={current("province")}
          onChange={(e) => setParam("province", e.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-sa-green"
        >
          <option value="">All provinces</option>
          {PROVINCES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </FilterGroup>

      {categories.length > 0 && (
        <FilterGroup label="Category">
          <select
            value={current("category")}
            onChange={(e) => setParam("category", e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-sa-green"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </FilterGroup>
      )}
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </h4>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function RadioOption({
  name,
  label,
  checked,
  onChange,
}: {
  name: string;
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 accent-sa-green"
      />
      {label}
    </label>
  );
}
