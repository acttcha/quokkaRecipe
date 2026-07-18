import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { createClient } from "@supabase/supabase-js";

// 잎사귀 지갑 조회/적립 함수 (앱이 직접 부르는 것). AI 차감은 gemini-proxy, 결제 적립은 rc-webhook 담당.
//  op 'balance'   → wallet_touch: 잔액 조회 + 일일 리셋 + 웰컴 보너스 (앱 실행 시)
//  op 'ad_reward' → wallet_credit: 보상형 광고 시청 보상 (free_bonus)
//    ⚠️ 지금은 클라 보고 기반 → 추후 AdMob 서버측 검증(SSV)으로 위변조 방지 권장.

const DAILY_MAX = 3;
const WELCOME = 2;
const AD_REWARD = 2;

const admin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

export default {
  fetch: withSupabase({ auth: ["publishable"] }, async (req) => {
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }

    const userId = typeof body.userId === "string" ? body.userId : null;
    const op = typeof body.op === "string" ? body.op : "balance";
    if (!userId) return Response.json({ error: "userId required" }, { status: 400 });

    if (op === "ad_reward") {
      const { error } = await admin.rpc("wallet_credit", { p_user_id: userId, p_amount: AD_REWARD, p_paid: false });
      if (error) return Response.json({ error: error.message }, { status: 500 });
    }

    // 최신 잔액 반환 (+ 일일 리셋/웰컴)
    const { data, error } = await admin.rpc("wallet_touch", {
      p_user_id: userId, p_daily_max: DAILY_MAX, p_welcome: WELCOME,
    });
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json(data);
  }),
};
