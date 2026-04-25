import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Hammer, Sparkles } from "lucide-react";
import Header from "@/components/Header";
import { z } from "zod";
import { cn } from "@/lib/utils";

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

const signupSchema = z
  .object({
    email: z.string().trim().email("Enter a valid email").max(255),
    password: z.string().min(8, "At least 8 characters").max(72),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: "Passwords don't match", path: ["confirm"] });

type Step = "auth" | "onboarding";

export default function Auth() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [step, setStep] = useState<Step>("auth");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ageRange, setAgeRange] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session && step === "auth") navigate("/feed");
    });
  }, [navigate, step]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const parsed = signupSchema.safeParse({ email, password, confirm });
        if (!parsed.success) {
          toast.error(parsed.error.issues[0].message);
          return;
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/feed`,
            data: { display_name: email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Welcome to Odd Job!");
        setStep("onboarding");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/feed");
      }
    } catch (err: any) {
      const msg = String(err?.message ?? "");
      if (msg.toLowerCase().includes("failed to fetch")) {
        toast.error("Network blocked in preview. Try the published URL.");
      } else {
        toast.error(msg || "Something went wrong");
      }
    } finally {
      setLoading(false);
    }
  };

  const google = async () => {
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/feed`,
      });
      if (result.error) {
        toast.error(result.error.message ?? "Google sign-in failed");
        return;
      }
      if (!result.redirected) navigate("/feed");
    } catch (err: any) {
      toast.error(err?.message ?? "Google sign-in failed");
    }
  };

  const finishOnboarding = async (selected: string | null) => {
    setLoading(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user.id;
      if (uid && selected) {
        await supabase.from("profiles").update({ age_range: selected }).eq("id", uid);
      }
      navigate("/feed");
    } catch (err: any) {
      // Non-blocking — still go to feed
      navigate("/feed");
    } finally {
      setLoading(false);
    }
  };

  if (step === "onboarding") {
    return (
      <div className="min-h-screen bg-gradient-hero">
        <Header />
        <div className="container flex items-center justify-center py-10 md:py-16">
          <Card className="w-full max-w-md rounded-3xl border-border/60 p-8 shadow-soft">
            <div className="mb-6 flex flex-col items-center text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-accent shadow-soft">
                <Sparkles className="h-7 w-7 text-accent-foreground" strokeWidth={2.5} />
              </span>
              <h1 className="mt-4 text-2xl font-extrabold">Personalize your experience</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Helps personalize your experience (optional).
              </p>
            </div>

            <fieldset>
              <legend className="mb-3 text-sm font-bold">Age range</legend>
              <div className="grid grid-cols-2 gap-2">
                {AGE_RANGES.map((a) => (
                  <button
                    key={a.value}
                    type="button"
                    onClick={() => setAgeRange(a.value)}
                    className={cn(
                      "h-14 rounded-2xl border-2 px-3 text-sm font-bold transition-smooth",
                      ageRange === a.value
                        ? "border-primary bg-primary-soft text-primary shadow-soft"
                        : "border-border bg-card hover:border-primary/40"
                    )}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="mt-6 space-y-2">
              <Button
                disabled={loading}
                className="h-14 w-full rounded-2xl text-base"
                onClick={() => finishOnboarding(ageRange)}
              >
                {loading ? "Saving…" : "Continue"}
              </Button>
              <Button
                variant="ghost"
                disabled={loading}
                className="h-12 w-full rounded-2xl text-base"
                onClick={() => finishOnboarding(null)}
              >
                Skip for now
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-hero">
      <Header />
      <div className="container flex items-center justify-center py-10 md:py-16">
        <Card className="w-full max-w-md rounded-3xl border-border/60 p-8 shadow-soft">
          <div className="mb-6 flex flex-col items-center text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-primary shadow-glow">
              <Hammer className="h-7 w-7 text-primary-foreground" strokeWidth={2.5} />
            </span>
            <h1 className="mt-4 text-2xl font-extrabold">
              {mode === "signin" ? "Welcome back" : "Join Odd Job"}
            </h1>
            <p className="mt-1 text-base text-muted-foreground">
              {mode === "signin" ? "Sign in to your account" : "Create your account in seconds"}
            </p>
          </div>

          <Button type="button" variant="outline" className="h-14 w-full rounded-2xl text-base" onClick={google}>
            <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Continue with Google
          </Button>

          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> OR <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-base">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-14 rounded-2xl text-base"
                autoComplete="email"
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-base">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-14 rounded-2xl text-base"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                placeholder="At least 8 characters"
              />
            </div>
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="confirm" className="text-base">Confirm password</Label>
                <Input
                  id="confirm"
                  type="password"
                  required
                  minLength={8}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="h-14 rounded-2xl text-base"
                  autoComplete="new-password"
                  placeholder="Re-enter your password"
                />
              </div>
            )}
            <Button type="submit" disabled={loading} className="h-14 w-full rounded-2xl text-base">
              {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
            <button
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="font-bold text-primary hover:underline"
            >
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </Card>
      </div>
    </div>
  );
}
