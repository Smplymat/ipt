import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { corsHeaders, handleCors, jsonWithCors, errorWithCors } from "../_shared/cors.ts";

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const webhookSecret = Deno.env.get("PAYMONGO_WEBHOOK_SECRET");
    if (!webhookSecret) {
      console.error("PAYMONGO_WEBHOOK_SECRET not configured");
      return errorWithCors("Webhook secret not configured", 500);
    }

    // Verify PayMongo signature
    const signature = req.headers.get("paymongo-signature");
    if (!signature) {
      console.warn("Missing paymongo-signature header");
      return errorWithCors("Missing signature", 400);
    }

    const body = await req.text();
    const expectedSignature = await generateHmacSha256(webhookSecret, body);

    if (signature !== expectedSignature) {
      console.warn("Invalid webhook signature");
      return errorWithCors("Invalid signature", 400);
    }

    const event = JSON.parse(body);
    console.log("PayMongo webhook event:", event.data?.attributes?.type);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Handle different event types
    const eventType = event.data?.attributes?.type;
    const checkoutSession = event.data?.attributes?.data?.attributes;

    if (!checkoutSession) {
      return errorWithCors("No checkout session data", 400);
    }

    const orderId = checkoutSession.metadata?.order_id;
    const paymongoReference = checkoutSession.id;
    const paymentStatus = checkoutSession.payment_status;

    if (!orderId) {
      console.warn("No order_id in metadata");
      return errorWithCors("No order_id in metadata", 400);
    }

    // Map PayMongo payment status to our payment_status
    let newPaymentStatus = "pending";
    if (paymentStatus === "paid") {
      newPaymentStatus = "paid";
    } else if (paymentStatus === "failed" || paymentStatus === "expired") {
      newPaymentStatus = "failed";
    } else if (paymentStatus === "refunded") {
      newPaymentStatus = "refunded";
    }

    // Update the order
    const { error: updateError } = await supabase
      .from("orders")
      .update({
        payment_status: newPaymentStatus,
        paymongo_reference: paymongoReference,
        paid_at: newPaymentStatus === "paid" ? new Date().toISOString() : null,
      })
      .eq("id", orderId)
      .eq("paymongo_reference", paymongoReference);

    if (updateError) {
      console.error("Failed to update order:", updateError);
      return errorWithCors("Failed to update order", 500);
    }

    console.log(`Order ${orderId} payment status updated to ${newPaymentStatus}`);

    return jsonWithCors({ success: true });

  } catch (err) {
    console.error("paymongo-webhook error:", err);
    return errorWithCors("Internal server error", 500);
  }
});

async function generateHmacSha256(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}