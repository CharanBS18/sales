import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, Download, CreditCard, Zap, Lock, Boxes } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ProjectMarket — Buy production-grade software projects" },
      {
        name: "description",
        content:
          "A secure marketplace for downloading commercial-grade software projects. Pay per project, download instantly, own forever.",
      },
      { property: "og:title", content: "ProjectMarket" },
      {
        property: "og:description",
        content: "Secure per-project payments, instant signed-URL downloads.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-primary text-primary-foreground grid place-items-center">
              <Boxes className="h-4 w-4" />
            </div>
            <span className="font-display text-lg font-semibold tracking-tight">
              ProjectMarket
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/auth">
              <Button variant="ghost">Sign in</Button>
            </Link>
            <Link to="/auth" search={{ mode: "signup" }}>
              <Button>Get started</Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="gradient-hero">
        <div className="mx-auto max-w-6xl px-6 py-24 lg:py-32 text-center">
          <Badge variant="secondary" className="mb-6">
            Secure per-project marketplace
          </Badge>
          <h1 className="font-display text-4xl sm:text-6xl font-semibold tracking-tight text-foreground max-w-3xl mx-auto">
            Buy production-grade projects.{" "}
            <span className="text-primary">Download instantly.</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
            A commercial marketplace for software projects. Every purchase is
            individually secured — buying one project never unlocks another.
            All downloads use short-lived signed URLs.
          </p>
          <div className="mt-10 flex items-center justify-center gap-3">
            <Link to="/auth" search={{ mode: "signup" }}>
              <Button size="lg" className="h-12 px-7">
                Create your account
              </Button>
            </Link>
            <Link to="/dashboard">
              <Button size="lg" variant="outline" className="h-12 px-7">
                Browse projects
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              icon: CreditCard,
              title: "Per-project payments",
              body: "Razorpay-powered checkout with UPI, cards, and netbanking. Amount validated server-side from the database — never the client.",
            },
            {
              icon: Lock,
              title: "Signed-URL downloads",
              body: "Files live in a private S3 bucket. Every download mints a short-lived URL, only after ownership is verified.",
            },
            {
              icon: Shield,
              title: "URL-tamper-proof access",
              body: "Every request re-verifies ownership server-side. Changing a project ID in the URL returns a hard 403.",
            },
            {
              icon: Download,
              title: "Download history",
              body: "Track who downloaded what, when, and from where — for both compliance and analytics.",
            },
            {
              icon: Zap,
              title: "Real-time admin view",
              body: "Live revenue, recent logins, recent purchases and downloads — all in a single admin dashboard.",
            },
            {
              icon: Boxes,
              title: "Built to scale",
              body: "Stateless edge backend, Postgres with row-level security, signed asset distribution.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-xl border bg-surface p-6 shadow-card"
            >
              <div className="h-10 w-10 rounded-lg bg-accent grid place-items-center text-accent-foreground">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                {body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border/60">
        <div className="mx-auto max-w-6xl px-6 py-8 text-sm text-muted-foreground flex flex-wrap items-center justify-between gap-3">
          <span>© {new Date().getFullYear()} ProjectMarket</span>
          <span>Built on TanStack Start · Lovable Cloud · Razorpay · AWS S3</span>
        </div>
      </footer>
    </div>
  );
}
