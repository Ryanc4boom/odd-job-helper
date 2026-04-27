import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  /** Average score 0–5. Pass null/undefined for "no ratings yet". */
  score?: number | null;
  /** How many ratings have been collected. 0 (or undefined) → "No ratings yet". */
  count?: number | null;
  size?: number;
  /** Compact: only stars + small number, no "(N)" / fallback label expansion. */
  compact?: boolean;
  /** Override the empty-state label. */
  emptyLabel?: string;
  className?: string;
};

export default function StarRating({
  score,
  count,
  size = 14,
  compact = false,
  emptyLabel = "No ratings yet",
  className,
}: Props) {
  const hasRatings = (count ?? 0) > 0 && typeof score === "number";

  if (!hasRatings) {
    return (
      <span className={cn("inline-flex items-center gap-1 text-xs text-muted-foreground", className)}>
        <Star size={size} className="text-muted-foreground/60" />
        <span className="font-semibold">{emptyLabel}</span>
      </span>
    );
  }

  const rounded = Math.round(score!);
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span className="inline-flex">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            size={size}
            className={cn(
              i <= rounded ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"
            )}
          />
        ))}
      </span>
      <span className="text-xs font-bold">
        {score!.toFixed(1)}
        {!compact && count != null && (
          <span className="ml-1 font-normal text-muted-foreground">({count})</span>
        )}
      </span>
    </span>
  );
}
