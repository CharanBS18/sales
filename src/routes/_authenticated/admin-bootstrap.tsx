import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { adminGrantSelf } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";

export const ADMIN_EMAIL = "charanasadmin@gmail.com";

export const Route = createFileRoute("/_authenticated/admin-bootstrap")({
  component: AdminBootstrapPage,
});

function AdminBootstrapPage() {
  const navigate = useNavigate();
  const grantFn = useServerFn(adminGrantSelf);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const e = data.user?.email ?? null;
      setEmail(e);
      if (e !== ADMIN_EMAIL) {
        toast.error("This area is restricted.");
        navigate({ to: "/dashboard" });
      }
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    try {
      await grantFn({ data: { code: code.trim() } });
      toast.success("Admin access granted");
      navigate({ to: "/admin" });
    } catch (err: any) {
      toast.error(err?.message ?? "Invalid code");
    } finally {
      setLoading(false);
    }
  }

  if (email !== ADMIN_EMAIL) return null;

  return (
    <div className="min-h-[70vh] grid place-items-center p-6">
      <div className="w-full max-w-md rounded-xl border bg-surface p-8 shadow-card">
        <div className="flex items-center gap-2 text-primary">
          <ShieldCheck className="h-5 w-5" />
          <span className="text-xs font-medium uppercase tracking-wider">
            Admin verification
          </span>
        </div>
        <h1 className="mt-3 font-display text-2xl font-semibold">
          Enter admin bootstrap code
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Signed in as <span className="font-medium">{email}</span>. Enter the
          one-time code to unlock the admin dashboard.
        </p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="code">Bootstrap code</Label>
            <Input
              id="code"
              type="password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="one-time-code"
              placeholder="••••••••"
              required
              autoFocus
            />
          </div>
          <Button type="submit" className="w-full h-11" disabled={loading}>
            {loading ? "Verifying…" : "Unlock admin"}
          </Button>
          <Link
            to="/dashboard"
            className="block text-center text-sm text-muted-foreground hover:text-foreground"
          >
            Cancel
          </Link>
        </form>
      </div>
    </div>
  );
}
