import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
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
              <Button variant="ghost" asChild><Link to="/feed">Feed</Link></Button>
              <Button variant="ghost" asChild><Link to="/post">Post a job</Link></Button>
              <Button variant="ghost" size="icon" onClick={signOut} title="Sign out">
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" asChild><Link to="/auth">Sign in</Link></Button>
              <Button variant="default" asChild><Link to="/auth">Get started</Link></Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
