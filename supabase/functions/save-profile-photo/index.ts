import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

function readDefaultKey(jsonEnv: string, legacyEnv: string) {
  const raw = Deno.env.get(jsonEnv);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed?.default === "string" && parsed.default) return parsed.default;
      const first = Object.values(parsed || {}).find((value) => typeof value === "string" && value);
      if (typeof first === "string") return first;
    } catch {
      // Hosted Supabase uses a JSON dictionary. This fallback also keeps local
      // single-key setups working if a plain value is supplied.
      if (raw.trim()) return raw.trim();
    }
  }
  return Deno.env.get(legacyEnv) || "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ error: "Please sign in again before saving your profile picture." }, 401);

    const url = Deno.env.get("SUPABASE_URL") || "";
    const secretKey = readDefaultKey("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !secretKey) return json({ error: "Profile photo service configuration is missing." }, 500);

    // Authentication is verified here instead of depending on the Edge gateway's
    // legacy JWT check. The endpoint still rejects every request without a valid
    // Supabase Auth user token.
    const adminClient = createClient(url, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    });
    const { data: authData, error: authError } = await adminClient.auth.getUser(token);
    if (authError || !authData.user) return json({ error: "Your session is no longer valid. Please sign in again." }, 401);

    const body = await req.json();
    const image = String(body?.image || "");
    if (!/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(image)) {
      return json({ error: "Choose a JPEG, PNG, or WebP profile picture." }, 400);
    }

    const match = image.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/i);
    if (!match) return json({ error: "The selected image could not be read." }, 400);

    const ext = match[1].toLowerCase() === "jpg" ? "jpeg" : match[1].toLowerCase();
    const contentType = ext === "jpeg" ? "image/jpeg" : `image/${ext}`;
    const raw = match[2];
    // The app crops/resizes photos before upload. Keep a generous ceiling so
    // high-detail phone photos do not fail after JPEG conversion.
    if (raw.length > 3_000_000) return json({ error: "The prepared image is too large. Please choose another photo." }, 413);

    let binary: Uint8Array;
    try {
      binary = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
    } catch {
      return json({ error: "The selected image could not be decoded." }, 400);
    }

    const path = `${authData.user.id}/profile-${crypto.randomUUID()}.${ext}`;
    const storage = adminClient.storage.from("vccf-profile-avatars");
    const upload = await storage.upload(path, binary, {
      contentType,
      cacheControl: "3600",
      upsert: false,
    });
    if (upload.error) return json({ error: `Photo upload failed: ${upload.error.message}` }, 400);

    const publicUrl = storage.getPublicUrl(path).data.publicUrl;
    const { data: saved, error: saveError } = await adminClient.rpc("save_account_profile_photo", {
      p_user_id: authData.user.id,
      p_photo_url: publicUrl,
    });

    if (saveError) {
      await storage.remove([path]);
      return json({ error: `Profile picture save failed: ${saveError.message}` }, 400);
    }

    if (!saved?.ok || !saved?.url) {
      await storage.remove([path]);
      return json({ error: "The profile picture was uploaded but the account update was not confirmed." }, 500);
    }

    return json(saved);
  } catch (error) {
    console.error("save-profile-photo", error);
    return json({ error: error instanceof Error ? error.message : "Unable to save profile picture." }, 400);
  }
});
