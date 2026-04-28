import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Header from "@/components/Header";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import TrustBadge from "@/components/TrustBadge";
import ProBadge from "@/components/ProBadge";
import { categoryMeta } from "@/lib/categories";
import { formatTimeRemaining, expirationLevel, countdownBadgeClass } from "@/lib/expiration";
import { durationLabel } from "@/lib/duration";
import type { Job, JobRequest, Profile, AIVerification, DoerRestriction } from "@/lib/types";
import {
  ArrowLeft, BadgeCheck, Camera, CheckCircle2, Clock, DollarSign, Dumbbell, HandHeart, Hourglass,
  Lock, MapPin, Navigation, ShieldAlert, ShieldCheck, Sparkles, Sun, Timer, Wrench, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function formatRemaining(targetIso: string): string {
  const ms = Math.max(0, new Date(targetIso).getTime() - Date.now());
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${h}h ${m}m ${s}s`;
}

export default function JobDetail() {
  const { id } = useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [job, setJob] = useState<Job | null>(null);
  const [poster, setPoster] = useState<Profile | null>(null);
  const [myProfile, setMyProfile] = useState<Profile | null>(null);
  const [myRequest, setMyRequest] = useState<JobRequest | null>(null);
  const [requests, setRequests] = useState<JobRequest[]>([]);
  const [doerProfiles, setDoerProfiles] = useState<Record<string, Profile>>({});
  const [exact, setExact] = useState<{ address_exact: string; exact_lat: number; exact_lng: number } | null>(null);
  const [restriction, setRestriction] = useState<DoerRestriction | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [tick, setTick] = useState(0);
  const beforeInputRef = useRef<HTMLInputElement>(null);
  const afterInputRef = useRef<HTMLInputElement>(null);

  const isPoster = user && job && user.id === job.poster_id;
  const isAcceptedDoer = !!myRequest && myRequest.status === "accepted";

  useEffect(() => { if (!authLoading && !user) navigate("/auth"); }, [authLoading, user, navigate]);

  // Live ticker for restriction countdown
  useEffect(() => {
    if (!restriction?.restricted) return;
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [restriction?.restricted]);

  const load = async () => {
    if (!user || !id) return;
    setLoading(true);
    const { data: jobRow } = await supabase.from("jobs_public" as any).select("*").eq("id", id).maybeSingle();
    if (!jobRow) { setLoading(false); return; }
    setJob(jobRow as any);

    const { data: posterRow } = await supabase.from("profiles").select("*").eq("id", (jobRow as any).poster_id).maybeSingle();
    setPoster(posterRow as any);

    const { data: meRow } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    setMyProfile(meRow as any);

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

    const { data: exactRow } = await supabase.rpc("get_job_exact_location", { _job_id: id });
    if (exactRow && exactRow[0]) setExact(exactRow[0] as any);
    else setExact(null);

    // Worker restriction status
    const { data: rest } = await supabase.rpc("get_doer_restriction", { _doer_id: user.id });
    if (rest && rest[0]) setRestriction(rest[0] as any);

    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id, id]);

  useEffect(() => {
    if (!id) return;
    const ch = supabase.channel(`job-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "job_requests", filter: `job_id=eq.${id}` }, () => load())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "jobs", filter: `id=eq.${id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, [id, user?.id]);

  const requestToHelp = async () => {
    if (!user || !job) return;
    if (job.pro_only && !myProfile?.is_pro_helper) {
      toast.error("This job is reserved for Pro Helpers.");
      return;
    }
    if (restriction?.restricted) {
      toast.error("Your account is temporarily restricted from accepting jobs.");
      return;
    }
    setActing(true);
    try {
      const { error } = await supabase.from("job_requests").insert({
        job_id: job.id, doer_id: user.id, poster_id: job.poster_id, status: "pending",
      });
      if (error) throw error;
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
      await supabase.from("job_requests").update({ status: "declined" }).eq("job_id", job.id).neq("id", request.id).eq("status", "pending");
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

  // Worker cancels an accepted job — counts toward shadow-ban streak
  const workerCancel = async () => {
    if (!user || !job || !myRequest) return;
    if (!confirm("Cancel this accepted job? Multiple cancellations may temporarily restrict your access.")) return;
    setActing(true);
    try {
      await supabase.from("cancellations").insert({ doer_id: user.id, job_id: job.id });
      await supabase.from("job_requests").update({ status: "withdrawn" }).eq("id", myRequest.id);
      await supabase.from("jobs").update({ status: "open", accepted_doer_id: null, doer_id: null, started_at: null }).eq("id", job.id);
      toast.error("Job cancelled. Repeated cancellations restrict access for 48 hrs.");
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Could not cancel");
    } finally { setActing(false); }
  };

  // Photo upload helpers
  const uploadPhoto = async (file: File, kind: "before" | "after") => {
    if (!job || !user) return;
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${job.id}/${kind}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("job-photos").upload(path, file, { upsert: false });
    if (upErr) { toast.error(upErr.message); return; }
    const updates: any = kind === "before"
      ? { before_photo_url: path, started_at: new Date().toISOString() }
      : { after_photo_url: path, finished_at: new Date().toISOString() };
    const { error: updErr } = await supabase.from("jobs").update(updates).eq("id", job.id);
    if (updErr) { toast.error(updErr.message); return; }
    toast.success(kind === "before" ? "Before photo uploaded — timer started!" : "After photo uploaded — awaiting poster review.");

    if (kind === "after") {
      // Trigger AI verification (non-blocking for the worker — they wait for poster)
      setVerifying(true);
      try {
        const { data, error } = await supabase.functions.invoke("verify-job-photos", { body: { job_id: job.id } });
        if (error) console.warn("AI verify failed:", error);
        else if (data?.verdict) {
          if (data.verdict === "completed" && data.confidence >= 0.7) {
            toast.success("AI verified completion ✓ — poster can approve.");
          } else {
            toast.message("AI review pending — poster will confirm completion.");
          }
        }
        await supabase.from("notifications").insert({
          recipient_id: job.poster_id,
          type: "job_finished",
          title: "Job marked complete",
          body: `Your helper finished "${job.title}". Review the photos and approve.`,
          payload: { job_id: job.id },
        });
      } finally {
        setVerifying(false);
        load();
      }
    } else {
      load();
    }
  };

  const approveJob = async () => {
    if (!job) return;
    setActing(true);
    try {
      await supabase.from("jobs").update({ status: "completed", approved_at: new Date().toISOString() }).eq("id", job.id);
      if (job.accepted_doer_id) {
        // Increment doer's jobs_completed, then recompute pro-helper
        const { data: prof } = await supabase.from("profiles").select("jobs_completed").eq("id", job.accepted_doer_id).single();
        const next = (prof?.jobs_completed ?? 0) + 1;
        await supabase.from("profiles").update({ jobs_completed: next }).eq("id", job.accepted_doer_id);
        await supabase.rpc("recompute_pro_helper", { _user_id: job.accepted_doer_id });
        await supabase.from("notifications").insert({
          recipient_id: job.accepted_doer_id,
          type: "job_approved",
          title: "Payment released! 🎉",
          body: `${poster?.display_name ?? "The poster"} approved "${job.title}". Great work!`,
          payload: { job_id: job.id },
        });
      }
      toast.success("Job approved — payment released to helper.");
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Could not approve");
    } finally { setActing(false); }
  };

  const submitDispute = async () => {
    if (!job) return;
    if (disputeReason.trim().length < 10) { toast.error("Please describe the issue (10+ chars)."); return; }
    setActing(true);
    try {
      await supabase.from("jobs").update({
        status: "disputed",
        disputed_at: new Date().toISOString(),
        dispute_reason: disputeReason.trim(),
      }).eq("id", job.id);
      if (job.accepted_doer_id) {
        await supabase.from("notifications").insert({
          recipient_id: job.accepted_doer_id,
          type: "job_disputed",
          title: "Job under review",
          body: `The poster opened a dispute on "${job.title}". Payment is on hold pending admin review.`,
          payload: { job_id: job.id },
        });
      }
      toast.message("Dispute opened — payment frozen, photos flagged for admin review.");
      setDisputeOpen(false);
      setDisputeReason("");
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Could not open dispute");
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

  // Signed URLs for photos
  const photoUrl = (path: string | null) => {
    if (!path) return null;
    const { data } = supabase.storage.from("job-photos").getPublicUrl(path); // bucket is private; we'll sign on the fly below
    return data.publicUrl; // placeholder; we'll request signed URLs in PhotoThumb
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container max-w-3xl py-8">
        <Link to="/feed" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to feed
        </Link>

        {/* Restriction banner (worker only) */}
        {!isPoster && restriction?.restricted && restriction.until_ts && (
          <Card key={tick} className="mb-4 rounded-2xl border-destructive/40 bg-destructive/10 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <div>
                <p className="font-extrabold text-destructive">Access restricted</p>
                <p className="mt-1 text-sm text-foreground/80">
                  You cancelled {restriction.consecutive_count} accepted jobs in a row. You can apply for new jobs again in{" "}
                  <span className="font-bold">{formatRemaining(restriction.until_ts)}</span>.
                </p>
              </div>
            </div>
          </Card>
        )}

        <Card className="rounded-3xl border-border/60 p-6 shadow-card md:p-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: `${meta.color}1a` }}>
                <Icon className="h-7 w-7" style={{ color: meta.color }} />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-extrabold md:text-3xl">{job.title}</h1>
                  {job.pro_only && <ProBadge compact />}
                </div>
                <p className="text-sm text-muted-foreground">{meta.label}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 rounded-full bg-accent-soft px-3 py-1.5 text-base font-extrabold text-accent-foreground">
              <DollarSign className="h-4 w-4" />{Number(job.budget).toFixed(0)}
            </div>
          </div>

          {/* Status banners */}
          {job.status === "disputed" && (
            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <p><span className="font-extrabold text-destructive">Under Review.</span> Payment is frozen. Photos flagged for admin review.</p>
            </div>
          )}
          {job.status === "completed" && (
            <div className="mt-4 flex items-start gap-3 rounded-2xl bg-accent-soft p-4 text-sm">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent-foreground" />
              <p><span className="font-extrabold">Completed & paid.</span></p>
            </div>
          )}

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

          {/* Requirements checklist summary */}
          <div className="mt-5 grid gap-2 rounded-2xl border border-border bg-muted/30 p-4 sm:grid-cols-2">
            <div className="flex items-center gap-2 text-sm"><Hourglass className="h-4 w-4 text-muted-foreground" /><span className="font-bold">Duration:</span> {durationLabel(job.estimated_duration)}</div>
            <div className="flex items-center gap-2 text-sm"><Sun className="h-4 w-4 text-muted-foreground" /><span className="font-bold">Setting:</span> <span className="capitalize">{job.environment}</span></div>
            <div className="flex items-center gap-2 text-sm"><Wrench className="h-4 w-4 text-muted-foreground" /><span className="font-bold">Tools:</span> {job.tools_provided ? "Provided" : "Bring your own"}</div>
            <div className="flex items-center gap-2 text-sm"><Dumbbell className="h-4 w-4 text-muted-foreground" /><span className="font-bold">Heavy lifting:</span> {job.heavy_lifting ? "Yes" : "No"}</div>
          </div>

          {/* Address area */}
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

          {/* Photo evidence section — visible after acceptance */}
          {(isAcceptedDoer || isPoster) && (job.status === "in_progress" || job.status === "completed" || job.status === "disputed") && (
            <div className="mt-6 rounded-2xl border-2 border-primary/30 bg-card p-5">
              <div className="mb-3 flex items-center gap-2">
                <Camera className="h-4 w-4 text-primary" />
                <h3 className="font-extrabold">Photo evidence</h3>
                {job.started_at && (
                  <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-bold text-primary">
                    <Timer className="h-3 w-3" />
                    Started {new Date(job.started_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <PhotoSlot
                  label="Before"
                  path={job.before_photo_url}
                  canUpload={!!isAcceptedDoer && !job.before_photo_url}
                  onPick={() => beforeInputRef.current?.click()}
                />
                <PhotoSlot
                  label="After"
                  path={job.after_photo_url}
                  canUpload={!!isAcceptedDoer && !!job.before_photo_url && !job.after_photo_url}
                  onPick={() => afterInputRef.current?.click()}
                />
              </div>

              <input
                ref={beforeInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0], "before")}
              />
              <input
                ref={afterInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0], "after")}
              />

              {/* AI verification result */}
              {job.ai_verification && (
                <AIVerdict v={job.ai_verification} />
              )}
              {verifying && (
                <p className="mt-3 text-xs text-muted-foreground">AI is reviewing your photos…</p>
              )}

              {/* Worker action prompt */}
              {isAcceptedDoer && !job.before_photo_url && (
                <p className="mt-3 text-xs text-muted-foreground">📸 Upload a "Before" photo to start the job timer.</p>
              )}
              {isAcceptedDoer && job.before_photo_url && !job.after_photo_url && (
                <p className="mt-3 text-xs text-muted-foreground">When you're done, upload an "After" photo to finish the job.</p>
              )}

              {/* Poster approve / dispute */}
              {isPoster && job.after_photo_url && job.status === "in_progress" && (
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <Button onClick={approveJob} disabled={acting} className="h-12 flex-1 rounded-xl text-base">
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Approve & release payment
                  </Button>
                  <Button onClick={() => setDisputeOpen(true)} disabled={acting} variant="outline" className="h-12 rounded-xl border-destructive/40 text-destructive hover:bg-destructive/10">
                    <ShieldAlert className="mr-2 h-4 w-4" /> Dispute
                  </Button>
                </div>
              )}
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
                  {job.pro_only && !myProfile?.is_pro_helper && (
                    <div className="mb-3 flex items-start gap-3 rounded-2xl border border-primary/40 bg-primary-soft p-3 text-xs text-primary">
                      <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0" />
                      <p><span className="font-extrabold">Pro Helpers only.</span> Earn the badge by completing 5+ jobs at 4.5★+ average.</p>
                    </div>
                  )}
                  <div className="mb-3 flex items-start gap-3 rounded-2xl bg-secondary/60 p-3 text-xs">
                    <HandHeart className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    <p className="text-secondary-foreground">Your Trust Grade and profile are shared with the poster — be the kind of neighbor you'd want to hire.</p>
                  </div>
                  <Button
                    onClick={requestToHelp}
                    disabled={acting || (job.pro_only && !myProfile?.is_pro_helper) || !!restriction?.restricted}
                    className="h-14 w-full rounded-2xl text-base"
                    size="lg"
                  >
                    <HandHeart className="mr-2 h-5 w-5" /> Request to help
                  </Button>
                </>
              )}
              {myRequest?.status === "pending" && (
                <div className="rounded-2xl bg-primary-soft p-4 text-center text-sm font-bold text-primary">
                  ⏳ Request sent — waiting for the poster to review your profile.
                </div>
              )}
              {myRequest?.status === "accepted" && job.status === "in_progress" && (
                <div className="mt-3">
                  <Button onClick={workerCancel} variant="outline" className="h-11 w-full rounded-xl border-destructive/40 text-destructive hover:bg-destructive/10" disabled={acting}>
                    Cancel this job
                  </Button>
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
          {isPoster && job.status === "open" && (
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
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-extrabold">{p?.display_name ?? "Neighbor"}</p>
                              {p && <TrustBadge grade={p.trust_grade} />}
                              {p?.is_pro_helper && <ProBadge compact />}
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

      {/* Dispute dialog */}
      <Dialog open={disputeOpen} onOpenChange={setDisputeOpen}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>Open a dispute</DialogTitle>
            <DialogDescription>
              Payment will be frozen and the Before/After photos will be flagged for admin review.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={disputeReason}
            onChange={(e) => setDisputeReason(e.target.value)}
            placeholder="Describe what was wrong with the work…"
            rows={4}
            className="rounded-xl"
            maxLength={500}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisputeOpen(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={submitDispute} disabled={acting} className="rounded-xl bg-destructive hover:bg-destructive/90">
              Submit dispute
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PhotoSlot({ label, path, canUpload, onPick }: { label: string; path: string | null; canUpload: boolean; onPick: () => void }) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!path) { setSignedUrl(null); return; }
    supabase.storage.from("job-photos").createSignedUrl(path, 600).then(({ data }) => {
      if (!cancelled) setSignedUrl(data?.signedUrl ?? null);
    });
    return () => { cancelled = true; };
  }, [path]);

  if (path && signedUrl) {
    return (
      <div className="overflow-hidden rounded-xl border border-border">
        <div className="bg-muted px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</div>
        <img src={signedUrl} alt={`${label} photo`} className="aspect-square w-full object-cover" />
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={canUpload ? onPick : undefined}
      disabled={!canUpload}
      className={cn(
        "flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-sm",
        canUpload ? "border-primary/50 bg-primary-soft/40 text-primary hover:bg-primary-soft" : "border-border bg-muted/30 text-muted-foreground cursor-not-allowed"
      )}
    >
      <Camera className="h-6 w-6" />
      <span className="font-bold">{path ? "Loading…" : `Upload ${label}`}</span>
    </button>
  );
}

function AIVerdict({ v }: { v: AIVerification }) {
  const tone =
    v.verdict === "completed" ? "bg-accent-soft text-accent-foreground border-accent/40" :
    v.verdict === "partial" ? "bg-primary-soft text-primary border-primary/40" :
    v.verdict === "not_completed" ? "bg-destructive/10 text-destructive border-destructive/40" :
    "bg-muted text-muted-foreground border-border";
  return (
    <div className={cn("mt-4 rounded-xl border p-3 text-sm", tone)}>
      <div className="flex items-center gap-2 font-extrabold">
        <Sparkles className="h-4 w-4" />
        AI verdict: <span className="capitalize">{v.verdict.replace("_", " ")}</span>
        <span className="ml-auto text-xs opacity-80">{Math.round((v.confidence ?? 0) * 100)}% confidence</span>
      </div>
      <p className="mt-1 text-xs opacity-90">{v.explanation}</p>
    </div>
  );
}
