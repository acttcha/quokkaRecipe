import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { createClient } from "@supabase/supabase-js";

// 잎사귀 지갑 조회/적립 함수 (앱이 직접 부르는 것). AI 차감은 gemini-proxy, 결제 적립은 rc-webhook 담당.
//  op 'balance'   → wallet_touch: 잔액 조회 + 일일 리셋 + 웰컴 보너스 (앱 실행 시)
//  op 'ad_reward' → wallet_credit: 보상형 광고 시청 보상 (free_bonus)
//  op 'merge'     → wallet_merge: 로그인 시 기기(게스트) 지갑 → 계정 지갑 병합
//    ⚠️ ad_reward 는 클라 보고 기반 → 추후 AdMob SSV 권장.
//  신원: x-user-jwt 헤더(로그인 유저의 Supabase JWT)가 있으면 서버가 검증해 uid 확정.
//        없으면 body.userId(게스트 기기ID) 사용. (계정 지갑은 JWT 검증 필수 → 사칭 방지)

const DAILY_MAX = 3;
const WELCOME = 2;
const AD_REWARD = 2;
const AD_DAILY = 5;             // 하루 보상형 광고 최대 (앱 AD_DAILY_LIMIT 와 동기화)
const AD_COOLDOWN_SEC = 30 * 60; // 광고 간 최소 간격 30분 (앱 AD_COOLDOWN_MS 와 동기화)

const admin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

// x-user-jwt 검증 → 로그인 유저 { id, provider } (없거나 무효면 null)
async function verifyUser(req: Request): Promise<{ id: string; provider: string } | null> {
  const jwt = req.headers.get("x-user-jwt");
  if (!jwt) return null;
  const { data } = await admin.auth.getUser(jwt);
  const u = data?.user;
  if (!u?.id) return null;
  return { id: u.id, provider: (u.app_metadata?.provider as string) || "member" };
}

export default {
  fetch: withSupabase({ auth: ["publishable"] }, async (req) => {
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }

    const op = typeof body.op === "string" ? body.op : "balance";

    // 신원 확정: 로그인=검증된 uid, 게스트=body.userId
    const verified = await verifyUser(req);
    const userId = verified?.id ?? (typeof body.userId === "string" ? body.userId : null);
    const authType = verified?.provider ?? "guest";
    if (!userId) return Response.json({ error: "userId required" }, { status: 400 });

    if (op === "delete_account") {
      // 계정 + 서버 데이터 완전 삭제 (로그인 필수). Auth 계정 삭제는 service_role 만 가능.
      if (!verified) return Response.json({ error: "auth required" }, { status: 401 });
      await admin.from("usage_events").delete().eq("user_id", verified.id);
      await admin.from("wallets").delete().eq("user_id", verified.id);
      const { error: delErr } = await admin.auth.admin.deleteUser(verified.id);
      if (delErr) return Response.json({ error: delErr.message }, { status: 500 });
      return Response.json({ ok: true });
    }

    if (op === "merge") {
      // 계정 병합은 반드시 로그인(검증된 uid) 상태에서만
      if (!verified) return Response.json({ error: "auth required" }, { status: 401 });
      const from = typeof body.fromDeviceId === "string" ? body.fromDeviceId : "";
      if (from && from !== verified.id) {
        const { error } = await admin.rpc("wallet_merge", { p_from: from, p_to: verified.id });
        if (error) return Response.json({ error: error.message }, { status: 500 });
      }

    } else if (op === "ad_reward") {
      // 서버가 일일 상한/쿨다운 강제 (초과 시 지급 안 함). 클라 로컬 제한만으론 우회 가능해서.
      const { error } = await admin.rpc("wallet_ad_reward", {
        p_user_id: userId, p_amount: AD_REWARD, p_daily_max: AD_DAILY, p_cooldown_sec: AD_COOLDOWN_SEC,
      });
      if (error) return Response.json({ error: error.message }, { status: 500 });
    }

    // 최신 잔액 반환 (+ 일일 리셋/웰컴 + auth_type 갱신)
    const { data, error } = await admin.rpc("wallet_touch", {
      p_user_id: userId, p_daily_max: DAILY_MAX, p_welcome: WELCOME, p_auth_type: authType,
    });
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json(data);
  }),
};
