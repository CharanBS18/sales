import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { s3SignedReadUrl } from "./s3.server";

export const getDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { projectId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify ownership against the database — never trust URL params alone
    const { data: purchase, error } = await supabase
      .from("purchases")
      .select("id")
      .eq("user_id", userId)
      .eq("project_id", data.projectId)
      .maybeSingle();
    if (error) throw error;
    if (!purchase) {
      throw new Error("403: Purchase required to download this project");
    }

    const { data: project, error: pErr } = await supabase
      .from("projects")
      .select("file_key, name")
      .eq("id", data.projectId)
      .maybeSingle();
    if (pErr) throw pErr;
    if (!project) throw new Error("Project not found");

    const url = await s3SignedReadUrl(project.file_key);

    const ip =
      getRequestHeader("cf-connecting-ip") ??
      getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ??
      null;
    const ua = getRequestHeader("user-agent") ?? null;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("download_logs").insert({
      user_id: userId,
      project_id: data.projectId,
      ip_address: ip,
      user_agent: ua,
    });
    await supabaseAdmin.from("audit_logs").insert({
      user_id: userId,
      action: "download.started",
      details: { project_id: data.projectId, ip },
    });

    return { url, filename: `${project.name}.zip` };
  });
