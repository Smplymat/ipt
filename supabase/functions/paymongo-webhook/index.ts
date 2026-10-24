import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { handleCors, jsonWithCors, errorWithCors } from "../_shared/cors.ts";

// NOTE: this function must be deployed WITHOUT JWT verification
// (see supabase/config.toml), because PayMongo does not send a Supabase JWT.
// Authenticity is established by the HMAC signature check below instead.

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const webhookSecret = Deno.env.get("PAYMONGO_WEBHOOK_SECRET");
    if (!webhookSecret) {
      console.error("PAYMONGO_WEBHOOK_SECRET not configured");
      return errorWithCors("Webhook secret not configured", 500);
    }

    const signatureHeader = req.headers.get("paymongo-signature");
    if (!signatureHeader) {
      console.warn("Missing paymongo-signature header");
      return errorWithCors("Missing signature", 400);
    }

    // Must be the raw, unmodified body.
    const body = await req.text();

    let event: any;
    try {
      event = JSON.parse(body);
    } catch {
      return errorWithCors("Invalid JSON", 400);
    }

    // The header looks like:  t=1496734173,te=<test sig>,li=<live sig>
    // The signed string is `${t}.${rawBody}`, HMAC-SHA256 with the webhook
    // secret. Test-mode events carry `te`, live-mode events carry `li`.
    const parts = Object.fromEntries(
      signatureHeader.split(",").map((p) => {
        const i = p.indexOf("=");
        return [p.slice(0, i).trim(), p.slice(i + 1).trim()];
      }),
    ) as Record<string, string>;

    const timestamp = parts["t"];
    const livemode = event?.data?.attributes?.livemode === true;
    const providedSignature = livemode ? parts["li"] : parts["te"];

    if (!timestamp || !providedSignature) {
      console.warn("Malformed paymongo-signature header");
      return errorWithCors("Malformed signature", 400);
    }

    const expectedSignature = await hmacSha256Hex(webhookSecret, `${timestamp}.${body}`);

    if (!timingSafeEqual(providedSignature, expectedSignature)) {
      console.warn("Invalid webhook signature");
      return errorWithCors("Invalid signature", 400);
    }

    // Event shape:
    //   event.data.attributes.type  -> "checkout_session.payment.paid"
    //   event.data.attributes.data  -> the checkout session resource
    //        .id                    -> "cs_..."
    //        .attributes.metadata   -> { order_id, payment_method }
    const eventType: string = event?.data?.attributes?.type ?? "";
    const resource = event?.data?.attributes?.data;
    const paymongoReference: string | undefined = resource?.id;
    const orderId: string | undefined =
      resource?.attributes?.metadata?.order_id ??
      resource?.attributes?.reference_number;

    console.log("PayMongo webhook event:", eventType, "order:", orderId);

    // Acknowledge events we don't act on so PayMongo doesn't keep retrying.
    if (!orderId) {
      console.warn("No order_id in event; ignoring");
      return jsonWithCors({ success: true, ignored: true });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (eventType.endsWith(".paid")) {
      // Paid wins regardless of which session reference is stored (the
      // customer may have retried and created a newer session).
      const { error } = await supabase
        .from("orders")
        .update({
          payment_status: "paid",
          paid_at: new Date().toISOString(),
          ...(paymongoReference ? { paymongo_reference: paymongoReference } : {}),
        })
        .eq("id", orderId)
        .neq("payment_status", "paid");

      if (error) {
        console.error("Failed to mark order paid:", error);
        return errorWithCors("Failed to update order", 500);
      }
      console.log(`Order ${orderId} marked paid`);
    } else if (eventType.endsWith(".failed") || eventType.endsWith(".expired")) {
      // Only downgrade a still-pending order for the SAME session; never
      // overwrite a paid order or a newer retry.
      let q = supabase
        .from("orders")
        .update({ payment_status: "failed" })
        .eq("id", orderId)
        .eq("payment_status", "pending");
      if (paymongoReference) q = q.eq("paymongo_reference", paymongoReference);

      const { error } = await q;
      if (error) {
        console.error("Failed to mark order failed:", error);
        return errorWithCors("Failed to update order", 500);
      }
      console.log(`Order ${orderId} marked failed`);
    } else {
      console.log("Unhandled event type; ignoring:", eventType);
    }

    return jsonWithCors({ success: true });
  } catch (err) {
    console.error("paymongo-webhook error:", err);
    return errorWithCors("Internal server error", 500);
  }
});

async function hmacSha256Hex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
