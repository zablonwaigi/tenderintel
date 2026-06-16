import { cn } from "@/lib/utils";

export function Sidebar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <aside
      className={cn(
        "w-full shrink-0 rounded-xl border border-gray-200 bg-white p-5 md:w-64",
        className
      )}
    >
      {children}
    </aside>
  );
}
