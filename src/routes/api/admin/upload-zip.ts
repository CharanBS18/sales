import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { s3SignedWriteUrl } from "@/lib/s3.server";

// Streaming upload endpoint used by the admin "New project" dialog.
// The browser sends the raw zip as the request body (no multipart wrapping)
// so we can stream it straight to S3 without buffering in memory.
// XHR on the client tracks upload.onprogress to render a progress bar.
export const Route = createFileRoute("/api/admin/upload-zip")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // ---- Auth: verify Supabase bearer token ----
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        if (!token) return new Response("Unauthorized", { status: 401 });

        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );
        const { data: userData, error: userErr } = await supabase.auth.getUser(token);
        if (userErr || !userData.user) {
          return new Response("Unauthorized", { status: 401 });
        }
        const userId = userData.user.id;

        // ---- Admin check ----
        const supaAsUser = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          {
            auth: { persistSession: false, autoRefreshToken: false },
            global: { headers: { Authorization: `Bearer ${token}` } },
          },
        );
        const { data: roleRow } = await supaAsUser
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .eq("role", "admin")
          .maybeSingle();
        if (!roleRow) return new Response("Forbidden", { status: 403 });

        // ---- Stream the body to S3 ----
        const filename = request.headers.get("x-filename") ?? "upload.zip";
        const contentLength = request.headers.get("content-length");
        if (!contentLength) {
          return new Response("Content-Length required", { status: 411 });
        }
        if (!request.body) {
          return new Response("No body", { status: 400 });
        }

        const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
        const key = `projects/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safe}`;
        const { url, method } = await s3SignedWriteUrl(key);

        const upResp = await fetch(url, {
          method,
          body: request.body,
          headers: {
            "Content-Type": request.headers.get("content-type") ?? "application/zip",
            "Content-Length": contentLength,
          },
          // @ts-expect-error - required for streaming bodies in workerd/undici
          duplex: "half",
        });
        if (!upResp.ok) {
          const txt = await upResp.text().catch(() => "");
          return new Response(
            `S3 upload failed (${upResp.status}): ${txt.slice(0, 200)}`,
            { status: 502 },
          );
        }

        return Response.json({
          key,
          size: Number(contentLength),
        });
      },
    },
  },
});
