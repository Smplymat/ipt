import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { handleCors, jsonWithCors, errorWithCors } from "../_shared/cors.ts";

const PAYMENT_METHODS = ["card", "gcash", "paymaya", "grab_pay", "cod"];

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return errorWithCors("Missing authorization header", 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    // 1) User-scoped client: identifies the caller and reads only their own
    //    orders (RLS enforced).
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    // 2) Service-role client: used ONLY for the payment bookkeeping writes.
    //    Customers are not allowed to UPDATE payment columns under the orders
    //    RLS policy (they may only cancel), so these writes need elevated
    //    rights. Ownership is verified through the user client first.
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return errorWithCors("Unauthorized", 401);
    }

    const body = await req.json();
    const { order_id, payment_method, client } = body;

    if (!order_id || !payment_method) {
      return errorWithCors("Missing order_id or payment_method", 400);
    }

    if (!PAYMENT_METHODS.includes(payment_method)) {
      return errorWithCors("Invalid payment method", 400);
    }

    // Fetch the order to get the total amount (never trust the client).
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, user_id, total, payment_method, payment_status, status")
      .eq("id", order_id)
      .eq("user_id", user.id)
      .single();

    if (orderError || !order) {
      return errorWithCors("Order not found", 404);
    }

    if (order.payment_status === "paid") {
      return errorWithCors("Order already paid", 400);
    }

    if (order.status === "cancelled") {
      return errorWithCors("Order was cancelled", 400);
    }

    // Convert total to centavos (PHP * 100) — PayMongo wants an integer.
    const amountInCentavos = Math.round(Number(order.total) * 100);

    // COD: just record it and return success.
    if (payment_method === "cod") {
      const { error: updateError } = await admin
        .from("orders")
        .update({ payment_method: "cod", payment_status: "unpaid" })
        .eq("id", order_id);

      if (updateError) {
        console.error("COD update failed:", updateError);
        return errorWithCors(updateError.message, 500);
      }

      return jsonWithCors({ success: true, order_id, payment_method: "cod" });
    }

    // Online payment methods: create a PayMongo Checkout Session.
    const paymongoSecretKey = Deno.env.get("PAYMONGO_SECRET_KEY");
    if (!paymongoSecretKey) {
      console.error("PAYMONGO_SECRET_KEY not configured");
      return errorWithCors("Payment gateway not configured", 500);
    }

    // Where PayMongo sends the customer afterwards. Prefer the APP_URL secret;
    // otherwise fall back to the site the request came from (so a Netlify
    // deploy doesn't redirect to localhost).
    const appUrl = (
      Deno.env.get("APP_URL") ||
      req.headers.get("origin") ||
      "http://localhost:4200"
    ).replace(/\/+$/, "");

    // Installed mobile app: send the customer through the payment-return
    // function, which bounces them back into the app via a deep link
    // (com.kneadtoknow.app://payment-return?...). Website: normal pages.
    const isApp = client === "app";
    const returnBase = `${supabaseUrl}/functions/v1/payment-return`;
    const successUrl = isApp
      ? `${returnBase}?status=success&order_id=${order_id}`
      : `${appUrl}/payment-success?order_id=${order_id}`;
    const cancelUrl = isApp
      ? `${returnBase}?status=cancelled&order_id=${order_id}`
      : `${appUrl}/payment-cancelled?order_id=${order_id}`;

    const shortId = String(order_id).slice(0, 8).toUpperCase();

    // Checkout Sessions require `line_items` (name/amount/currency/quantity);
    // a top-level amount/currency is not accepted. One line carries the full
    // server-computed total so it already includes tax, delivery and discounts.
    const requestBody = {
      data: {
        attributes: {
          line_items: [
            {
              name: `Knead to Know Order #${shortId}`,
              amount: amountInCentavos,
              currency: "PHP",
              quantity: 1,
            },
          ],
          payment_method_types: [payment_method],
          description: `Knead to Know Order #${shortId}`,
          reference_number: String(order_id),
          success_url: successUrl,
          cancel_url: cancelUrl,
          metadata: {
            order_id: String(order_id),
            payment_method,
          },
        },
      },
    };

    const pmResponse = await fetch("https://api.paymongo.com/v1/checkout_sessions", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${btoa(paymongoSecretKey + ":")}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const pmData = await pmResponse.json().catch(() => ({}));

    if (!pmResponse.ok) {
      console.error("PayMongo error:", pmResponse.status, JSON.stringify(pmData));
      // Surface PayMongo's own reason (e.g. "payment method not activated")
      // so it is visible in the UI while developing.
      const detail = pmData?.errors?.[0]?.detail;
      return errorWithCors(
        detail ? `PayMongo: ${detail}` : "Failed to create payment session",
        502,
      );
    }

    const checkoutSession = pmData.data;
    const checkoutUrl = checkoutSession.attributes.checkout_url;
    const paymongoReference = checkoutSession.id;

    // Save the PayMongo reference so the webhook can match the payment.
    const { error: refError } = await admin
      .from("orders")
      .update({
        payment_method,
        payment_status: "pending",
        paymongo_reference: paymongoReference,
      })
      .eq("id", order_id);

    if (refError) {
      console.error("Failed to save PayMongo reference:", refError);
      return errorWithCors("Failed to save payment reference", 500);
    }

    return jsonWithCors({
      success: true,
      checkout_url: checkoutUrl,
      paymongo_reference: paymongoReference,
      payment_method,
    });
  } catch (err) {
    console.error("create-payment error:", err);
    return errorWithCors("Internal server error", 500);
  }
});
