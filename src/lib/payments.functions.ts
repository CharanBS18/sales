import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createRazorpayOrder, verifyCheckoutSignature } from "./razorpay.server";

export const startCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { projectId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Always read the price from the database — never trust the client
    const { data: project, error: pErr } = await supabase
      .from("projects")
      .select("id, name, price_paise, is_published")
      .eq("id", data.projectId)
      .maybeSingle();
    if (pErr) throw pErr;
    if (!project || !project.is_published) throw new Error("Project not available");

    // Already owned?
    const { data: existing } = await supabase
      .from("purchases")
      .select("id")
      .eq("user_id", userId)
      .eq("project_id", project.id)
      .maybeSingle();
    if (existing) throw new Error("You already own this project");

    const order = await createRazorpayOrder({
      amountPaise: project.price_paise,
      receipt: `p_${project.id.slice(0, 8)}_${Date.now().toString(36)}`,
      notes: { project_id: project.id, user_id: userId },
    });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: insErr } = await supabaseAdmin.from("payments").insert({
      user_id: userId,
      project_id: project.id,
      gateway: "razorpay",
      order_id: order.id,
      amount_paise: project.price_paise,
      status: "PENDING",
    });
    if (insErr) throw insErr;

    return {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID!,
      projectName: project.name,
    };
  });

export const verifyAndGrant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { orderId: string; paymentId: string; signature: string }) => d,
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const ok = verifyCheckoutSignature({
      orderId: data.orderId,
      paymentId: data.paymentId,
      signature: data.signature,
    });
    if (!ok) throw new Error("Invalid payment signature");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: pay, error } = await supabaseAdmin
      .from("payments")
      .select("id, user_id, project_id, amount_paise, status")
      .eq("order_id", data.orderId)
      .maybeSingle();
    if (error) throw error;
    if (!pay) throw new Error("Order not found");
    if (pay.user_id !== userId) throw new Error("Order does not belong to user");

    await supabaseAdmin
      .from("payments")
      .update({ status: "SUCCESS", payment_id: data.paymentId })
      .eq("id", pay.id);

    // Idempotent: unique(user_id, project_id) prevents duplicates
    await supabaseAdmin.from("purchases").upsert(
      {
        user_id: pay.user_id,
        project_id: pay.project_id,
        payment_id: pay.id,
        amount_paise: pay.amount_paise,
      },
      { onConflict: "user_id,project_id", ignoreDuplicates: true },
    );

    await supabaseAdmin.from("audit_logs").insert({
      user_id: pay.user_id,
      action: "purchase.created",
      details: { project_id: pay.project_id, payment_id: data.paymentId },
    });

    return { ok: true, projectId: pay.project_id };
  });

export const recordLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const ua = getRequestHeader("user-agent") ?? "";
    const ip =
      getRequestHeader("cf-connecting-ip") ??
      getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ??
      null;

    // crude UA parsing
    const browser = /Edg\//.test(ua)
      ? "Edge"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Other";
    const os = /Windows/.test(ua)
      ? "Windows"
      : /Mac OS X/.test(ua)
        ? "macOS"
        : /Android/.test(ua)
          ? "Android"
          : /iPhone|iPad/.test(ua)
            ? "iOS"
            : /Linux/.test(ua)
              ? "Linux"
              : "Other";
    const device = /Mobi|Android|iPhone/.test(ua) ? "mobile" : "desktop";

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("login_activity").insert({
      user_id: userId,
      ip_address: ip,
      browser,
      os,
      device_type: device,
      status: "ONLINE",
    });
    await supabaseAdmin.from("audit_logs").insert({
      user_id: userId,
      action: "user.login",
      details: { ip, browser, os },
    });
    return { ok: true };
  });
