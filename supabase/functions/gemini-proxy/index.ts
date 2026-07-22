import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { createClient } from "@supabase/supabase-js";

// Gemini API 프록시 (서버 권위 잎사귀 차감 포함).
// - GEMINI_API_KEY 는 서버에만 존재. 앱엔 publishable key 만.
// - 모델은 서버가 결정(GEMINI_MODEL) → 클라 조작으로 비싼 모델 못 쓰게 + 폐기 시 여기만 바꾸면 됨.
// - 신원(userId)+알려진 action 필수 → wallet_spend 로 서버가 직접 차감/로깅 (위변조 불가).
//   둘 중 하나라도 없으면 400 거부 (차감 없이 Gemini 무료사용 되는 구멍 차단).

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const MODEL = Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash";

// 서버 권위 잎사귀 비용 (앱 LEAF_COST 와 동기화)
const COST: Record<string, number> = { scan: 1, recipe: 1, qa: 0.2 };
const DAILY_MAX = 3;

const admin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

// x-user-jwt 검증 → 로그인 유저 uid (없거나 무효면 null → 게스트 body.userId 사용)
async function verifyUid(req: Request): Promise<string | null> {
  const jwt = req.headers.get("x-user-jwt");
  if (!jwt) return null;
  const { data } = await admin.auth.getUser(jwt);
  return data?.user?.id ?? null;
}

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

    // 신원 확정: 로그인=검증된 uid, 게스트=body.userId
    const verified = await verifyUid(req);
    const userId = verified ?? (typeof body.userId === "string" ? body.userId : null);
    const action = typeof body.action === "string" ? body.action : null;

    // 신원 + 알려진 action 필수 — 없으면 차감 없이 무료사용 되는 구멍이라 거부.
    if (!userId || !action || !(action in COST)) {
      return Response.json({ error: "identity and valid action required" }, { status: 400 });
    }
    const cost = COST[action];

    // model/userId/action 은 Gemini 로 안 보냄 (서버 전용 필드)
    const { model: _m, userId: _u, action: _a, ...payload } = body;

    // ── 잎사귀 차감 (서버 권위, 항상 수행) ──
    const { data: spend, error } = await admin.rpc("wallet_spend", {
      p_user_id: userId,
      p_action: action,
      p_cost: cost,
      p_daily_max: DAILY_MAX,
      p_model: MODEL,
    });
    if (error) {
      return Response.json({ error: "wallet error" }, { status: 500 });
    }
    if (!spend?.ok) {
      return Response.json({ error: "insufficient_leaves", balance: spend }, { status: 402 });
    }
    const spentTotal: number | null = typeof spend.total === "number" ? spend.total : null;

    // ── Gemini 호출 (모델은 서버 결정) ──
    let upstream: Response;
    let responseText: string;
    try {
      upstream = await fetch(`${GEMINI_BASE}/${MODEL}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify(payload),
      });
      responseText = await upstream.text();
    } catch {
      // 업스트림 도달 실패(네트워크/서버) = 서버측 문제 → 차감분 환불
      if (cost > 0) await admin.rpc("wallet_credit", { p_user_id: userId, p_amount: cost, p_paid: false });
      return Response.json({ error: "upstream unreachable" }, { status: 502 });
    }

    // 업스트림 서버오류(5xx)만 환불 — 클라가 유발한 4xx(잘못된 요청)로는 환불 안 함(파밍 방지).
    if (upstream.status >= 500 && cost > 0) {
      await admin.rpc("wallet_credit", { p_user_id: userId, p_amount: cost, p_paid: false });
    }

    // 성공 시 잎사귀 사용량/잔액을 헤더로 알려줌 (앱 토스트용). 실패(환불)면 안 붙임.
    const outHeaders: Record<string, string> = { "Content-Type": "application/json" };
    if (upstream.ok && spentTotal !== null && cost > 0) {
      outHeaders["x-leaf-spent"] = String(cost);
      outHeaders["x-leaf-total"] = String(spentTotal);
    }

    return new Response(responseText, {
      status: upstream.status,
      headers: outHeaders,
    });
  }),
};
