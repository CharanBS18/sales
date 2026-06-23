import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  adminStats,
  adminListUsers,
  adminListPayments,
  adminListProjects,
  adminCreateProject,
  adminUpdateProject,
  adminDeleteProject,
  adminUploadProjectFile,
} from "@/lib/admin.functions";
import { Progress } from "@/components/ui/progress";
import { formatINR, formatDate, formatRelative } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Activity,
  CircleDollarSign,
  Download,
  Loader2,
  Package,
  Pencil,
  Plus,
  Receipt,
  Trash2,
  TrendingUp,
  Upload,
  Users,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes.user?.id;
    if (!uid) throw redirect({ to: "/auth" });
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", uid)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw redirect({ to: "/dashboard" });
  },
  component: AdminPage,
});


function AdminPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Admin</h1>
        <p className="text-sm text-muted-foreground">
          Marketplace operations, revenue, and project management.
        </p>
      </div>
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-6">
          <Overview />
        </TabsContent>
        <TabsContent value="projects" className="mt-6">
          <Projects />
        </TabsContent>
        <TabsContent value="payments" className="mt-6">
          <Payments />
        </TabsContent>
        <TabsContent value="users" className="mt-6">
          <UsersTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-xl border bg-surface p-5 shadow-card">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-sm">{label}</span>
        <Icon className="h-4 w-4" />
      </div>
      <div className="mt-3 font-display text-2xl font-semibold">{value}</div>
    </div>
  );
}

