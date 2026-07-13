import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type NotifyPayload = {
  title?: string;
  summary?: string;
  slug?: string;
  url?: string;
  imageUrl?: string | null;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

async function sendEmail(to: string, subject: string, html: string) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("EMAIL_FROM");
  if (!apiKey || !from) return { skipped: true };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  return { skipped: false, ok: response.ok, status: response.status, body: await response.text() };
}

async function publishInstagramStory(payload: NotifyPayload) {
  const token = Deno.env.get("INSTAGRAM_ACCESS_TOKEN");
  const userId = Deno.env.get("INSTAGRAM_USER_ID");
  const graphVersion = Deno.env.get("INSTAGRAM_GRAPH_VERSION") || "v21.0";
  const storyImageUrl = payload.imageUrl || Deno.env.get("INSTAGRAM_STORY_IMAGE_URL");
  if (!token || !userId || !storyImageUrl) return { skipped: true };

  const base = `https://graph.facebook.com/${graphVersion}/${userId}`;
  const create = await fetch(`${base}/media`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      media_type: "STORIES",
      image_url: storyImageUrl,
      access_token: token,
    }),
  });
  const created = await create.json();
  if (!create.ok || !created.id) return { skipped: false, ok: false, step: "create", response: created };

  const publish = await fetch(`${base}/media_publish`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      creation_id: created.id,
      access_token: token,
    }),
  });
  return { skipped: false, ok: publish.ok, step: "publish", response: await publish.json() };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !serviceKey || !anonKey) return json({ error: "Supabase env is missing" }, 500);

  const authHeader = req.headers.get("authorization") || "";
  const jwt = authHeader.replace("Bearer ", "");
  if (!jwt) return json({ error: "Login required" }, 401);

  const admin = createClient(supabaseUrl, serviceKey);
  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { authorization: authHeader } },
  });

  const { data: userData, error: userError } = await authClient.auth.getUser(jwt);
  if (userError || !userData.user) return json({ error: "Login required" }, 401);

  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();
  if (!["contributor", "admin"].includes(profile?.role)) return json({ error: "Contributor role required" }, 403);

  const payload = (await req.json()) as NotifyPayload;
  if (!payload.title || !payload.url) return json({ error: "Title and URL are required" }, 400);

  const { data: subscribers, error } = await admin
    .from("subscribers")
    .select("email, unsubscribe_token")
    .eq("active", true);
  if (error) return json({ error: error.message }, 500);

  const siteOrigin = new URL(payload.url).origin;
  const subject = `New HCNY Astronomy post: ${payload.title}`;
  const emailResults = [];
  for (const subscriber of subscribers || []) {
    const unsubscribeUrl = `${siteOrigin}/HCNYAstro-Website/posts/?unsubscribe=${subscriber.unsubscribe_token}`;
    const html = `
      <h1>${payload.title}</h1>
      ${payload.summary ? `<p>${payload.summary}</p>` : ""}
      <p><a href="${payload.url}">Read the post</a></p>
      <p style="font-size:12px;color:#666"><a href="${unsubscribeUrl}">Unsubscribe</a></p>
    `;
    emailResults.push(await sendEmail(subscriber.email, subject, html));
  }

  const instagram = await publishInstagramStory(payload);
  return json({
    ok: true,
    emailCount: subscribers?.length || 0,
    emailsConfigured: emailResults.some((result) => !result.skipped),
    instagram,
  });
});
