"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { SearchInput } from "@/components/ui/SearchInput";

export function TenderSearch({ placeholder }: { placeholder?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");

  function submit(q: string) {
    const next = new URLSearchParams(params.toString());
    if (q) next.set("q", q);
    else next.delete("q");
    next.delete("page");
    router.push(`/tenders?${next.toString()}`);
  }

  return (
    <SearchInput
      value={value}
      onChange={setValue}
      onSubmit={submit}
      placeholder={placeholder ?? "Search tenders by keyword, department, description…"}
    />
  );
}
