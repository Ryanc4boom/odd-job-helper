import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Notification } from "@/lib/types";
import { toast } from "sonner";

export function useNotifications(userId: string | undefined) {
  const [items, setItems] = useState<Notification[]>([]);

  useEffect(() => {
    if (!userId) { setItems([]); return; }
    let mounted = true;

    supabase
      .from("notifications")
      .select("*")
      .eq("recipient_id", userId)
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data }) => { if (mounted) setItems((data as any) ?? []); });

    const channel = supabase
      .channel(`notif-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_id=eq.${userId}` },
        (payload) => {
          const n = payload.new as Notification;
          setItems((prev) => [n, ...prev]);
          toast(n.title, { description: n.body ?? undefined });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `recipient_id=eq.${userId}` },
        (payload) => {
          const n = payload.new as Notification;
          setItems((prev) => prev.map((x) => (x.id === n.id ? n : x)));
        }
      )
      .subscribe();

    return () => { mounted = false; supabase.removeChannel(channel); };
  }, [userId]);

  const unread = items.filter((n) => !n.read_at).length;

  const markAllRead = async () => {
    if (!userId) return;
    const ids = items.filter((n) => !n.read_at).map((n) => n.id);
    if (ids.length === 0) return;
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).in("id", ids);
  };

  return { items, unread, markAllRead };
}
