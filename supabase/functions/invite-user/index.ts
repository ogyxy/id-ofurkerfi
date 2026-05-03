// supabase/functions/invite-user/index.ts
// Admin-only: invites a new user via email and pre-creates a profile with the chosen role.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

type AppRole = "admin" | "sales" | "designer" | "viewer";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

    const authHeader = req.headers.get("authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "unauthorized" }, 401);
    }

    // Verify caller is an admin
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: callerProfile } = await admin
      .from("profiles")
      .select("role, active")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (!callerProfile?.active || callerProfile.role !== "admin") {
      return json({ error: "forbidden" }, 403);
    }

    const body = await req.json();
    const email = String(body?.email ?? "").trim().toLowerCase();
    const role = body?.role as AppRole;
    const name = body?.name ? String(body.name).trim() : null;

    if (!email || !email.includes("@")) return json({ error: "invalid_email" }, 400);
    if (!["admin", "sales", "designer", "viewer"].includes(role)) {
      return json({ error: "invalid_role" }, 400);
    }

    // Send invite email
    const { data: invited, error: inviteErr } =
      await admin.auth.admin.inviteUserByEmail(email);

    if (inviteErr || !invited?.user) {
      // If user already exists, we can still upsert their profile.
      const { data: list } = await admin.auth.admin.listUsers();
      const existing = list?.users?.find((u) => u.email?.toLowerCase() === email);
      if (!existing) {
        return json({ error: inviteErr?.message ?? "invite_failed" }, 400);
      }
      await admin.from("profiles").upsert(
        { id: existing.id, email, name, role, active: true },
        { onConflict: "id" },
      );
      return json({ ok: true, alreadyExisted: true });
    }

    // Upsert profile (the auth trigger creates a default row; we override role)
    await admin.from("profiles").upsert(
      { id: invited.user.id, email, name, role, active: true },
      { onConflict: "id" },
    );

    return json({ ok: true, userId: invited.user.id });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}
