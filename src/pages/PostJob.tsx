import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CATEGORIES } from "@/lib/categories";
import { DURATION_OPTIONS } from "@/lib/duration";
import { fuzzCoord } from "@/lib/location";
import {
  DURATION_PRESETS_HOURS,
  MIN_CUSTOM_HOURS,
  MAX_CUSTOM_HOURS,
  DEFAULT_DURATION_HOURS,
  formatTimeRemaining,
  countdownBadgeClass,
  expirationLevel,
} from "@/lib/expiration";
import MapboxAddressSearch from "@/components/MapboxAddressSearch";
import { toast } from "sonner";
import { CreditCard, Lock, ShieldAlert, Sparkles, ClipboardCheck, Wrench, Dumbbell, Sun, BadgeCheck, Briefcase, XCircle, Clock, Timer } from "lucide-react";
import { categoryMeta } from "@/lib/categories";
import { cn } from "@/lib/utils";

const schema = z.object({
  title: z.string().trim().min(4, "Add a clear title").max(80),
  description: z.string().trim().min(20, "Tell neighbors what you need (20+ chars)").max(800),
  category: z.string(),
  budget: z.coerce.number().min(0).max(10000),
  address_exact: z.string().trim().min(5, "Pick your exact street address from the dropdown").max(200),
  estimated_duration: z.string().min(1, "Estimate how long the job should take"),
});

