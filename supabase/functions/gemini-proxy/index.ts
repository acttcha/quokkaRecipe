import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

// Gemini API 프록시. GEMINI_API_KEY 는 Supabase 서버에만 존재하고,
// 앱에는 publishable key 만 박힌다 (claude-proxy 와 동일한 보안 구조).
// 앱은 { model, systemInstruction, contents, generationConfig } 형태로 보내고,
// 이 함수가 model 만 떼어 해당 모델의 generateContent 로 나머지를 그대로 전달.
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export default {
  fetch: withSupabase({ auth: ["publishable"] }, async (req) => {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return Response.json(
        { error: "Server misconfigured: GEMINI_API_KEY missing" },
        { status: 500 },
      );
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const model = body.model;
    if (typeof model !== "string" || !model) {
      return Response.json({ error: "model is required" }, { status: 400 });
    }
    const { model: _omit, ...payload } = body;

    const upstream = await fetch(`${GEMINI_BASE}/${model}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(payload),
    });

    const responseText = await upstream.text();
    return new Response(responseText, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  }),
};
