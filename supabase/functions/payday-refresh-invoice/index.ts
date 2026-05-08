// payday-refresh-invoice
// Refresh the linked Payday invoice for a deal — re-fetches from Payday
// and updates payment status, paid amounts, due date, etc.

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
    const { deal_id } = await req.json();
    if (!deal_id) return json({ error: "deal_id is required" }, 400);

    const supabase = adminClient();

    const { data: deal, error: dealErr } = await supabase
      .from("deals")
      .select("payday_invoice_id, payday_invoice_number")
      .eq("id", deal_id)
      .maybeSingle();
    if (dealErr) return json({ error: dealErr.message }, 500);
    if (!deal?.payday_invoice_id) {
      return json({ error: "No linked Payday invoice" }, 400);
    }

    const token = await getPaydayToken(supabase);

    const res = await fetch(
      `${PAYDAY_BASE_URL}/invoices/${encodeURIComponent(deal.payday_invoice_id)}?include=lines,payments`,
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
    const inv = data.data ?? data.invoice ?? data;

    const cancelled = inv.status === "CANCELLED" || inv.status === "DELETED";
    if (cancelled) {
      // Unlink everything
      await supabase
        .from("deals")
        .update({
          payday_invoice_id: null,
          payday_invoice_number: null,
          payday_currency_code: null,
          payday_foreign_amount_excl_vsk: null,
          payday_foreign_amount_incl_vsk: null,
          payday_synced_at: null,
          payday_due_date: null,
          invoice_status: "not_invoiced",
          payment_status: "unpaid",
          invoice_date: null,
          amount_invoiced_isk: null,
          amount_invoiced_with_vsk_isk: null,
          amount_paid_isk: null,
          paid_at: null,
        })
        .eq("id", deal_id);
      return json({ cancelled: true });
    }

    const isPaid = inv.status === "PAID";
    const paymentsArr = (inv.payments ?? []) as Array<{
      paymentDate: string;
      amount: number;
    }>;
    const paymentsSum = paymentsArr.reduce((s, p) => s + (p.amount ?? 0), 0);
    const lastPaymentDate =
      paymentsArr.map((p) => p.paymentDate).sort().at(-1) ?? null;
    const isForeign = inv.currencyCode !== "ISK";

    const update = {
      payday_currency_code: inv.currencyCode,
      payday_foreign_amount_excl_vsk: isForeign ? inv.foreignAmountExcludingVat : null,
      payday_foreign_amount_incl_vsk: isForeign ? inv.foreignAmountIncludingVat : null,
      payday_synced_at: new Date().toISOString(),
      payday_due_date: inv.dueDate ?? null,
      invoice_status: "full" as const,
      payment_status: (isPaid ? "paid" : "unpaid") as "paid" | "unpaid",
      invoice_date: inv.invoiceDate ?? null,
      amount_invoiced_isk: inv.amountExcludingVat ?? null,
      amount_invoiced_with_vsk_isk: inv.amountIncludingVat ?? null,
      amount_paid_isk: isPaid ? inv.amountIncludingVat : (paymentsSum || null),
      paid_at: isPaid ? (inv.paidDate ?? lastPaymentDate) : null,
    };

    const { error: updateErr } = await supabase
      .from("deals")
      .update(update)
      .eq("id", deal_id);
    if (updateErr) return json({ error: updateErr.message }, 500);

    return json({
      ok: true,
      invoice_status: update.invoice_status,
      payment_status: update.payment_status,
    });
  } catch (err) {
    console.error(err);
    return json({ error: (err as Error).message }, 500);
  }
});