function Overview() {
  const fn = useServerFn(adminStats);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: () => fn(),
    refetchInterval: 15000,
  });
  if (isLoading || !data) {
    return <div className="h-48 rounded-xl border bg-surface animate-pulse" />;
  }
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Total revenue" value={formatINR(data.revenue.all)} icon={CircleDollarSign} />
        <Stat label="Revenue (month)" value={formatINR(data.revenue.month)} icon={TrendingUp} />
        <Stat label="Revenue (today)" value={formatINR(data.revenue.today)} icon={Activity} />
        <Stat label="Successful payments" value={data.counts.success} icon={Receipt} />
        <Stat label="Failed payments" value={data.counts.failed} icon={Receipt} />
        <Stat label="Users" value={data.counts.users} icon={Users} />
        <Stat label="Projects" value={data.counts.projects} icon={Package} />
        <Stat label="Downloads (recent)" value={data.recentDownloads.length} icon={Download} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Panel title="Recent purchases" icon={Receipt}>
          {data.recentPurchases.length === 0 ? (
            <Empty text="No purchases yet" />
          ) : (
            <ul className="space-y-3 text-sm">
              {data.recentPurchases.map((p: any) => (
                <li key={p.id} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{p.project?.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {p.profile?.username} · {formatRelative(p.created_at)}
                    </div>
                  </div>
                  <span className="font-medium tabular-nums">
                    {formatINR(p.amount_paise)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Recent logins" icon={Users}>
          {data.recentLogins.length === 0 ? (
            <Empty text="No logins yet" />
          ) : (
            <ul className="space-y-3 text-sm">
              {data.recentLogins.map((l: any) => (
                <li key={l.id} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{l.profiles?.username}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {l.browser} · {l.os} · {l.ip_address ?? "—"}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatRelative(l.login_time)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Recent downloads" icon={Download}>
          {data.recentDownloads.length === 0 ? (
            <Empty text="No downloads yet" />
          ) : (
            <ul className="space-y-3 text-sm">
              {data.recentDownloads.map((d: any) => (
                <li key={d.id} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{d.project?.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {d.profile?.username}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatRelative(d.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Panel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-surface p-5 shadow-card">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {title}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground py-6 text-center">{text}</p>;
}

// ============ Projects ============
function Projects() {
  const listFn = useServerFn(adminListProjects);
  const delFn = useServerFn(adminDeleteProject);
  const updateFn = useServerFn(adminUpdateProject);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "projects"],
    queryFn: () => listFn(),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <NewProjectDialog onCreated={() => qc.invalidateQueries({ queryKey: ["admin", "projects"] })} />
      </div>
      {isLoading ? (
        <div className="h-48 rounded-xl bg-surface border animate-pulse" />
      ) : (data ?? []).length === 0 ? (
        <div className="rounded-xl border bg-surface p-12 text-center">
          <Package className="h-10 w-10 text-muted-foreground mx-auto" />
          <p className="mt-3 font-medium">No projects yet</p>
        </div>
      ) : (
        <div className="rounded-xl border bg-surface overflow-hidden shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-5 py-3">Project</th>
                <th className="text-left font-medium px-5 py-3">Category</th>
                <th className="text-right font-medium px-5 py-3">Price</th>
                <th className="text-center font-medium px-5 py-3">Published</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((p: any) => (
                <tr key={p.id} className="border-t">
                  <td className="px-5 py-4">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">v{p.version}</div>
                  </td>
                  <td className="px-5 py-4">{p.category}</td>
                  <td className="px-5 py-4 text-right">{formatINR(p.price_paise)}</td>
                  <td className="px-5 py-4 text-center">
                    <Button
                      size="sm"
                      variant={p.is_published ? "default" : "outline"}
                      onClick={async () => {
                        await updateFn({
                          data: { id: p.id, patch: { is_published: !p.is_published } },
                        });
                        qc.invalidateQueries({ queryKey: ["admin", "projects"] });
                      }}
                    >
                      {p.is_published ? "Live" : "Hidden"}
                    </Button>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
                        await delFn({ data: { id: p.id } });
                        qc.invalidateQueries({ queryKey: ["admin", "projects"] });
                        toast.success("Deleted");
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
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

function NewProjectDialog({ onCreated }: { onCreated: () => void }) {
  const createFn = useServerFn(adminCreateProject);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Web App");
  const [version, setVersion] = useState("1.0.0");
  const [priceRupees, setPriceRupees] = useState("999");
  const [tags, setTags] = useState("");
  const [thumbnail, setThumbnail] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0); // 0–100
  const [uploading, setUploading] = useState(false);

  // Streaming upload via XHR so we get upload.onprogress for the progress bar.
  function uploadWithProgress(f: File, token: string): Promise<{ key: string }> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/admin/upload-zip");
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.setRequestHeader("Content-Type", f.type || "application/zip");
      xhr.setRequestHeader("x-filename", f.name);
      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) {
          setProgress(Math.round((ev.loaded / ev.total) * 100));
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch {
            reject(new Error("Bad server response"));
          }
        } else {
          reject(new Error(xhr.responseText || `Upload failed (${xhr.status})`));
        }
      };
      xhr.onerror = () => reject(new Error("Network error during upload"));
      xhr.send(f);
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      toast.error("Upload a ZIP file");
      return;
    }
    setBusy(true);
    setProgress(0);
    setUploading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Not signed in");

      const { key } = await uploadWithProgress(file, token);
      setUploading(false);

      await createFn({
        data: {
          name,
          description,
          category,
          version,
          tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          price_paise: Math.round(Number(priceRupees) * 100),
          file_key: key,
          file_size_bytes: file.size,
          thumbnail_url: thumbnail || undefined,
        },
      });
      toast.success("Project published");
      setOpen(false);
      setName(""); setDescription(""); setFile(null); setTags(""); setThumbnail("");
      setProgress(0);
      onCreated();
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setBusy(false);
      setUploading(false);
    }
  }


  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-1.5" />
          New project
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload a new project</DialogTitle>
        </DialogHeader>
        <form className="space-y-4 mt-4" onSubmit={submit}>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Version</Label>
              <Input value={version} onChange={(e) => setVersion(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Price (₹)</Label>
              <Input
                type="number"
                min="0"
                step="1"
                value={priceRupees}
                onChange={(e) => setPriceRupees(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tags (comma-separated)</Label>
              <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="react, dashboard" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Thumbnail URL (optional)</Label>
              <Input
                value={thumbnail}
                onChange={(e) => setThumbnail(e.target.value)}
                placeholder="https://…"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Project ZIP</Label>
              <Input
                type="file"
                accept=".zip,application/zip"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {file && (
                <p className="text-xs text-muted-foreground">
                  {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              )}
              {(uploading || progress > 0) && (
                <div className="space-y-1 pt-1">
                  <Progress value={progress} className="h-2" />
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {uploading
                      ? `Uploading… ${progress}%`
                      : progress === 100
                        ? "Upload complete · finalizing…"
                        : `${progress}%`}
                  </p>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={busy} className="min-w-32">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Upload className="h-4 w-4 mr-1.5" /> Publish</>}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============ Payments ============
function Payments() {
  const fn = useServerFn(adminListPayments);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "payments"],
    queryFn: () => fn(),
    refetchInterval: 10000,
  });
  if (isLoading) return <div className="h-48 rounded-xl bg-surface border animate-pulse" />;
  return (
    <div className="rounded-xl border bg-surface overflow-hidden shadow-card">
      <table className="w-full text-sm">
        <thead className="bg-surface-muted text-muted-foreground">
          <tr>
            <th className="text-left font-medium px-5 py-3">User</th>
            <th className="text-left font-medium px-5 py-3">Project</th>
            <th className="text-left font-medium px-5 py-3">Gateway</th>
            <th className="text-right font-medium px-5 py-3">Amount</th>
            <th className="text-center font-medium px-5 py-3">Status</th>
            <th className="text-left font-medium px-5 py-3">When</th>
          </tr>
        </thead>
        <tbody>
          {(data ?? []).map((p: any) => (
            <tr key={p.id} className="border-t">
              <td className="px-5 py-3">
                <div className="font-medium">{p.profile?.username}</div>
                <div className="text-xs text-muted-foreground">{p.profile?.email}</div>
              </td>
              <td className="px-5 py-3">{p.project?.name}</td>
              <td className="px-5 py-3 text-muted-foreground">{p.gateway}</td>
              <td className="px-5 py-3 text-right">{formatINR(p.amount_paise)}</td>
              <td className="px-5 py-3 text-center">
                <StatusBadge status={p.status} />
              </td>
              <td className="px-5 py-3 text-muted-foreground">
                {formatDate(p.created_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    SUCCESS: "bg-success text-success-foreground",
    PENDING: "bg-warning text-warning-foreground",
    FAILED: "bg-destructive text-destructive-foreground",
    REFUNDED: "bg-muted text-muted-foreground",
  };
  return (
    <Badge className={`${map[status] ?? "bg-muted"} border-0`}>{status}</Badge>
  );
}

// ============ Users ============
function UsersTab() {
  const fn = useServerFn(adminListUsers);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => fn(),
  });
  if (isLoading) return <div className="h-48 rounded-xl bg-surface border animate-pulse" />;
  return (
    <div className="rounded-xl border bg-surface overflow-hidden shadow-card">
      <table className="w-full text-sm">
        <thead className="bg-surface-muted text-muted-foreground">
          <tr>
            <th className="text-left font-medium px-5 py-3">User</th>
            <th className="text-left font-medium px-5 py-3">Joined</th>
            <th className="text-left font-medium px-5 py-3">Last login</th>
            <th className="text-right font-medium px-5 py-3">Purchases</th>
            <th className="text-right font-medium px-5 py-3">Downloads</th>
            <th className="text-right font-medium px-5 py-3">Spent</th>
          </tr>
        </thead>
        <tbody>
          {(data ?? []).map((u: any) => (
            <tr key={u.user_id} className="border-t">
              <td className="px-5 py-3">
                <div className="font-medium">{u.username}</div>
                <div className="text-xs text-muted-foreground">{u.email}</div>
              </td>
              <td className="px-5 py-3 text-muted-foreground">
                {formatDate(u.created_at)}
              </td>
              <td className="px-5 py-3 text-muted-foreground">
                {u.last_login ? formatRelative(u.last_login) : "—"}
              </td>
              <td className="px-5 py-3 text-right tabular-nums">{u.purchases}</td>
              <td className="px-5 py-3 text-right tabular-nums">{u.downloads}</td>
              <td className="px-5 py-3 text-right tabular-nums">{formatINR(u.spent_paise)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Silence unused-import warning for Pencil (reserved for future edit modal)
void Pencil;
