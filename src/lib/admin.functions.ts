import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { s3SignedWriteUrl } from "./s3.server";

async function assertAdmin(supabase: ReturnType<typeof getCtx>["supabase"], userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("403: Admin access required");
}
// helper for typing only
function getCtx() {
  return null as unknown as { supabase: any };
}

export const adminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [
      usersC,
      projectsC,
      successPay,
      failPay,
      revenueAll,
      revenueToday,
      revenueMonth,
      recentLogins,
      recentPurchases,
      recentDownloads,
    ] = await Promise.all([
      supabaseAdmin.from("profiles").select("user_id", { count: "exact", head: true }),
      supabaseAdmin.from("projects").select("id", { count: "exact", head: true }),
      supabaseAdmin
        .from("payments")
        .select("id", { count: "exact", head: true })
        .eq("status", "SUCCESS"),
      supabaseAdmin
        .from("payments")
        .select("id", { count: "exact", head: true })
        .eq("status", "FAILED"),
      supabaseAdmin.from("payments").select("amount_paise").eq("status", "SUCCESS"),
      supabaseAdmin
        .from("payments")
        .select("amount_paise")
        .eq("status", "SUCCESS")
        .gte("created_at", startOfDay.toISOString()),
      supabaseAdmin
        .from("payments")
        .select("amount_paise")
        .eq("status", "SUCCESS")
        .gte("created_at", startOfMonth.toISOString()),
      supabaseAdmin
        .from("login_activity")
        .select("id, login_time, browser, os, ip_address, user_id, profiles:profiles!inner(username, email)")
        .order("login_time", { ascending: false })
        .limit(8),
      supabaseAdmin
        .from("purchases")
        .select(
          "id, created_at, amount_paise, user_id, project:projects(name), profile:profiles!inner(username, email)",
        )
        .order("created_at", { ascending: false })
        .limit(8),
      supabaseAdmin
        .from("download_logs")
        .select(
          "id, created_at, user_id, project:projects(name), profile:profiles!inner(username)",
        )
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

    const sum = (rows: { amount_paise: number }[] | null) =>
      (rows ?? []).reduce((a, r) => a + r.amount_paise, 0);

    return {
      counts: {
        users: usersC.count ?? 0,
        projects: projectsC.count ?? 0,
        success: successPay.count ?? 0,
        failed: failPay.count ?? 0,
      },
      revenue: {
        all: sum(revenueAll.data),
        today: sum(revenueToday.data),
        month: sum(revenueMonth.data),
      },
      recentLogins: recentLogins.data ?? [],
      recentPurchases: recentPurchases.data ?? [],
      recentDownloads: recentDownloads.data ?? [],
    };
  });

export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: users } = await supabaseAdmin
      .from("profiles")
      .select("user_id, username, email, created_at")
      .order("created_at", { ascending: false })
      .limit(200);

    const ids = (users ?? []).map((u) => u.user_id);
    const [{ data: purchases }, { data: downloads }, { data: logins }] = await Promise.all([
      supabaseAdmin.from("purchases").select("user_id, amount_paise").in("user_id", ids),
      supabaseAdmin.from("download_logs").select("user_id").in("user_id", ids),
      supabaseAdmin
        .from("login_activity")
        .select("user_id, login_time")
        .in("user_id", ids)
        .order("login_time", { ascending: false }),
    ]);

    const purchaseAgg = new Map<string, { count: number; spent: number }>();
    (purchases ?? []).forEach((p) => {
      const cur = purchaseAgg.get(p.user_id) ?? { count: 0, spent: 0 };
      cur.count += 1;
      cur.spent += p.amount_paise;
      purchaseAgg.set(p.user_id, cur);
    });
    const dlCount = new Map<string, number>();
    (downloads ?? []).forEach((d) => dlCount.set(d.user_id, (dlCount.get(d.user_id) ?? 0) + 1));
    const lastLogin = new Map<string, string>();
    (logins ?? []).forEach((l) => {
      if (!lastLogin.has(l.user_id)) lastLogin.set(l.user_id, l.login_time);
    });

    return (users ?? []).map((u) => ({
      ...u,
      purchases: purchaseAgg.get(u.user_id)?.count ?? 0,
      spent_paise: purchaseAgg.get(u.user_id)?.spent ?? 0,
      downloads: dlCount.get(u.user_id) ?? 0,
      last_login: lastLogin.get(u.user_id) ?? null,
    }));
  });

