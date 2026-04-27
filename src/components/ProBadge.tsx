import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ProBadge({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground font-extrabold shadow-soft",
        compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
        className
      )}
      title="Pro Helper — top-rated neighbor"
    >
      <Sparkles className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
      PRO
    </span>
  );
}
