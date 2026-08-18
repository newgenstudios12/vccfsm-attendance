import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response("Unauthorized", { status: 401 });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const publishableKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const userClient = createClient(supabaseUrl, publishableKey, { global: { headers: { Authorization: authHeader } } });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: claims, error: claimsError } = await userClient.auth.getClaims();
  if (claimsError || !claims?.claims?.sub) return new Response("Unauthorized", { status: 401 });
  const actorId = claims.claims.sub as string;
  const { data: actor } = await adminClient.from("profiles").select("role").eq("user_id", actorId).single();
  if (!actor || actor.role !== "admin") return new Response("Only administrators can create accounts", { status: 403 });

  const body = await req.json();
  const { email, password, display_name, role, area_id, member_id } = body;
  if (!email || !password || !display_name || !role) return new Response("Missing required fields", { status: 400 });
  if (!['admin','area_leader','member'].includes(role)) return new Response("Invalid role", { status: 400 });
  if (role !== 'admin' && !area_id) return new Response("Area is required for this role", { status: 400 });
  if (role === 'member' && !member_id) return new Response("Member profile is required for Member accounts", { status: 400 });

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({ email, password, email_confirm: true });
  if (createError || !created.user) return new Response(createError?.message || "Unable to create user", { status: 400 });

  const { error: profileError } = await adminClient.from("profiles").insert({ user_id: created.user.id, role, area_id: role === 'admin' ? null : area_id, member_id: role === 'member' ? member_id : member_id || null, display_name });
  if (profileError) {
    await adminClient.auth.admin.deleteUser(created.user.id);
    return new Response(profileError.message, { status: 400 });
  }
  return Response.json({ ok: true, user_id: created.user.id });
});
