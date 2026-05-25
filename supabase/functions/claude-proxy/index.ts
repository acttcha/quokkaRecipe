import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";

export default {
  fetch: withSupabase({ auth: ["publishable"] }, async (req) => {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const claudeApiKey = Deno.env.get("CLAUDE_API_KEY");
    if (!claudeApiKey) {
      return Response.json(
        { error: "Server misconfigured: CLAUDE_API_KEY missing" },
        { status: 500 },
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const upstream = await fetch(CLAUDE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": claudeApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    const responseText = await upstream.text();
    return new Response(responseText, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  }),
};
