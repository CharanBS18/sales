import { createFileRoute, Outlet, redirect, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { myProfile } from "@/lib/projects.functions";
import { recordLogin } from "@/lib/payments.functions";
import { Button } from "@/components/ui/button";
import {
  Boxes,
  LayoutGrid,
  Receipt,
  Shield,
  UserCircle,
  LogOut,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const router = useRouter();
  const qc = useQueryClient();
  const recordLoginFn = useServerFn(recordLogin);
  const profileFn = useServerFn(myProfile);
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => profileFn(),
  });

  // Record this session's login once per mount
  const [recorded, setRecorded] = useState(false);
  useEffect(() => {
    if (!recorded) {
      recordLoginFn().catch(() => {});
      setRecorded(true);
    }
  }, [recordLoginFn, recorded]);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-surface sticky top-0 z-30">
        <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between gap-6">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-primary text-primary-foreground grid place-items-center">
              <Boxes className="h-4 w-4" />
            </div>
            <span className="font-display text-lg font-semibold hidden sm:inline">
              ProjectMarket
            </span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <NavLink to="/dashboard" icon={LayoutGrid} label="Browse" />
            <NavLink to="/purchases" icon={Receipt} label="Purchases" />
            <NavLink to="/profile" icon={UserCircle} label="Profile" />
            {me?.isAdmin && (
              <NavLink to="/admin" icon={Shield} label="Admin" />
            )}
          </nav>
          <div className="flex items-center gap-3">
            <span className="hidden md:inline text-sm text-muted-foreground">
              {me?.profile?.username ?? "…"}
            </span>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4 mr-1.5" />
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}

function NavLink({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="px-3 py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent inline-flex items-center gap-1.5 [&.active]:text-primary [&.active]:bg-accent"
      activeProps={{ className: "active" }}
    >
      <Icon className="h-4 w-4" />
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}
