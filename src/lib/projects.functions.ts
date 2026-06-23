import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface ProjectCard {
  id: string;
  name: string;
  description: string;
  category: string;
  thumbnail_url: string | null;
  version: string;
  tags: string[];
  price_paise: number;
  created_at: string;
  owned: boolean;
}

export const listProjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProjectCard[]> => {
    const { supabase, userId } = context;
    const { data: projects, error } = await supabase
      .from("projects")
      .select(
        "id, name, description, category, thumbnail_url, version, tags, price_paise, created_at, is_published",
      )
      .eq("is_published", true)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const { data: purchases } = await supabase
      .from("purchases")
      .select("project_id")
      .eq("user_id", userId);
    const owned = new Set((purchases ?? []).map((p) => p.project_id));
    return (projects ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      category: p.category,
      thumbnail_url: p.thumbnail_url,
      version: p.version,
      tags: p.tags ?? [],
      price_paise: p.price_paise,
      created_at: p.created_at,
      owned: owned.has(p.id),
    }));
  });

export const getProject = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: project, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw error;
    if (!project) throw new Error("Project not found");
    const { data: purchase } = await supabase
      .from("purchases")
      .select("id, created_at, amount_paise")
      .eq("user_id", userId)
      .eq("project_id", data.id)
      .maybeSingle();
    return {
      ...project,
      owned: !!purchase,
      purchase: purchase ?? null,
    };
  });

export const myPurchases = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("purchases")
      .select(
        "id, amount_paise, created_at, project:projects(id, name, thumbnail_url, version, category)",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const myProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    return {
      profile,
      isAdmin: (roles ?? []).some((r) => r.role === "admin"),
    };
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { username?: string; avatar_url?: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch: { username?: string; avatar_url?: string } = {};
    if (data.username) {
      if (data.username.length < 4 || data.username.length > 20) {
        throw new Error("Username must be 4–20 characters");
      }
      patch.username = data.username;
    }
    if (data.avatar_url !== undefined) patch.avatar_url = data.avatar_url;
    const { error } = await supabase.from("profiles").update(patch).eq("user_id", userId);
    if (error) {
      if (error.code === "23505") throw new Error("Username already exists");
      throw error;
    }
    return { ok: true };
  });
