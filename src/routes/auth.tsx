import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Boxes } from "lucide-react";

const searchSchema = z.object({
  mode: z.enum(["signin", "signup"]).optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: AuthPage,
});

const usernameRe = /^[a-zA-Z0-9_]{4,20}$/;
const gmailRe = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;
const passwordRe = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

function AuthPage() {
  const search = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup">(search.mode ?? "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const isAdminEmail = email.toLowerCase() === "charanasadmin@gmail.com";
    if (!isAdminEmail && !gmailRe.test(email)) {
      toast.error("Only Gmail accounts are allowed");
      return;
    }
    if (mode === "signup" && !isAdminEmail) {
      if (!usernameRe.test(username)) {
        toast.error("Username must be 4–20 letters, numbers, or underscores");
        return;
      }
      if (!passwordRe.test(password)) {
        toast.error(
          "Password must be 8+ chars with upper, lower, number, and special char",
        );
        return;
      }
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username },
            emailRedirectTo: window.location.origin + "/dashboard",
          },
        });
        if (error) throw error;
        toast.success("Account created. Signing you in…");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast.success("Welcome back");
      }
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      toast.error(err.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex gradient-hero p-12 flex-col justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-primary text-primary-foreground grid place-items-center">
            <Boxes className="h-4 w-4" />
          </div>
          <span className="font-display text-lg font-semibold">ProjectMarket</span>
        </Link>
        <div>
          <h2 className="font-display text-3xl font-semibold text-foreground max-w-md">
            Buy real projects. Own them forever.
          </h2>
          <p className="mt-3 text-muted-foreground max-w-md">
            Pay per project with Razorpay. Download from a private signed URL.
            Every request is re-verified against your purchase history.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Secured by enterprise-grade auth · RLS · HMAC-verified webhooks
        </p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <Link to="/" className="lg:hidden mb-8 flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-primary text-primary-foreground grid place-items-center">
              <Boxes className="h-4 w-4" />
            </div>
            <span className="font-display text-lg font-semibold">ProjectMarket</span>
          </Link>
          <h1 className="font-display text-2xl font-semibold">
            {mode === "signup" ? "Create your account" : "Sign in"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signup"
              ? "Use your Gmail address. Username is permanent."
              : "Welcome back to your project library."}
          </p>

          <form className="mt-8 space-y-4" onSubmit={onSubmit}>
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  placeholder="john_doe"
                  required
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Gmail address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@gmail.com"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                placeholder="••••••••"
                required
              />
              {mode === "signup" && (
                <p className="text-xs text-muted-foreground">
                  8+ characters with uppercase, lowercase, number & special character.
                </p>
              )}
            </div>
            <Button type="submit" className="w-full h-11" disabled={loading}>
              {loading
                ? "Please wait…"
                : mode === "signup"
                  ? "Create account"
                  : "Sign in"}
            </Button>
          </form>

          <p className="mt-6 text-sm text-muted-foreground text-center">
            {mode === "signup" ? "Already have an account?" : "New to ProjectMarket?"}{" "}
            <button
              className="text-primary font-medium hover:underline"
              onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
            >
              {mode === "signup" ? "Sign in" : "Create one"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
