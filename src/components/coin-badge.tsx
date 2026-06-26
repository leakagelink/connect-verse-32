import { Coins } from "lucide-react";
import { cn } from "@/lib/utils";

export function CoinBadge({ value, className }: { value: number | string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full bg-coin/15 px-2.5 py-1 text-xs font-semibold text-coin", className)}>
      <Coins className="size-3.5" />
      {typeof value === "number" ? value.toLocaleString("en-IN") : value}
    </span>
  );
}
