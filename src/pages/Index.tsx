import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import heroImg from "@/assets/hero-illustration.png";
import { CATEGORIES } from "@/lib/categories";
import { ShieldCheck, Sparkles, MapPin, CreditCard } from "lucide-react";

export default function Index() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-hero">
        <div className="container grid gap-10 py-16 md:grid-cols-2 md:py-24 md:gap-16 items-center">
          <div className="animate-fade-in">
            <span className="inline-flex items-center gap-2 rounded-full bg-card px-4 py-1.5 text-sm font-semibold text-accent shadow-card">
              <Sparkles className="h-4 w-4" /> Neighbors helping neighbors
            </span>
            <h1 className="mt-6 text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl lg:text-7xl">
              Your Neighborhood,
              <br />
              <span className="bg-gradient-primary bg-clip-text font-extrabold text-5xl bg-primary-soft text-accent">
                at your service
              </span>
            </h1>
            <p className="mt-6 max-w-lg text-lg text-muted-foreground">
              Odd Job is the friendly community marketplace for everyday help — yardwork, moving boxes, walking the dog.
              No specialists. Just neighbors.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" asChild className="rounded-2xl text-base shadow-glow">
                <Link to="/auth">Get started — it's free</Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="rounded-2xl text-base">
                <Link to="/feed">Browse jobs</Link>
              </Button>
            </div>
          </div>
          <div className="relative">
            <div className="absolute inset-0 -z-10 rounded-[3rem] bg-gradient-to-br from-primary/10 to-accent/10 blur-3xl" />
            <img
              src={heroImg}
              alt="Neighbors helping with everyday tasks"
              width={1280}
              height={1024}
              className="w-full animate-float"
            />
          </div>
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="container py-20">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold md:text-4xl">What folks need help with</h2>
          <p className="mt-3 text-muted-foreground">
            General everyday tasks — nothing that needs a license or a hard hat.
          </p>
        </div>
        <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
          {CATEGORIES.slice(0, 8).map(({ value, label, icon: Icon, color }) => (
            <div
              key={value}
              className="group rounded-2xl border border-border bg-card p-6 shadow-card transition-smooth hover:-translate-y-1 hover:shadow-soft"
            >
              <div
                className="flex h-12 w-12 items-center justify-center rounded-2xl"
                style={{ backgroundColor: `${color}1a` }}
              >
                <Icon className="h-6 w-6" style={{ color }} />
              </div>
              <p className="mt-4 font-bold">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section className="bg-muted/40 py-20">
        <div className="container grid gap-8 md:grid-cols-3">
          {[
            {
              icon: ShieldCheck,
              title: "AI-moderated",
              desc: "Every post is checked. Specialized work like plumbing or electrical is automatically blocked — keeping things safe and simple.",
            },
            {
              icon: MapPin,
              title: "Live neighborhood map",
              desc: "See jobs nearby with friendly category pins. Pick what's around the corner, not across town.",
            },
            {
              icon: CreditCard,
              title: "Trust Grades A–F",
              desc: "Build your reputation with every completed job. Posters and Doers see clear trust scores from real neighbors.",
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-2xl bg-card p-8 shadow-card">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft">
                <Icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mt-5 text-xl font-extrabold">{title}</h3>
              <p className="mt-2 text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container py-20">
        <div className="rounded-[2rem] bg-gradient-primary p-10 text-center text-primary-foreground shadow-glow md:p-16">
          <h2 className="text-3xl font-extrabold md:text-5xl">Ready to lend a hand?</h2>
          <p className="mx-auto mt-4 max-w-xl text-lg opacity-95">
            Post a job in seconds, or earn a little helping out around the block.
          </p>
          <Button size="lg" variant="secondary" asChild className="mt-8 rounded-2xl text-base">
            <Link to="/auth">Join Odd Job</Link>
          </Button>
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Odd Job — Built for neighbors, by neighbors.
      </footer>
    </div>
  );
}
