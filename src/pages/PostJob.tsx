import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CATEGORIES } from "@/lib/categories";
import { toast } from "sonner";
import { CreditCard, ShieldAlert, Sparkles } from "lucide-react";

const schema = z.object({
  title: z.string().trim().min(4, "Add a clear title").max(80),
  description: z.string().trim().min(20, "Tell neighbors what you need (20+ chars)").max(800),
  category: z.string(),
  budget: z.coerce.number().min(0).max(10000),
  location_text: z.string().trim().max(120).optional(),
});

export default function PostJob() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [blocked, setBlocked] = useState<{ open: boolean; reason: string }>({ open: false, reason: "" });
  const [form, setForm] = useState({
    title: "", description: "", category: "other", budget: "20", location_text: "",
  });

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
    setSubmitting(true);
    try {
      // 1. AI moderation
      const { data: mod, error: modErr } = await supabase.functions.invoke("moderate-job", {
        body: { title: parsed.data.title, description: parsed.data.description },
      });
      if (modErr) throw modErr;
      if (mod?.error) throw new Error(mod.error);

      if (!mod.allowed) {
        setBlocked({ open: true, reason: mod.reason });
        return;
      }

      // 2. Insert job
      const { error: insErr } = await supabase.from("jobs").insert({
        poster_id: user!.id,
        title: parsed.data.title,
        description: parsed.data.description,
        category: (mod.category ?? parsed.data.category) as any,
        budget: parsed.data.budget,
        location_text: parsed.data.location_text || null,
        // demo: spread random points around a base coord (San Francisco)
        location_lat: 37.7749 + (Math.random() - 0.5) * 0.05,
        location_lng: -122.4194 + (Math.random() - 0.5) * 0.05,
      });
      if (insErr) throw insErr;
      toast.success("Job posted! Neighbors can see it now.");
      navigate("/feed");
    } catch (err: any) {
      toast.error(err.message ?? "Could not post job");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container max-w-2xl py-10">
        <div className="mb-6">
          <h1 className="text-3xl font-extrabold md:text-4xl">Post a job</h1>
          <p className="mt-2 text-muted-foreground">Quick tasks only. Our friendly AI checks every post to keep things safe.</p>
        </div>

        <Card className="rounded-3xl border-border/60 p-6 shadow-card md:p-8">
          <form onSubmit={submit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Help me rake leaves Saturday" maxLength={80} className="rounded-xl" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">What needs doing?</Label>
              <Textarea id="description" rows={5} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="A few sentences about the task, where it is, and any tools you have." maxLength={800} className="rounded-xl" />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="budget">Budget ($)</Label>
                <Input id="budget" type="number" min={0} max={10000} value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} className="rounded-xl" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="loc">Neighborhood / cross streets</Label>
              <Input id="loc" value={form.location_text} onChange={(e) => setForm({ ...form, location_text: e.target.value })} placeholder="Mission District, near Dolores Park" maxLength={120} className="rounded-xl" />
            </div>

            <div className="flex items-start gap-3 rounded-2xl bg-secondary/60 p-4 text-sm">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <p className="text-secondary-foreground">Heads up — Odd Job is for general help only. Posts mentioning plumbing, electrical, roofing, or power tools will be blocked automatically.</p>
            </div>

            <div className="flex items-start gap-3 rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              <CreditCard className="mt-0.5 h-4 w-4 shrink-0" />
              <p><span className="font-semibold text-foreground">Payments coming soon.</span> Stripe Connect integration will let you pay your Doer securely once the job is done.</p>
            </div>

            <Button type="submit" disabled={submitting} className="w-full rounded-2xl text-base" size="lg">
              {submitting ? "Checking with our AI…" : "Post job"}
            </Button>
          </form>
        </Card>
      </div>

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
    </div>
  );
}
