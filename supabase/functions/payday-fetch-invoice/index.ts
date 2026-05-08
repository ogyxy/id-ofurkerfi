// payday-fetch-invoice
// Look up an invoice by number and return its data for preview before linking.

import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";

const PAYDAY_BASE_URL = Deno.env.get("PAYDAY_BASE_URL")!;
const PAYDAY_CLIENT_ID = Deno.env.get("PAYDAY_CLIENT_ID")!;
const PAYDAY_CLIENT_SECRET = Deno.env.get("PAYDAY_CLIENT_SECRET")!;
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function getPaydayToken(supabase: SupabaseClient): Promise<string> {
  const { data: existing } = await supabase
    .from("payday_auth")
    .select("access_token, expires_at")
    .eq("id", 1)
    .maybeSingle();
  if (existing) {
    const expiresAt = new Date(existing.expires_at).getTime();
    if (expiresAt - Date.now() > REFRESH_BUFFER_MS) return existing.access_token;
  }
  const res = await fetch(`${PAYDAY_BASE_URL}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Api-Version": "alpha" },
    body: JSON.stringify({
      clientId: PAYDAY_CLIENT_ID,
      clientSecret: PAYDAY_CLIENT_SECRET,
    }),
  });
  if (!res.ok) {
    throw new Error(`Payday auth failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  const token = data.token ?? data.accessToken;
  if (!token) throw new Error(`Unexpected auth response: ${JSON.stringify(data)}`);
  const expiresAt = new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString();
  await supabase.from("payday_auth").upsert(
    {
      id: 1,
      access_token: token,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  return token;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }
  try {
    const { invoice_number } = await req.json();
    if (!invoice_number) return json({ error: "invoice_number is required" }, 400);

    const supabase = adminClient();
    const token = await getPaydayToken(supabase);

    const res = await fetch(
      `${PAYDAY_BASE_URL}/invoices/?query=${encodeURIComponent(invoice_number)}&include=lines,payments,customer`,
      {
        headers: {
          "Content-Type": "application/json",
          "Api-Version": "alpha",
          "Authorization": `Bearer ${token}`,
        },
      },
    );
    if (!res.ok) return json({ error: `Payday returned ${res.status}` }, 502);

    const data = await res.json();
    const list = Array.isArray(data) ? data : data.data ?? data.invoices ?? [];
    const inv = list.find((i: { number: number | string }) =>
      String(i.number) === String(invoice_number)
    );
    if (!inv) return json({ error: "Invoice not found" }, 404);

    const cancelled = inv.status === "CANCELLED" || inv.status === "DELETED";
    if (cancelled) return json({ error: "Cannot link a cancelled invoice" }, 400);
    if (inv.status === "DRAFT") return json({ error: "Cannot link a draft invoice" }, 400);
    if (inv.status === "CREDIT") return json({ error: "Cannot link a credit invoice" }, 400);

    return json({ invoice: inv });
  } catch (err) {
    console.error(err);
    return json({ error: (err as Error).message }, 500);
  }
});
