import { createFileRoute } from "@tanstack/react-router";
import { verifyWebhookSignature } from "@/lib/razorpay.server";

/**
 * Razorpay webhook receiver. The webhook is the authoritative source of truth
 * for payment status — even if the client never reports back, this still
 * marks the payment as SUCCESS and grants the purchase.
 */
export const Route = createFileRoute("/api/public/razorpay-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const signature = request.headers.get("x-razorpay-signature") ?? "";
        const body = await request.text();
        if (!verifyWebhookSignature(body, signature)) {
          return new Response("invalid signature", { status: 401 });
        }

        let payload: any;
        try {
          payload = JSON.parse(body);
        } catch {
          return new Response("bad json", { status: 400 });
        }

        const event: string = payload.event ?? "";
        const entity = payload.payload?.payment?.entity;
        const orderId: string | undefined = entity?.order_id;
        const paymentId: string | undefined = entity?.id;
        const amount: number | undefined = entity?.amount;
        if (!orderId) return new Response("ok"); // ignore unrelated events

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );
        const { data: pay } = await supabaseAdmin
          .from("payments")
          .select("id, user_id, project_id, amount_paise, status")
          .eq("order_id", orderId)
          .maybeSingle();
        if (!pay) return new Response("unknown order", { status: 202 });

        if (event === "payment.captured" || event === "order.paid") {
          if (typeof amount === "number" && amount !== pay.amount_paise) {
            await supabaseAdmin
              .from("payments")
              .update({ status: "FAILED", raw: payload })
              .eq("id", pay.id);
            return new Response("amount mismatch", { status: 400 });
          }
          await supabaseAdmin
            .from("payments")
            .update({ status: "SUCCESS", payment_id: paymentId, raw: payload })
            .eq("id", pay.id);
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
            action: "webhook.payment_captured",
            details: { order_id: orderId, payment_id: paymentId },
          });
        } else if (event === "payment.failed") {
          await supabaseAdmin
            .from("payments")
            .update({ status: "FAILED", payment_id: paymentId, raw: payload })
            .eq("id", pay.id);
        }

        return new Response("ok");
      },
    },
  },
});
