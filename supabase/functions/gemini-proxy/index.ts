import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { createClient } from "@supabase/supabase-js";

// Gemini API 프록시 (서버 권위 잎사귀 차감 포함).
// - GEMINI_API_KEY 는 서버에만 존재. 앱엔 publishable key 만.
// - 모델은 서버가 결정(GEMINI_MODEL) → 클라 조작으로 비싼 모델 못 쓰게 + 폐기 시 여기만 바꾸면 됨.
// - userId+action 이 오면 wallet_spend 로 서버가 직접 차감/로깅 (위변조 불가).
//   userId 없으면(구버전 앱) 차감 없이 통과 — 전환기 호환. ⚠️ 출시 전 userId 필수화 권장.

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const MODEL = Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash";

// 서버 권위 잎사귀 비용 (앱 LEAF_COST 와 동기화)
const COST: Record<string, number> = { scan: 1, recipe: 1, qa: 0.2 };
const DAILY_MAX = 3;

const admin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

export default {
  fetch: withSupabase({ auth: ["publishable"] }, async (req) => {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return Response.json({ error: "Server misconfigured: GEMINI_API_KEY missing" }, { status: 500 });
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const userId = typeof body.userId === "string" ? body.userId : null;
    const action = typeof body.action === "string" ? body.action : null;
    const cost = action ? (COST[action] ?? 1) : 0;

    // model/userId/action 은 Gemini 로 안 보냄 (서버 전용 필드)
    const { model: _m, userId: _u, action: _a, ...payload } = body;

    // ── 잎사귀 차감 (userId+action 있으면 서버 권위) ──
    if (userId && action) {
      const { data: spend, error } = await admin.rpc("wallet_spend", {
        p_user_id: userId,
        p_action: action,
        p_cost: cost,
        p_daily_max: DAILY_MAX,
        p_model: MODEL,
      });
      if (error) {
        return Response.json({ error: "wallet error", detail: error.message }, { status: 500 });
      }
      if (!spend?.ok) {
        return Response.json({ error: "insufficient_leaves", balance: spend }, { status: 402 });
      }
    }

    // ── Gemini 호출 (모델은 서버 결정) ──
    const upstream = await fetch(`${GEMINI_BASE}/${MODEL}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(payload),
    });
    const responseText = await upstream.text();

    // Gemini 실패 시 차감분 환불 (free_bonus 로) — 실패한 호출로 잎사귀 손해 안 나게
    if (!upstream.ok && userId && action && cost > 0) {
      await admin.rpc("wallet_credit", { p_user_id: userId, p_amount: cost, p_paid: false });
    }

    return new Response(responseText, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  }),
};
