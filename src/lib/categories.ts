import { Leaf, Box, Sparkles, Package, Dog, ShoppingBag, Wrench, HelpCircle, type LucideIcon } from "lucide-react";

export type JobCategory = "yardwork" | "moving" | "cleaning" | "delivery" | "pet_care" | "errands" | "assembly" | "other";

export const CATEGORIES: { value: JobCategory; label: string; icon: LucideIcon; color: string }[] = [
  { value: "yardwork", label: "Yardwork", icon: Leaf, color: "hsl(142 60% 45%)" },
  { value: "moving", label: "Moving", icon: Box, color: "hsl(22 92% 56%)" },
  { value: "cleaning", label: "Cleaning", icon: Sparkles, color: "hsl(195 80% 50%)" },
  { value: "delivery", label: "Delivery", icon: Package, color: "hsl(280 65% 55%)" },
  { value: "pet_care", label: "Pet Care", icon: Dog, color: "hsl(35 90% 55%)" },
  { value: "errands", label: "Errands", icon: ShoppingBag, color: "hsl(340 70% 55%)" },
  { value: "assembly", label: "Assembly", icon: Wrench, color: "hsl(220 60% 55%)" },
  { value: "other", label: "Other", icon: HelpCircle, color: "hsl(160 15% 45%)" },
];

export const categoryMeta = (c: JobCategory) => CATEGORIES.find((x) => x.value === c) ?? CATEGORIES[7];
