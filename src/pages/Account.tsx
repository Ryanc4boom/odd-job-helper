import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import StarRating from "@/components/StarRating";
import { toast } from "sonner";
import { ShieldCheck, BadgeCheck, Camera, FileUp, LogOut, Briefcase, Hammer, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTimeRemaining, expirationLevel, countdownBadgeClass } from "@/lib/expiration";
import { categoryMeta } from "@/lib/categories";

type Profile = {
  id: string;
  display_name: string | null;
  bio: string | null;
  age_range: string | null;
  trust_grade: "A" | "B" | "C" | "D" | "F";
  jobs_completed: number;
  is_verified: boolean;
  is_pro_helper: boolean;
  verification_id: string | null;
  verified_at: string | null;
};

const AGE_RANGES = [
  { value: "13-17", label: "13–17" },
  { value: "18-24", label: "18–24" },
  { value: "25-34", label: "25–34" },
  { value: "35-44", label: "35–44" },
  { value: "45-54", label: "45–54" },
  { value: "55-64", label: "55–64" },
  { value: "65+", label: "65+" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

export default function Account() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [postedJobs, setPostedJobs] = useState<any[]>([]);
  const [acceptedJobs, setAcceptedJobs] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyStep, setVerifyStep] = useState<"docs" | "selfie" | "processing">("docs");
  const [docUploaded, setDocUploaded] = useState(false);
  const [selfieUploaded, setSelfieUploaded] = useState(false);
  const [restriction, setRestriction] = useState<{ restricted: boolean; until_ts: string | null; consecutive_count: number } | null>(null);
  const [ratingStats, setRatingStats] = useState<{ avg: number | null; count: number }>({ avg: null, count: 0 });
  const [, forceTick] = useState(0);

  useEffect(() => {
    if (!restriction?.restricted) return;
    const t = setInterval(() => forceTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [restriction?.restricted]);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: p } = await supabase
        .from("profiles")
        .select("id, display_name, bio, age_range, trust_grade, jobs_completed, is_verified, is_pro_helper, verification_id, verified_at")
        .eq("id", user.id)
        .single();
      setProfile(p as any);

      const { data: rest } = await supabase.rpc("get_doer_restriction", { _doer_id: user.id });
      if (rest && rest[0]) setRestriction(rest[0] as any);

      const { data: ratings } = await supabase
        .from("ratings")
        .select("score")
        .eq("ratee_id", user.id);
      if (ratings && ratings.length > 0) {
        const sum = ratings.reduce((s: number, r: any) => s + Number(r.score), 0);
        setRatingStats({ avg: sum / ratings.length, count: ratings.length });
      } else {
        setRatingStats({ avg: null, count: 0 });
      }

      const { data: posted } = await supabase
        .from("jobs")
        .select("id, title, status, budget, scheduled_for, schedule_window, category")
        .eq("poster_id", user.id)
        .order("created_at", { ascending: false });
      setPostedJobs(posted ?? []);

      const { data: reqs } = await supabase
        .from("job_requests")
        .select("status, jobs:job_id(id, title, status, budget, scheduled_for, schedule_window, category)")
        .eq("doer_id", user.id)
        .order("created_at", { ascending: false });
      setAcceptedJobs((reqs ?? []).filter((r: any) => r.jobs).map((r: any) => ({ ...r.jobs, request_status: r.status })));
    })();
  }, [user]);

  const saveProfile = async () => {
    if (!profile || !user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: profile.display_name,
          bio: profile.bio,
          age_range: profile.age_range,
        })
        .eq("id", user.id);
      if (error) throw error;
      toast.success("Profile saved");
    } catch (err: any) {
      toast.error(err.message ?? "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const startVerify = () => {
    setVerifyStep("docs");
    setDocUploaded(false);
    setSelfieUploaded(false);
    setVerifyOpen(true);
  };

  const completeVerify = async () => {
    if (!user) return;
    setVerifyStep("processing");
    // Simulate Stripe Identity processing
    await new Promise((r) => setTimeout(r, 1500));
    const verification_id = `vrf_${crypto.randomUUID().slice(0, 16)}`;
    const { error } = await supabase
      .from("profiles")
      .update({ is_verified: true, verification_id, verified_at: new Date().toISOString() })
      .eq("id", user.id);
    if (error) {
      toast.error(error.message);
      setVerifyOpen(false);
      return;
    }
    setProfile((p) => p ? { ...p, is_verified: true, verification_id, verified_at: new Date().toISOString() } : p);
    setVerifyOpen(false);
    toast.success("You're a Verified Neighbor! 🎉");
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (!profile) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container py-12 text-muted-foreground">Loading…</div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-0">
      <Header />
      <div className="max-w-3xl px-4 py-8 ml-0 mr-auto">
        <div className="mb-6 flex items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold md:text-4xl">Your account</h1>
            <p className="mt-2 text-muted-foreground">Profile, jobs, and verification.</p>
          </div>
          <Button variant="ghost" size="icon" onClick={signOut} title="Sign out">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>

        {/* Restriction banner */}
        {restriction?.restricted && restriction.until_ts && (
          <Card className="mb-6 rounded-3xl border-destructive/40 bg-destructive/10 p-5 shadow-card">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-destructive" />
              <div>
                <h2 className="font-extrabold text-destructive">Access restricted</h2>
                <p className="mt-1 text-sm text-foreground/80">
                  You cancelled {restriction.consecutive_count} accepted jobs in a row. Access restricted for{" "}
                  <span className="font-bold">{(() => {
                    const ms = Math.max(0, new Date(restriction.until_ts).getTime() - Date.now());
                    const h = Math.floor(ms / 3_600_000);
                    const m = Math.floor((ms % 3_600_000) / 60_000);
                    const s = Math.floor((ms % 60_000) / 1000);
                    return `${h}h ${m}m ${s}s`;
                  })()}</span> due to multiple cancellations.
                </p>
              </div>
            </div>
          </Card>
        )}


        <Card className={cn(
          "rounded-3xl p-6 shadow-card mb-6",
          profile.is_verified ? "bg-accent-soft border-accent/30" : "border-border/60"
        )}>
          <div className="flex items-start gap-4">
            <div className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl",
              profile.is_verified ? "bg-accent text-accent-foreground" : "bg-primary-soft text-primary"
            )}>
              {profile.is_verified ? <BadgeCheck className="h-6 w-6" /> : <ShieldCheck className="h-6 w-6" />}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-extrabold">Identity Verification</h2>
              {profile.is_verified ? (
                <>
                  <p className="mt-1 text-sm text-accent-foreground/90">
                    You're a <span className="font-bold">Verified Neighbor</span> — clients can trust you to start working.
                  </p>
                  <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                    Verification_ID: {profile.verification_id}
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-1 text-sm leading-snug text-muted-foreground text-pretty">
                    Verify your identity to unlock jobs and earn a Verified Neighbor badge — it keeps our community safe.
                  </p>
                  <div className="w-full flex justify-center mt-6">
                    <Button onClick={startVerify} className="h-12 rounded-2xl text-base px-8">
                      <ShieldCheck className="mr-1 h-4 w-4" /> Verify Identity to Start Working
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </Card>

        <Tabs defaultValue="profile">
          <TabsList className="rounded-2xl">
            <TabsTrigger value="profile" className="rounded-xl">Profile</TabsTrigger>
            <TabsTrigger value="jobs" className="rounded-xl">My Jobs</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="mt-6">
            <Card className="rounded-3xl border-border/60 p-6 shadow-card">
              <div className="mb-6 flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-primary text-2xl font-extrabold text-primary-foreground shadow-soft">
                  {(profile.display_name ?? user?.email ?? "?").charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-extrabold">{profile.display_name ?? "Neighbor"}</p>
                    {profile.is_pro_helper && <ProBadge compact />}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <TrustBadge grade={profile.trust_grade} />
                    <span className="text-xs text-muted-foreground">{profile.jobs_completed} jobs done</span>
                  </div>
                  <div className="mt-1.5">
                    <StarRating
                      score={ratingStats.avg}
                      count={ratingStats.count}
                      emptyLabel={profile.jobs_completed === 0 ? "New Helper" : "No ratings yet"}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="display_name">Display name</Label>
                  <Input
                    id="display_name"
                    value={profile.display_name ?? ""}
                    onChange={(e) => setProfile({ ...profile, display_name: e.target.value })}
                    maxLength={80}
                    className="h-12 rounded-xl text-base"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    rows={3}
                    value={profile.bio ?? ""}
                    onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                    placeholder="A few friendly words about yourself…"
                    maxLength={300}
                    className="rounded-xl text-base"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Age range <span className="font-normal text-muted-foreground">(optional)</span></Label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {AGE_RANGES.map((a) => (
                      <button
                        key={a.value}
                        type="button"
                        onClick={() => setProfile({ ...profile, age_range: profile.age_range === a.value ? null : a.value })}
                        className={cn(
                          "h-12 rounded-xl border-2 px-3 text-sm font-bold transition-smooth",
                          profile.age_range === a.value
                            ? "border-primary bg-primary-soft text-primary"
                            : "border-border bg-card hover:border-primary/40"
                        )}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                </div>
                <Button onClick={saveProfile} disabled={saving} className="h-12 w-full rounded-2xl text-base sm:w-auto">
                  {saving ? "Saving…" : "Save profile"}
                </Button>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="jobs" className="mt-6 space-y-6">
            <section>
              <div className="mb-3 flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-primary" />
                <h2 className="font-extrabold">Jobs you posted</h2>
              </div>
              {postedJobs.length === 0 ? (
                <Card className="rounded-2xl p-6 text-center text-sm text-muted-foreground">
                  No posted jobs yet. <Link to="/post" className="font-bold text-primary hover:underline">Post one →</Link>
                </Card>
              ) : (
                <div className="grid gap-3">
                  {postedJobs.map((j) => <JobRow key={j.id} job={j} />)}
                </div>
              )}
            </section>

            <section>
              <div className="mb-3 flex items-center gap-2">
                <Hammer className="h-4 w-4 text-accent" />
                <h2 className="font-extrabold">Jobs you've requested</h2>
              </div>
              {acceptedJobs.length === 0 ? (
                <Card className="rounded-2xl p-6 text-center text-sm text-muted-foreground">
                  No requests yet. <Link to="/feed" className="font-bold text-primary hover:underline">Find jobs →</Link>
                </Card>
              ) : (
                <div className="grid gap-3">
                  {acceptedJobs.map((j) => <JobRow key={j.id} job={j} requestStatus={j.request_status} />)}
                </div>
              )}
            </section>
          </TabsContent>
        </Tabs>
      </div>

      {/* Simulated Stripe Identity dialog */}
      <Dialog open={verifyOpen} onOpenChange={setVerifyOpen}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>Verify your identity</DialogTitle>
            <DialogDescription>
              Quick simulation of a Stripe Identity check. In production this would securely capture your ID and a selfie.
            </DialogDescription>
          </DialogHeader>

          {verifyStep === "docs" && (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setDocUploaded(true)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl border-2 border-dashed p-4 text-left transition-smooth",
                  docUploaded ? "border-accent bg-accent-soft" : "border-border hover:border-primary/40"
                )}
              >
                <FileUp className={cn("h-5 w-5", docUploaded ? "text-accent" : "text-muted-foreground")} />
                <div className="flex-1">
                  <p className="font-bold">{docUploaded ? "ID document uploaded ✓" : "Upload government-issued ID"}</p>
                  <p className="text-xs text-muted-foreground">Driver's license, passport, or ID card</p>
                </div>
              </button>
              <Button
                onClick={() => setVerifyStep("selfie")}
                disabled={!docUploaded}
                className="h-12 w-full rounded-2xl"
              >
                Continue
              </Button>
            </div>
          )}

          {verifyStep === "selfie" && (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setSelfieUploaded(true)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl border-2 border-dashed p-4 text-left transition-smooth",
                  selfieUploaded ? "border-accent bg-accent-soft" : "border-border hover:border-primary/40"
                )}
              >
                <Camera className={cn("h-5 w-5", selfieUploaded ? "text-accent" : "text-muted-foreground")} />
                <div className="flex-1">
                  <p className="font-bold">{selfieUploaded ? "Selfie captured ✓" : "Take a selfie"}</p>
                  <p className="text-xs text-muted-foreground">We'll match it to your ID</p>
                </div>
              </button>
              <Button
                onClick={completeVerify}
                disabled={!selfieUploaded}
                className="h-12 w-full rounded-2xl"
              >
                Submit for verification
              </Button>
            </div>
          )}

          {verifyStep === "processing" && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="font-bold">Verifying your identity…</p>
            </div>
          )}

          <DialogFooter className="text-[11px] text-muted-foreground">
            <p>Simulated for demo — no documents are stored.</p>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
}

function JobRow({ job, requestStatus }: { job: any; requestStatus?: string }) {
  const meta = categoryMeta(job.category);
  const Icon = meta.icon;
  return (
    <Link to={`/jobs/${job.id}`}>
      <Card className="flex items-center gap-3 rounded-2xl p-4 transition-smooth hover:-translate-y-0.5 hover:shadow-soft">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${meta.color}1a` }}>
          <Icon className="h-5 w-5" style={{ color: meta.color }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{job.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold", scheduleBadgeStyle(job.schedule_window))}>
              {formatSchedule(job.scheduled_for, job.schedule_window)}
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
              ${Number(job.budget).toFixed(0)}
            </span>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-bold text-secondary-foreground capitalize">
              {requestStatus ?? job.status}
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
