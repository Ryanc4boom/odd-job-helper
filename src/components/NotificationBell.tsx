import { Bell } from "lucide-react";
import { Link } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/hooks/useNotifications";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";

export default function NotificationBell() {
  const { user } = useAuth();
  const { items, unread, markAllRead } = useNotifications(user?.id);

  return (
    <Popover onOpenChange={(o) => o && markAllRead()}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-extrabold text-primary-foreground shadow-soft">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 rounded-2xl p-0">
        <div className="border-b border-border px-4 py-3">
          <p className="font-extrabold">Notifications</p>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">You're all caught up 🎉</p>
          ) : (
            items.map((n) => {
              const jobId = n.payload?.job_id as string | undefined;
              const inner = (
                <div className="flex flex-col gap-1 border-b border-border/60 px-4 py-3 transition-smooth hover:bg-muted/50 last:border-b-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-bold leading-snug">{n.title}</p>
                    {!n.read_at && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                  </div>
                  {n.body && <p className="text-xs text-muted-foreground">{n.body}</p>}
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </p>
                </div>
              );
              return jobId ? (
                <Link key={n.id} to={`/jobs/${jobId}`}>{inner}</Link>
              ) : (
                <div key={n.id}>{inner}</div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
