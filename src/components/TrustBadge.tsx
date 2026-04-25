import { trust_grade } from "@/lib/types";

const colors: Record<string, string> = {
  A: "bg-accent text-accent-foreground",
  B: "bg-accent-soft text-accent-foreground border border-accent/30",
  C: "bg-secondary text-secondary-foreground",
  D: "bg-primary-soft text-foreground border border-primary/30",
  F: "bg-destructive/15 text-destructive border border-destructive/30",
};

export default function TrustBadge({ grade }: { grade: trust_grade }) {
  return (
    <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-extrabold ${colors[grade] ?? colors.C}`} title={`Trust grade ${grade}`}>
      {grade}
    </span>
  );
}