export const adminListPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("payments")
      .select(
        "id, created_at, gateway, order_id, payment_id, amount_paise, status, project:projects(name), profile:profiles!inner(username, email)",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    return data ?? [];
  });

export const adminListProjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });
    return data ?? [];
  });

export const adminGetUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { filename: string; contentType?: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const safe = data.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `projects/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safe}`;
    const { url, method } = await s3SignedWriteUrl(key);
    return { url, method, key };
  });

// Server-side proxied upload — avoids browser CORS issues on direct S3 PUT.
// Accepts multipart/form-data with a "file" field. Returns the object key + size.
export const adminUploadProjectFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    if (!(d instanceof FormData)) throw new Error("Expected FormData");
    const file = d.get("file");
    if (!(file instanceof File)) throw new Error("Missing file");
    return { file };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { file } = data;
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `projects/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safe}`;
    const { url, method } = await s3SignedWriteUrl(key);
    // Stream the file body directly to S3 — never buffer into memory
    // (Worker memory limit ~128MB; .arrayBuffer() on a large zip OOMs).
    const upResp = await fetch(url, {
      method,
      body: file.stream(),
      headers: {
        "Content-Type": file.type || "application/zip",
        "Content-Length": String(file.size),
      },
      // @ts-expect-error - required for streaming request bodies in workerd/undici
      duplex: "half",
    });
    if (!upResp.ok) {
      const txt = await upResp.text().catch(() => "");
      throw new Error(`S3 upload failed (${upResp.status}): ${txt.slice(0, 200)}`);
    }
    return { key, size: file.size };
  });

export const adminCreateProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      name: string;
      description: string;
      category: string;
      price_paise: number;
      version: string;
      tags: string[];
      file_key: string;
      file_size_bytes?: number;
      thumbnail_url?: string;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (!data.name || data.name.length < 3) throw new Error("Name too short");
    if (data.price_paise < 0) throw new Error("Invalid price");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("projects")
      .insert({
        name: data.name,
        description: data.description,
        category: data.category,
        price_paise: data.price_paise,
        version: data.version,
        tags: data.tags,
        file_key: data.file_key,
        file_size_bytes: data.file_size_bytes ?? null,
        thumbnail_url: data.thumbnail_url ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    await supabaseAdmin.from("audit_logs").insert({
      user_id: context.userId,
      action: "project.created",
      details: { project_id: row.id, name: row.name },
    });
    return row;
  });

export const adminUpdateProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      id: string;
      patch: Partial<{
        name: string;
        description: string;
        category: string;
        price_paise: number;
        version: string;
        tags: string[];
        is_published: boolean;
        thumbnail_url: string;
      }>;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("projects")
      .update(data.patch)
      .eq("id", data.id);
    if (error) throw error;
    await supabaseAdmin.from("audit_logs").insert({
      user_id: context.userId,
      action: "project.updated",
      details: { project_id: data.id, patch: data.patch },
    });
    return { ok: true };
  });

export const adminDeleteProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("projects").delete().eq("id", data.id);
    if (error) throw error;
    await supabaseAdmin.from("audit_logs").insert({
      user_id: context.userId,
      action: "project.deleted",
      details: { project_id: data.id },
    });
    return { ok: true };
  });

const ALLOWED_ADMIN_EMAIL = "charanasadmin@gmail.com";

export const adminGrantSelf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { code: string }) => d)
  .handler(async ({ data, context }) => {
    // Bootstrap admin grant: restricted to a single allowed admin email AND
    // requires the ADMIN_BOOTSTRAP_CODE secret.
    const code = process.env.ADMIN_BOOTSTRAP_CODE;
    if (!code) throw new Error("Admin bootstrap is disabled");

    const callerEmail = (context.claims?.email ?? "").toLowerCase();
    if (callerEmail !== ALLOWED_ADMIN_EMAIL) {
      throw new Error("This account is not allowed to become admin");
    }
    if (data.code !== code) throw new Error("Invalid code");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("user_roles")
      .upsert(
        { user_id: context.userId, role: "admin" },
        { onConflict: "user_id,role", ignoreDuplicates: true },
      );
    await supabaseAdmin.from("audit_logs").insert({
      user_id: context.userId,
      action: "role.admin_granted",
    });
    return { ok: true };
  });
