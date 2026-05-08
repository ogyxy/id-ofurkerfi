// payday-sync-all
// Cron-driven sync of every linked, unpaid Payday invoice. Refreshes
// payment status, paid amounts, and due date from Payday for each deal.

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

async function syncOne(
  supabase: SupabaseClient,
  token: string,
  deal: { id: string; payday_invoice_id: string },
): Promise<"updated" | "cancelled" | "error"> {
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
  if (!res.ok) {
    console.error(`Payday returned ${res.status} for deal ${deal.id}`);
    return "error";
  }
  const data = await res.json();
  const inv = data.data ?? data.invoice ?? data;

  const cancelled = inv.status === "CANCELLED" || inv.status === "DELETED";
  if (cancelled) {
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
      .eq("id", deal.id);
    return "cancelled";
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

  await supabase
    .from("deals")
    .update({
      payday_currency_code: inv.currencyCode,
      payday_foreign_amount_excl_vsk: isForeign ? inv.foreignAmountExcludingVat : null,
      payday_foreign_amount_incl_vsk: isForeign ? inv.foreignAmountIncludingVat : null,
      payday_synced_at: new Date().toISOString(),
      payday_due_date: inv.finalDueDate ?? null,
      invoice_status: "full",
      payment_status: isPaid ? "paid" : "unpaid",
      invoice_date: inv.invoiceDate ?? null,
      amount_invoiced_isk: inv.amountExcludingVat ?? null,
      amount_invoiced_with_vsk_isk: inv.amountIncludingVat ?? null,
      amount_paid_isk: isPaid ? inv.amountIncludingVat : (paymentsSum || null),
      paid_at: isPaid ? (inv.paidDate ?? lastPaymentDate) : null,
    })
    .eq("id", deal.id);

  return "updated";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }
  try {
    const supabase = adminClient();
    const token = await getPaydayToken(supabase);

    const { data: deals, error } = await supabase
      .from("deals")
      .select("id, payday_invoice_id")
      .not("payday_invoice_id", "is", null)
      .neq("payment_status", "paid");
    if (error) return json({ error: error.message }, 500);

    const counts = { updated: 0, cancelled: 0, error: 0 };
    for (const deal of deals ?? []) {
      try {
        const result = await syncOne(
          supabase,
          token,
          deal as { id: string; payday_invoice_id: string },
        );
        counts[result]++;
      } catch (e) {
        console.error(`syncOne failed for ${deal.id}`, e);
        counts.error++;
      }
    }

    return json({ ok: true, total: deals?.length ?? 0, ...counts });
  } catch (err) {
    console.error(err);
    return json({ error: (err as Error).message }, 500);
  }
});
