import { NavLink } from "react-router-dom";
import { Map, PlusCircle, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/feed", label: "Find Jobs", icon: Map },
  { to: "/post", label: "Post a Job", icon: PlusCircle },
  { to: "/account", label: "Account", icon: UserRound },
];

export default function BottomNav() {
  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/60 bg-background/95 backdrop-blur-lg pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around px-2 py-1.5">
        {tabs.map(({ to, label, icon: Icon }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex h-16 flex-col items-center justify-center gap-1 rounded-2xl px-2 text-[11px] font-bold transition-smooth",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-2xl transition-smooth",
                      isActive ? "bg-primary-soft" : ""
                    )}
                  >
                    <Icon
                      className={cn("h-5 w-5", isActive && "text-primary")}
                      strokeWidth={isActive ? 2.5 : 2}
                    />
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