export default function PostJob() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [blocked, setBlocked] = useState<{ open: boolean; reason: string }>({ open: false, reason: "" });

  // Listing timer (how long the post stays live on the feed/map)
  const [durationHours, setDurationHours] = useState<number>(DEFAULT_DURATION_HOURS);
  const [useCustomDuration, setUseCustomDuration] = useState(false);
  const [customHours, setCustomHours] = useState<string>(String(DEFAULT_DURATION_HOURS));

  const [form, setForm] = useState({
    title: "", description: "", category: "other", budget: "20",
    address_exact: "",
    estimated_duration: "",
  });
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [toolsProvided, setToolsProvided] = useState(false);
  const [heavyLifting, setHeavyLifting] = useState(false);
  const [environment, setEnvironment] = useState<"indoor" | "outdoor" | "both">("indoor");
  const [proOnly, setProOnly] = useState(false);

  const [myJobs, setMyJobs] = useState<any[]>([]);
  const [cancelTarget, setCancelTarget] = useState<{ id: string; title: string } | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const refreshMyJobs = async (uid: string) => {
    const { data } = await supabase
      .from("jobs")
      .select("id, title, status, budget, expires_at, category, created_at")
      .eq("poster_id", uid)
      .order("created_at", { ascending: false });
    setMyJobs(data ?? []);
  };

  useEffect(() => {
    if (user) refreshMyJobs(user.id);
  }, [user]);

  useEffect(() => {
    supabase.functions.invoke("get-mapbox-token").then(({ data, error }) => {
      if (!error && data?.token) setMapboxToken(data.token);
    });
  }, []);

  const confirmCancel = async () => {
    if (!cancelTarget || !user) return;
    setCancelling(true);
    try {
      const { error } = await supabase
        .from("jobs")
        .update({ status: "cancelled" as any })
        .eq("id", cancelTarget.id)
        .eq("poster_id", user.id);
      if (error) throw error;
      toast.success("Job cancelled");
      setMyJobs((prev) => prev.map((j) => (j.id === cancelTarget.id ? { ...j, status: "cancelled" } : j)));
      setCancelTarget(null);
    } catch (err: any) {
      toast.error(err.message ?? "Could not cancel");
    } finally {
      setCancelling(false);
    }
  };

  // Resolve the chosen listing duration (preset or custom). Returns null if invalid.
  const resolveDurationHours = (): number | null => {
    if (!useCustomDuration) return durationHours;
    const n = Number(customHours);
    if (!Number.isFinite(n) || n < MIN_CUSTOM_HOURS || n > MAX_CUSTOM_HOURS) return null;
    return n;
  };

  if (!authLoading && !user) {
    navigate("/auth");
    return null;
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    const hours = resolveDurationHours();
    if (hours == null) {
      toast.error(`Listing timer must be between ${MIN_CUSTOM_HOURS} and ${MAX_CUSTOM_HOURS} hours`);
      return;
    }
    const expiresAt = new Date(Date.now() + hours * 3600_000);

    setSubmitting(true);
    try {
      const { data: mod, error: modErr } = await supabase.functions.invoke("moderate-job", {
        body: { title: parsed.data.title, description: parsed.data.description },
      });
      if (modErr) throw modErr;
      if (mod?.error) throw new Error(mod.error);
      if (!mod.allowed) { setBlocked({ open: true, reason: mod.reason }); return; }

      if (!selectedCoords) {
        toast.error("Please select your address from the dropdown");
        return;
      }
      const exact = selectedCoords;
      const fuzzed = fuzzCoord(exact.lat, exact.lng, 500);

      const { error: insErr } = await supabase.from("jobs").insert({
        poster_id: user!.id,
        title: parsed.data.title,
        description: parsed.data.description,
        category: (mod.category ?? parsed.data.category) as any,
        budget: parsed.data.budget,
        address_exact: parsed.data.address_exact,
        exact_lat: exact.lat,
        exact_lng: exact.lng,
        location_lat: fuzzed.lat,
        location_lng: fuzzed.lng,
        expires_at: expiresAt.toISOString(),
        tools_provided: toolsProvided,
        heavy_lifting: heavyLifting,
        environment,
        estimated_duration: parsed.data.estimated_duration,
        pro_only: proOnly,
      });
      if (insErr) throw insErr;
      toast.success(`Job posted! It'll stay live for ${formatTimeRemaining(expiresAt.toISOString())}.`);
      navigate("/feed");
    } catch (err: any) {
      toast.error(err.message ?? "Could not post job");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-0">
      <Header />
      <div className="container max-w-2xl py-10">
        <div className="mb-6">
          <h1 className="text-3xl font-extrabold md:text-4xl">Post a job</h1>
          <p className="mt-2 text-muted-foreground">Quick tasks only. Our friendly AI checks every post to keep things safe.</p>
        </div>

        <Card className="rounded-3xl border-border/60 p-6 shadow-card md:p-8">
          <form onSubmit={submit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Help me rake leaves Saturday" maxLength={80} className="h-12 rounded-xl text-base" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">What needs doing?</Label>
              <Textarea id="description" rows={5} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="A few sentences about the task and any tools you have." maxLength={800} className="rounded-xl text-base" />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger className="h-12 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="budget">Budget ($)</Label>
                <Input id="budget" type="number" min={0} max={10000} value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} className="h-12 rounded-xl text-base" />
              </div>
            </div>

            {/* Requirements Checklist */}
            <div className="space-y-4 rounded-2xl border-2 border-dashed border-border bg-muted/30 p-5">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-primary" />
                <Label className="text-base font-extrabold">Requirements checklist</Label>
              </div>
              <p className="-mt-2 text-xs text-muted-foreground">Set clear expectations so helpers come prepared.</p>

              <div className="flex items-center justify-between rounded-xl bg-card p-3">
                <div className="flex items-center gap-3">
                  <Wrench className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-bold">Tools provided?</p>
                    <p className="text-xs text-muted-foreground">{toolsProvided ? "You'll supply tools" : "Helper brings their own"}</p>
                  </div>
                </div>
                <Switch checked={toolsProvided} onCheckedChange={setToolsProvided} />
              </div>

              <div className="flex items-center justify-between rounded-xl bg-card p-3">
                <div className="flex items-center gap-3">
                  <Dumbbell className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-bold">Heavy lifting required?</p>
                    <p className="text-xs text-muted-foreground">{heavyLifting ? "Yes — physical strength needed" : "No heavy lifting"}</p>
                  </div>
                </div>
                <Switch checked={heavyLifting} onCheckedChange={setHeavyLifting} />
              </div>

              <div className="space-y-2 rounded-xl bg-card p-3">
                <div className="flex items-center gap-3">
                  <Sun className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-bold">Indoor or outdoor?</p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(["indoor", "outdoor", "both"] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setEnvironment(opt)}
                      className={cn(
                        "rounded-xl border-2 px-3 py-2 text-xs font-bold capitalize transition-smooth",
                        environment === opt
                          ? "border-primary bg-primary-soft text-primary"
                          : "border-border bg-card hover:border-primary/40"
                      )}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="duration" className="text-sm font-bold">Estimated duration <span className="text-destructive">*</span></Label>
                <Select value={form.estimated_duration} onValueChange={(v) => setForm({ ...form, estimated_duration: v })}>
                  <SelectTrigger id="duration" className="h-12 rounded-xl"><SelectValue placeholder="How long should it take?" /></SelectTrigger>
                  <SelectContent>
                    {DURATION_OPTIONS.map((d) => (
                      <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Pro-only filter */}
            <div className="flex items-start justify-between gap-3 rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary-soft to-accent-soft p-4">
              <div className="flex items-start gap-3">
                <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p className="text-sm font-extrabold">Only allow Pro Helpers to apply</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Pro Helpers have completed 5+ jobs with a 4.5★+ average rating.</p>
                </div>
              </div>
              <Switch checked={proOnly} onCheckedChange={setProOnly} />
            </div>


            {/* Listing timer */}
            <div className="space-y-3 rounded-2xl border-2 border-dashed border-border bg-muted/30 p-5">
              <div className="flex items-center gap-2">
                <Timer className="h-4 w-4 text-primary" />
                <Label className="text-base font-extrabold">How long should this listing stay active?</Label>
              </div>
              <p className="-mt-1 text-xs text-muted-foreground">
                When the timer runs out, your job automatically disappears from the feed and the map.
              </p>

              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {DURATION_PRESETS_HOURS.map((h) => {
                  const active = !useCustomDuration && durationHours === h;
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => { setUseCustomDuration(false); setDurationHours(h); }}
                      className={cn(
                        "rounded-2xl border-2 px-3 py-3 text-sm font-bold transition-smooth",
                        active
                          ? "border-primary bg-primary-soft text-primary shadow-soft"
                          : "border-border bg-card hover:border-primary/40"
                      )}
                    >
                      {h === 24 ? "1 day" : `${h}h`}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setUseCustomDuration(true)}
                  className={cn(
                    "rounded-2xl border-2 px-3 py-3 text-sm font-bold transition-smooth",
                    useCustomDuration
                      ? "border-primary bg-primary-soft text-primary shadow-soft"
                      : "border-border bg-card hover:border-primary/40"
                  )}
                >
                  Custom
                </button>
              </div>

              {useCustomDuration && (
                <div className="flex items-center gap-3 rounded-xl bg-card p-3">
                  <Input
                    type="number"
                    min={MIN_CUSTOM_HOURS}
                    max={MAX_CUSTOM_HOURS}
                    value={customHours}
                    onChange={(e) => setCustomHours(e.target.value)}
                    className="h-11 max-w-[120px] rounded-xl text-base"
                  />
                  <span className="text-sm text-muted-foreground">hours (between {MIN_CUSTOM_HOURS} and {MAX_CUSTOM_HOURS})</span>
                </div>
              )}

              <p className="rounded-xl bg-card px-3 py-2 text-xs font-semibold text-muted-foreground">
                <span className="text-foreground">Listing will expire in </span>
                <span className="text-primary">{
                  (() => {
                    const h = resolveDurationHours();
                    return h == null ? "—" : formatTimeRemaining(new Date(Date.now() + h * 3600_000).toISOString());
                  })()
                }</span>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="addr" className="flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-accent" /> Exact street address (private)
              </Label>
              <MapboxAddressSearch
                token={mapboxToken}
                value={form.address_exact}
                onChange={(val) => {
                  setForm({ ...form, address_exact: val });
                  if (selectedCoords) setSelectedCoords(null);
                }}
                onSelect={({ address, lat, lng }) => {
                  setForm({ ...form, address_exact: address });
                  setSelectedCoords({ lat, lng });
                }}
              />
              <p className="text-xs text-muted-foreground">
                {selectedCoords
                  ? "✓ Address confirmed — only revealed to a helper after you accept their request."
                  : "Search and select your Glen Ellyn address from the dropdown. Only revealed to a helper after you accept."}
              </p>
            </div>

            <div className="flex items-start gap-3 rounded-2xl bg-secondary/60 p-4 text-sm">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <p className="text-secondary-foreground">Heads up — Odd Job is for general help only. Posts mentioning plumbing, electrical, roofing, or power tools will be blocked automatically.</p>
            </div>

            <div className="flex items-start gap-3 rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              <CreditCard className="mt-0.5 h-4 w-4 shrink-0" />
              <p><span className="font-semibold text-foreground">Payments coming soon.</span> Stripe Connect will let you pay your helper securely once the job is done.</p>
            </div>

            <Button type="submit" disabled={submitting} className="h-14 w-full rounded-2xl text-base" size="lg">
              {submitting ? "Checking with our AI…" : "Post job"}
            </Button>
          </form>
        </Card>

        {/* My Posted Jobs */}
        <Card className="mt-8 rounded-3xl border-border/60 p-6 shadow-card md:p-8">
          <div className="mb-4 flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-extrabold">My posted jobs</h2>
          </div>
          {myJobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">You haven't posted any jobs yet. Fill out the form above to get started.</p>
          ) : (
            <ul className="space-y-3">
              {myJobs.map((j) => {
                const meta = categoryMeta(j.category);
                const Icon = meta.icon;
                const statusLabel: Record<string, string> = {
                  open: "Open",
                  in_progress: "Accepted",
                  completed: "Completed",
                  cancelled: "Cancelled",
                  disputed: "Disputed",
                  expired: "Expired",
                };
                const statusStyle: Record<string, string> = {
                  open: "bg-primary-soft text-primary border-primary/30",
                  in_progress: "bg-accent-soft text-accent-foreground border-accent/30",
                  completed: "bg-secondary text-secondary-foreground border-border",
                  cancelled: "bg-muted text-muted-foreground border-border",
                  disputed: "bg-destructive/15 text-destructive border-destructive/30",
                  expired: "bg-muted text-muted-foreground border-border",
                };
                const level = expirationLevel(j.expires_at);
                const timerLabel = j.status === "open" ? formatTimeRemaining(j.expires_at) : null;
                return (
                  <li key={j.id} className="flex flex-col gap-3 rounded-2xl border border-border/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${meta.color}1a` }}>
                        <Icon className="h-5 w-5" style={{ color: meta.color }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <Link to={`/jobs/${j.id}`} className="block truncate font-extrabold hover:underline">{j.title}</Link>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                          <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 font-bold", statusStyle[j.status] ?? statusStyle.open)}>
                            {statusLabel[j.status] ?? j.status}
                          </span>
                          {timerLabel && (
                            <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold", countdownBadgeClass(level))}>
                              <Timer className="h-3 w-3" />{timerLabel === "Expired" ? "Expired" : `Expires in ${timerLabel}`}
                            </span>
                          )}
                          <span className="font-bold text-foreground">${Number(j.budget).toFixed(0)}</span>
                        </div>
                      </div>
                    </div>
                    {j.status === "open" && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setCancelTarget({ id: j.id, title: j.title })}
                        className="rounded-xl border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        <XCircle className="mr-1 h-4 w-4" /> Cancel job
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {/* Cancel confirmation */}
      <AlertDialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this job?</AlertDialogTitle>
            <AlertDialogDescription>
              "{cancelTarget?.title}" will be marked as cancelled and removed from the feed. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="ghost" onClick={() => setCancelTarget(null)} disabled={cancelling} className="rounded-2xl">Keep it</Button>
            <AlertDialogAction onClick={confirmCancel} disabled={cancelling} className="rounded-2xl bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {cancelling ? "Cancelling…" : "Yes, cancel job"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={blocked.open} onOpenChange={(o) => setBlocked({ ...blocked, open: o })}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10">
              <ShieldAlert className="h-7 w-7 text-destructive" />
            </div>
            <AlertDialogTitle className="text-center">This one's a bit too specialized</AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              {blocked.reason}
              <br /><br />
              Odd Job is built for general neighborly help — yardwork, moving, errands, and the like. For licensed trades, please find a professional.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction className="rounded-2xl">Got it, I'll edit</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <BottomNav />
    </div>
  );
}
