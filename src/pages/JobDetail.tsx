import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Header from "@/components/Header";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import TrustBadge from "@/components/TrustBadge";
import { categoryMeta } from "@/lib/categories";
import { formatSchedule, scheduleBadgeStyle } from "@/lib/schedule";
import type { Job, JobRequest, Profile } from "@/lib/types";
import { ArrowLeft, CheckCircle2, Clock, DollarSign, HandHeart, Lock, MapPin, Navigation, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function JobDetail() {
  const { id } = useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [job, setJob] = useState<Job | null>(null);
  const [poster, setPoster] = useState<Profile | null>(null);
  const [myRequest, setMyRequest] = useState<JobRequest | null>(null);
  const [requests, setRequests] = useState<JobRequest[]>([]);
  const [doerProfiles, setDoerProfiles] = useState<Record<string, Profile>>({});
  const [exact, setExact] = useState<{ address_exact: string; exact_lat: number; exact_lng: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const isPoster = user && job && user.id === job.poster_id;
  const isAcceptedDoer = !!myRequest && myRequest.status === "accepted";

  useEffect(() => { if (!authLoading && !user) navigate("/auth"); }, [authLoading, user, navigate]);

  const load = async () => {
    if (!user || !id) return;
    setLoading(true);
    const { data: jobRow } = await supabase.from("jobs_public" as any).select("*").eq("id", id).maybeSingle();
    if (!jobRow) { setLoading(false); return; }
    setJob(jobRow as any);

    const { data: posterRow } = await supabase.from("profiles").select("*").eq("id", (jobRow as any).poster_id).maybeSingle();
    setPoster(posterRow as any);

    const { data: reqs } = await supabase.from("job_requests").select("*").eq("job_id", id);
    const list = (reqs as any as JobRequest[]) ?? [];
    setRequests(list);
    setMyRequest(list.find((r) => r.doer_id === user.id) ?? null);

    const doerIds = list.map((r) => r.doer_id);
    if (doerIds.length) {
      const { data: profs } = await supabase.from("profiles").select("*").in("id", doerIds);
      const map: Record<string, Profile> = {};
      ((profs as any as Profile[]) ?? []).forEach((p) => { map[p.id] = p; });
      setDoerProfiles(map);
    }

    // Try fetching exact location — RLS in the SECURITY DEFINER fn enforces access
    const { data: exactRow } = await supabase.rpc("get_job_exact_location", { _job_id: id });
    if (exactRow && exactRow[0]) setExact(exactRow[0] as any);
    else setExact(null);

    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id, id]);

  // Realtime: refresh on request changes
  useEffect(() => {
    if (!id) return;
    const ch = supabase.channel(`job-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "job_requests", filter: `job_id=eq.${id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, [id, user?.id]);

  const requestToHelp = async () => {
    if (!user || !job) return;
    setActing(true);
    try {
      const { error } = await supabase.from("job_requests").insert({
        job_id: job.id, doer_id: user.id, poster_id: job.poster_id, status: "pending",
      });
      if (error) throw error;
      // Notify poster
      await supabase.from("notifications").insert({
        recipient_id: job.poster_id,
        type: "request_received",
        title: "Someone wants to help!",
        body: `A neighbor offered to help with "${job.title}".`,
        payload: { job_id: job.id },
      });
      toast.success("Request sent! The poster will review your profile.");
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Could not send request");
    } finally { setActing(false); }
  };

  const accept = async (request: JobRequest) => {
    if (!job) return;
    setActing(true);
    try {
      const { error } = await supabase.from("job_requests").update({ status: "accepted" }).eq("id", request.id);
      if (error) throw error;
      await supabase.from("jobs").update({ accepted_doer_id: request.doer_id, doer_id: request.doer_id, status: "in_progress" }).eq("id", job.id);
      // Decline other pending requests
      await supabase.from("job_requests").update({ status: "declined" }).eq("job_id", job.id).neq("id", request.id).eq("status", "pending");
      // Notify the worker
      await supabase.from("notifications").insert({
        recipient_id: request.doer_id,
        type: "request_accepted",
        title: "You're in! 🎉",
        body: `Your request for "${job.title}" was accepted. The address is now visible.`,
        payload: { job_id: job.id },
      });
      toast.success("Helper accepted — address is now shared with them.");
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Could not accept");
    } finally { setActing(false); }
  };

  const decline = async (request: JobRequest) => {
    setActing(true);
    try {
      await supabase.from("job_requests").update({ status: "declined" }).eq("id", request.id);
      load();
    } finally { setActing(false); }
  };

  if (loading || !job) {
    return (
      <div className="min-h-screen bg-background"><Header /><div className="container py-10"><p className="text-muted-foreground">Loading…</p></div></div>
    );
  }

  const meta = categoryMeta(job.category);
  const Icon = meta.icon;
  const pendingForPoster = requests.filter((r) => r.status === "pending");

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container max-w-3xl py-8">
        <Link to="/feed" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to feed
        </Link>

        <Card className="rounded-3xl border-border/60 p-6 shadow-card md:p-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: `${meta.color}1a` }}>
                <Icon className="h-7 w-7" style={{ color: meta.color }} />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold md:text-3xl">{job.title}</h1>
                <p className="text-sm text-muted-foreground">{meta.label}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 rounded-full bg-accent-soft px-3 py-1.5 text-base font-extrabold text-accent-foreground">
              <DollarSign className="h-4 w-4" />{Number(job.budget).toFixed(0)}
            </div>
          </div>

          <p className="mt-5 whitespace-pre-wrap text-[15px] text-foreground/90">{job.description}</p>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold", scheduleBadgeStyle(job.schedule_window))}>
              <Clock className="h-3.5 w-3.5" />{formatSchedule(job.scheduled_for, job.schedule_window)}
            </span>
            {job.location_text && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-sm">
                <MapPin className="h-3.5 w-3.5" />{job.location_text}
              </span>
            )}
          </div>

          {/* Address area — visible only when allowed */}
          {exact ? (
            <div className="mt-6 rounded-2xl border-2 border-accent/40 bg-accent-soft p-5">
              <div className="flex items-center gap-2 text-sm font-extrabold text-accent-foreground">
                <ShieldCheck className="h-4 w-4" /> Exact address
              </div>
              <p className="mt-1 text-base font-semibold">{exact.address_exact}</p>
              {!isPoster && (
                <Button asChild className="mt-4 h-12 w-full rounded-2xl text-base" size="lg">
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${exact.exact_lat}&mlon=${exact.exact_lng}#map=18/${exact.exact_lat}/${exact.exact_lng}`}
                    target="_blank" rel="noreferrer"
                  >
                    <Navigation className="mr-2 h-4 w-4" /> Start navigation
                  </a>
                </Button>
              )}
            </div>
          ) : (
            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
              <Lock className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Exact address is hidden. {isPoster ? "It will be shared with the helper you accept." : "It will be shared with you once the poster accepts your request."}</p>
            </div>
          )}

          {/* Poster from worker's perspective */}
          {!isPoster && poster && (
            <div className="mt-6 flex items-center gap-3 rounded-2xl border border-border p-4">
              <Avatar className="h-12 w-12">
                <AvatarImage src={poster.avatar_url ?? undefined} />
                <AvatarFallback>{poster.display_name?.[0]?.toUpperCase() ?? "?"}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-extrabold">{poster.display_name ?? "Neighbor"}</p>
                <p className="text-xs text-muted-foreground">Posted by</p>
              </div>
              <TrustBadge grade={poster.trust_grade} />
            </div>
          )}

          {/* Worker actions */}
          {!isPoster && (
            <div className="mt-6">
              {!myRequest && job.status === "open" && (
                <>
                  <div className="mb-3 flex items-start gap-3 rounded-2xl bg-secondary/60 p-3 text-xs">
                    <HandHeart className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    <p className="text-secondary-foreground">Your Trust Grade and profile are shared with the poster — be the kind of neighbor you'd want to hire.</p>
                  </div>
                  <Button onClick={requestToHelp} disabled={acting} className="h-14 w-full rounded-2xl text-base" size="lg">
                    <HandHeart className="mr-2 h-5 w-5" /> Request to help
                  </Button>
                </>
              )}
              {myRequest?.status === "pending" && (
                <div className="rounded-2xl bg-primary-soft p-4 text-center text-sm font-bold text-primary">
                  ⏳ Request sent — waiting for the poster to review your profile.
                </div>
              )}
              {myRequest?.status === "accepted" && (
                <div className="rounded-2xl bg-accent-soft p-4 text-center text-sm font-bold text-accent-foreground">
                  <CheckCircle2 className="mx-auto mb-1 h-5 w-5" />
                  You were accepted! Use the address above to start navigation.
                </div>
              )}
              {myRequest?.status === "declined" && (
                <div className="rounded-2xl bg-muted p-4 text-center text-sm text-muted-foreground">
                  This time the poster picked someone else. Plenty more jobs in the feed!
                </div>
              )}
            </div>
          )}

          {/* Poster actions: pending requests with worker profiles */}
          {isPoster && (
            <div className="mt-6">
              <h2 className="mb-3 text-lg font-extrabold">
                Requests {requests.length > 0 && <span className="text-muted-foreground">({pendingForPoster.length} pending)</span>}
              </h2>
              {requests.length === 0 ? (
                <p className="text-sm text-muted-foreground">No requests yet. We'll notify you as soon as a neighbor offers to help.</p>
              ) : (
                <div className="space-y-3">
                  {requests.map((r) => {
                    const p = doerProfiles[r.doer_id];
                    return (
                      <div key={r.id} className="rounded-2xl border border-border p-4">
                        <div className="flex items-start gap-3">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={p?.avatar_url ?? undefined} />
                            <AvatarFallback>{p?.display_name?.[0]?.toUpperCase() ?? "?"}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-extrabold">{p?.display_name ?? "Neighbor"}</p>
                              {p && <TrustBadge grade={p.trust_grade} />}
                            </div>
                            <p className="mt-0.5 text-xs text-muted-foreground">{p?.jobs_completed ?? 0} jobs completed</p>
                            {p?.bio && <p className="mt-2 text-sm text-foreground/80">{p.bio}</p>}
                          </div>
                          <span className={cn(
                            "rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide",
                            r.status === "pending" && "bg-primary-soft text-primary",
                            r.status === "accepted" && "bg-accent text-accent-foreground",
                            r.status === "declined" && "bg-muted text-muted-foreground",
                          )}>{r.status}</span>
                        </div>
                        {r.status === "pending" && (
                          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                            <Button onClick={() => accept(r)} disabled={acting} className="h-12 flex-1 rounded-xl text-base">
                              <CheckCircle2 className="mr-2 h-4 w-4" /> Accept & share address
                            </Button>
                            <Button onClick={() => decline(r)} disabled={acting} variant="outline" className="h-12 rounded-xl">
                              Decline
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
