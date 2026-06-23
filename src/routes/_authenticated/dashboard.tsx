import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { listProjects } from "@/lib/projects.functions";
import { formatINR } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, CheckCircle2, Package } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const list = useServerFn(listProjects);
  const { data, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => list(),
  });
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [sort, setSort] = useState("latest");

  const categories = useMemo(() => {
    const s = new Set<string>();
    (data ?? []).forEach((p) => s.add(p.category));
    return Array.from(s).sort();
  }, [data]);

  const filtered = useMemo(() => {
    const ql = q.toLowerCase().trim();
    let rows = (data ?? []).filter((p) => {
      if (cat !== "all" && p.category !== cat) return false;
      if (!ql) return true;
      return (
        p.name.toLowerCase().includes(ql) ||
        p.category.toLowerCase().includes(ql) ||
        p.tags.some((t) => t.toLowerCase().includes(ql))
      );
    });
    rows = [...rows];
    if (sort === "latest")
      rows.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    if (sort === "oldest")
      rows.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
    if (sort === "price_asc") rows.sort((a, b) => a.price_paise - b.price_paise);
    if (sort === "price_desc") rows.sort((a, b) => b.price_paise - a.price_paise);
    return rows;
  }, [data, q, cat, sort]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-semibold">Marketplace</h1>
          <p className="text-sm text-muted-foreground">
            Browse {data?.length ?? 0} project{(data?.length ?? 0) === 1 ? "" : "s"} ·
            Pay per project, download forever.
          </p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, category, or tag…"
            className="pl-9 h-11 bg-surface"
          />
        </div>
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="md:w-48 h-11 bg-surface">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="md:w-48 h-11 bg-surface">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="latest">Latest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
            <SelectItem value="price_asc">Price: low to high</SelectItem>
            <SelectItem value="price_desc">Price: high to low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-64 rounded-xl bg-surface border animate-pulse"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border bg-surface p-16 text-center">
          <Package className="h-10 w-10 text-muted-foreground mx-auto" />
          <p className="mt-3 font-medium">No projects match your filters</p>
          <p className="text-sm text-muted-foreground">
            Try clearing the search or category.
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <Link
              key={p.id}
              to="/projects/$id"
              params={{ id: p.id }}
              className="group rounded-xl border bg-surface overflow-hidden shadow-card hover:shadow-elevated transition-shadow"
            >
              <div className="aspect-video bg-accent relative overflow-hidden">
                {p.thumbnail_url ? (
                  <img
                    src={p.thumbnail_url}
                    alt={p.name}
                    className="h-full w-full object-cover group-hover:scale-[1.02] transition-transform"
                  />
                ) : (
                  <div className="h-full w-full grid place-items-center text-muted-foreground">
                    <Package className="h-10 w-10" />
                  </div>
                )}
                {p.owned && (
                  <Badge className="absolute top-3 right-3 bg-success text-success-foreground border-0">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Owned
                  </Badge>
                )}
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="secondary">{p.category}</Badge>
                  <span className="text-xs text-muted-foreground">v{p.version}</span>
                </div>
                <h3 className="mt-3 font-display text-lg font-semibold leading-snug line-clamp-1">
                  {p.name}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]">
                  {p.description}
                </p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="font-display text-xl font-semibold">
                    {formatINR(p.price_paise)}
                  </span>
                  <Button size="sm" variant={p.owned ? "outline" : "default"}>
                    {p.owned ? "Download" : "Buy now"}
                  </Button>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
