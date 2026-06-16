import { cn } from "@/lib/utils";

type Variant = "default" | "green" | "gold" | "red" | "blue" | "gray" | "outline";

const variants: Record<Variant, string> = {
  default: "bg-sa-green/10 text-sa-green",
  green: "bg-sa-green text-white",
  gold: "bg-sa-gold text-black",
  red: "bg-sa-red text-white",
  blue: "bg-sa-blue text-white",
  gray: "bg-gray-100 text-gray-700",
  outline: "border border-gray-300 text-gray-700",
};

export function Badge({
  children,
  variant = "default",
  className,
}: {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

export function statusVariant(status: string): Variant {
  switch (status) {
    case "active":
      return "green";
    case "awarded":
      return "blue";
    case "closed":
      return "gray";
    case "cancelled":
      return "red";
    default:
      return "gray";
  }
}
