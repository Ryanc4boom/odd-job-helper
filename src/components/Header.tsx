import { Link, useNavigate } from "react-router-dom";
import { Button, buttonVariants } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Hammer, LogOut } from "lucide-react";

export default function Header() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-lg">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-display text-xl font-extrabold">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-primary shadow-soft">
            <Hammer className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
          </span>
          Odd Job
        </Link>
        <nav className="flex items-center gap-2">
          {user ? (
            <>
              <Link to="/feed" className={buttonVariants({ variant: "ghost" })}>Feed</Link>
              <Link to="/post" className={buttonVariants({ variant: "ghost" })}>Post a job</Link>
              <Button variant="ghost" size="icon" onClick={signOut} title="Sign out">
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Link to="/auth" className={buttonVariants({ variant: "ghost" })}>Sign in</Link>
              <Link to="/auth" className={buttonVariants({ variant: "default" })}>Get started</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
