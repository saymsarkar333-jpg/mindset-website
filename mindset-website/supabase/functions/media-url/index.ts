// Returns a short-lived URL only when a post is approved.
// Deploy with: supabase functions deploy media-url
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  try {
    const body = await req.json();
    const postId = String(body.postId || "");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(postId)) {
      return new Response(JSON.stringify({ error: "Invalid post ID" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: post, error } = await admin.from("posts").select("media_path,status").eq("id", postId).maybeSingle();
    if (error || !post || post.status !== "approved") {
      return new Response(JSON.stringify({ error: "Post not found or not approved" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: signed, error: signError } = await admin.storage.from("community-media").createSignedUrl(post.media_path, 300);
    if (signError || !signed) throw signError || new Error("Could not create media link");
    return new Response(JSON.stringify({ signedUrl: signed.signedUrl }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (_error) {
    return new Response(JSON.stringify({ error: "Unable to retrieve media" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
