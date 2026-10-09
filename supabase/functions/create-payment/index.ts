import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { corsHeaders, handleCors, jsonWithCors, errorWithCors } from "../_shared/cors.ts";

const PAYMENT_METHOD_MAP: Record<string, string> = {
  card: "card",
  gcash: "gcash",
  paymaya: "paymaya",
  grab_pay: "grab_pay",
  cod: "cod",
};

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return errorWithCors("Missing authorization header", 401);
    }

    // Use anon key with user's auth header for RLS-enforced operations
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return errorWithCors("Unauthorized", 401);
    }

    const body = await req.json();
    const { order_id, payment_method } = body;

    if (!order_id || !payment_method) {
      return errorWithCors("Missing order_id or payment_method", 400);
    }

    if (!Object.keys(PAYMENT_METHOD_MAP).includes(payment_method)) {
      return errorWithCors("Invalid payment method", 400);
    }

    // Fetch the order to get the total amount (never trust client)
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

    // Convert total to centavos (PHP * 100)
    const amountInCentavos = Math.round(Number(order.total) * 100);

    // COD: just update the order and return success
    if (payment_method === "cod") {
      const { error: updateError } = await supabase
        .from("orders")
        .update({
          payment_method: "cod",
          payment_status: "unpaid",
          status: "pending",
        })
        .eq("id", order_id);

      if (updateError) {
        return errorWithCors(updateError.message, 500);
      }

      return jsonWithCors({ success: true, order_id, payment_method: "cod" });
    }

    // Online payment methods: create PayMongo Checkout Session
    const paymongoSecretKey = Deno.env.get("PAYMONGO_SECRET_KEY");
    if (!paymongoSecretKey) {
      console.error("PAYMONGO_SECRET_KEY not configured");
      return errorWithCors("Payment gateway not configured", 500);
    }

    const paymongoPaymentMethod = PAYMENT_METHOD_MAP[payment_method];
    const checkoutSessionUrl = "https://api.paymongo.com/v1/checkout_sessions";

    const requestBody = {
      data: {
        attributes: {
          amount: amountInCentavos,
          currency: "PHP",
          payment_method_types: [paymongoPaymentMethod],
          description: `Knead to Know Order #${order_id.slice(0, 8).toUpperCase()}`,
          success_url: `${Deno.env.get("APP_URL") || "http://localhost:4200"}/payment-success?order_id=${order_id}`,
          cancel_url: `${Deno.env.get("APP_URL") || "http://localhost:4200"}/payment-cancelled?order_id=${order_id}`,
          metadata: {
            order_id,
            payment_method,
          },
        },
      },
    };

    const pmResponse = await fetch(checkoutSessionUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${btoa(paymongoSecretKey + ":")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const pmData = await pmResponse.json();

    if (!pmResponse.ok) {
      console.error("PayMongo error:", pmData);
      return errorWithCors("Failed to create payment session", 500);
    }

    const checkoutSession = pmData.data;
    const checkoutUrl = checkoutSession.attributes.checkout_url;
    const paymongoReference = checkoutSession.id;

    // Save PayMongo reference on the order
    const { error: refError } = await supabase
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