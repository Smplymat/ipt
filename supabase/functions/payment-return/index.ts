// Return bridge for the installed mobile app.
//
// PayMongo only redirects to normal https URLs, so for the app we point
// success_url / cancel_url here. This function answers with a redirect to the
// app's custom URL scheme, which makes Android reopen the app:
//
//   https://<project>.supabase.co/functions/v1/payment-return?status=success&order_id=<uuid>
//     -> com.kneadtoknow.app://payment-return?status=success&order_id=<uuid>
//
// It reads/writes no data and needs no secrets. Deploy WITHOUT JWT checks
// (see supabase/config.toml) because the customer's browser has no JWT.

const APP_SCHEME = "com.kneadtoknow.app";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve((req: Request) => {
  const url = new URL(req.url);
  const orderId = url.searchParams.get("order_id") ?? "";
  const status = url.searchParams.get("status") === "cancelled" ? "cancelled" : "success";

  // Only forward well-formed order ids (nothing else is ever echoed back).
  if (!UUID.test(orderId)) {
    return new Response("Invalid order reference.", {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const deepLink = `${APP_SCHEME}://payment-return?status=${status}&order_id=${orderId}`;

  return new Response(null, {
    status: 302,
    headers: { Location: deepLink },
  });
});
