import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getProject } from "@/lib/projects.functions";
import { startCheckout, verifyAndGrant } from "@/lib/payments.functions";
import { getDownloadUrl } from "@/lib/download.functions";
import { formatINR, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Download,
  Loader2,
  Package,
  Tag,
} from "lucide-react";
import { loadRazorpay } from "@/lib/razorpay-loader";

export const Route = createFileRoute("/_authenticated/projects/$id")({
  component: ProjectDetail,
});

function ProjectDetail() {
  const { id } = Route.useParams();
  const get = useServerFn(getProject);
  const startFn = useServerFn(startCheckout);
  const verifyFn = useServerFn(verifyAndGrant);
  const downloadFn = useServerFn(getDownloadUrl);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const { data: p, isLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: () => get({ data: { id } }),
  });

  async function onBuy() {
    if (!p) return;
    setBusy(true);
    try {
      const order = await startFn({ data: { projectId: p.id } });
      const Razorpay = await loadRazorpay();
      const rzp = new Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amount,
        currency: order.currency,
        name: "ProjectMarket",
        description: order.projectName,
        handler: async (resp: any) => {
          try {
            await verifyFn({
              data: {
                orderId: resp.razorpay_order_id,
                paymentId: resp.razorpay_payment_id,
                signature: resp.razorpay_signature,
              },
            });
            toast.success("Payment successful — project unlocked");
            qc.invalidateQueries({ queryKey: ["project", id] });
            qc.invalidateQueries({ queryKey: ["projects"] });
            qc.invalidateQueries({ queryKey: ["purchases"] });
          } catch (e: any) {
            toast.error(e.message ?? "Verification failed");
          }
        },
        modal: {
          ondismiss: () => setBusy(false),
        },
        theme: { color: "#2563eb" },
      });
      rzp.open();
    } catch (e: any) {
      toast.error(e.message ?? "Could not start checkout");
      setBusy(false);
    }
  }

  async function onDownload() {
    if (!p) return;
    setBusy(true);
    try {
      const { url, filename } = await downloadFn({ data: { projectId: p.id } });
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("Download started");
    } catch (e: any) {
      toast.error(e.message ?? "Download failed");
    } finally {
      setBusy(false);
    }
  }

  if (isLoading || !p) {
    return <div className="h-96 rounded-xl bg-surface border animate-pulse" />;
  }

  return (
    <div className="space-y-6">
      <Link
        to="/dashboard"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to marketplace
      </Link>

      <div className="grid lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3 space-y-6">
          <div className="rounded-xl overflow-hidden border bg-surface aspect-video">
            {p.thumbnail_url ? (
              <img
                src={p.thumbnail_url}
                alt={p.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full grid place-items-center bg-accent text-muted-foreground">
                <Package className="h-16 w-16" />
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="secondary">{p.category}</Badge>
              <span className="text-muted-foreground">v{p.version}</span>
            </div>
            <h1 className="mt-3 font-display text-3xl font-semibold">{p.name}</h1>
            <p className="mt-4 text-foreground/80 whitespace-pre-line leading-relaxed">
              {p.description || "No description provided."}
            </p>
            {p.tags?.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {p.tags.map((t: string) => (
                  <Badge key={t} variant="outline" className="font-normal">
                    <Tag className="h-3 w-3 mr-1" />
                    {t}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <aside className="lg:col-span-2">
          <div className="rounded-xl border bg-surface p-6 shadow-card sticky top-24">
            <div className="font-display text-3xl font-semibold">
              {formatINR(p.price_paise)}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              One-time payment · Lifetime download access
            </p>

            {p.owned ? (
              <>
                <Button
                  className="w-full mt-6 h-12"
                  onClick={onDownload}
                  disabled={busy}
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Download project
                </Button>
                <div className="mt-4 flex items-center gap-2 text-sm text-success">
                  <CheckCircle2 className="h-4 w-4" />
                  You own this project
                </div>
                {p.purchase && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    Purchased {formatDate(p.purchase.created_at)}
                  </div>
                )}
              </>
            ) : (
              <>
                <Button
                  className="w-full mt-6 h-12"
                  onClick={onBuy}
                  disabled={busy}
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : null}
                  Buy & download
                </Button>
                <p className="mt-3 text-xs text-muted-foreground">
                  Secure checkout via Razorpay. Cards, UPI, netbanking supported.
                </p>
              </>
            )}

            <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 mt-0.5 text-success" /> Instant
                signed-URL download
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 mt-0.5 text-success" /> Re-download
                anytime from Purchases
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 mt-0.5 text-success" /> Files
                stored in a private bucket
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
