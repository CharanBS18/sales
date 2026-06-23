import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { myPurchases } from "@/lib/projects.functions";
import { getDownloadUrl } from "@/lib/download.functions";
import { formatINR, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Download, Package, Receipt } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/purchases")({
  component: PurchasesPage,
});

function PurchasesPage() {
  const list = useServerFn(myPurchases);
  const downloadFn = useServerFn(getDownloadUrl);
  const { data, isLoading } = useQuery({
    queryKey: ["purchases"],
    queryFn: () => list(),
  });
  const [busyId, setBusyId] = useState<string | null>(null);

  async function onDownload(projectId: string) {
    setBusyId(projectId);
    try {
      const { url, filename } = await downloadFn({ data: { projectId } });
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e: any) {
      toast.error(e.message ?? "Download failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Your purchases</h1>
        <p className="text-sm text-muted-foreground">
          Re-download anything you own with a fresh signed URL.
        </p>
      </div>

      {isLoading ? (
        <div className="h-48 rounded-xl bg-surface border animate-pulse" />
      ) : !data || data.length === 0 ? (
        <div className="rounded-xl border bg-surface p-16 text-center">
          <Receipt className="h-10 w-10 text-muted-foreground mx-auto" />
          <p className="mt-3 font-medium">No purchases yet</p>
          <p className="text-sm text-muted-foreground">
            Browse the marketplace and buy your first project.
          </p>
          <Link to="/dashboard">
            <Button className="mt-4">Browse marketplace</Button>
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border bg-surface overflow-hidden shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-5 py-3">Project</th>
                <th className="text-left font-medium px-5 py-3">Date</th>
                <th className="text-right font-medium px-5 py-3">Amount</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {data.map((p: any) => (
                <tr key={p.id} className="border-t">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-md bg-accent grid place-items-center overflow-hidden shrink-0">
                        {p.project?.thumbnail_url ? (
                          <img
                            src={p.project.thumbnail_url}
                            className="h-full w-full object-cover"
                            alt=""
                          />
                        ) : (
                          <Package className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium truncate">
                          {p.project?.name ?? "—"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {p.project?.category}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-muted-foreground">
                    {formatDate(p.created_at)}
                  </td>
                  <td className="px-5 py-4 text-right font-medium">
                    {formatINR(p.amount_paise)}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Button
                      size="sm"
                      onClick={() => onDownload(p.project.id)}
                      disabled={busyId === p.project.id}
                    >
                      <Download className="h-4 w-4 mr-1.5" />
                      Download
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
