import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

// RevenueCat 웹훅 수신 — 서버간(server-to-server) 결제 반영. 클라가 못 건드리므로 위변조 불가.
//  설정: RevenueCat 대시보드 > Integrations > Webhooks
//    · URL      = https://<project>.supabase.co/functions/v1/rc-webhook
//    · Authorization 헤더 = RC_WEBHOOK_SECRET (Supabase 시크릿과 동일 값)
//  app_user_id = 기기ID(Purchases.configure appUserID).
//    · 소모성 잎사귀 팩 → leaf_paid 적립 (금액은 서버 LEAF_GRANT)
//    · 구독(쿼카 패스)   → subs_fg 설정 + 신규 주기마다 월 잎사귀 지급
//    · TRANSFER          → 지갑 병합 (재설치/기기이전으로 신원이 바뀔 때 잔액 이어붙임)
//  멱등: event.id 로 1회만 처리 (RC 재시도 중복 방지).

const PRO_MONTHLY = 130;          // 쿼카 패스 월 지급 (앱 PRO_MONTHLY_LEAVES 와 동기화)
const ENTITLEMENT = "pro";
const LEAF_GRANT: Record<string, number> = {
  leaf_pack_1: 15, leaf_pack_2: 60, leaf_pack_3: 125, leaf_pack_4: 300, leaf_pack_5: 1000,
};

const admin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

export default {
  fetch: async (req: Request): Promise<Response> => {
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

    // RC 가 보내는 Authorization 헤더 == 우리가 대시보드에 설정한 시크릿
    const secret = Deno.env.get("RC_WEBHOOK_SECRET");
    if (secret && req.headers.get("Authorization") !== secret) {
      return new Response("Unauthorized", { status: 401 });
    }

    // deno-lint-ignore no-explicit-any
    let body: any;
    try { body = await req.json(); } catch { return new Response("bad json", { status: 400 }); }
    const e = body?.event;
    if (!e?.id || !e?.type) return new Response("no event", { status: 400 });

    const userId: string = e.app_user_id ?? "";
    const baseProduct: string = String(e.product_id ?? "").split(":")[0]; // 안드 구독 ':base_plan' 제거

    // 멱등: 이미 처리한 이벤트면 조용히 200 (중복 지급 방지)
    const { data: fresh } = await admin.rpc("claim_event", {
      p_event_id: e.id, p_type: e.type, p_user_id: userId, p_product_id: baseProduct,
    });
    if (fresh === false) return Response.json({ ok: true, dedup: true });

    try {
      // 1) TRANSFER — 지갑 병합 (옛 신원 → 새 신원). 잎사귀 잔액을 새 기기/계정으로 이어붙임.
      if (e.type === "TRANSFER") {
        const from: string[] = e.transferred_from ?? [];
        const to: string[] = e.transferred_to ?? [];
        if (to[0]) {
          for (const f of from) await admin.rpc("wallet_merge", { p_from: f, p_to: to[0] });
        }
        return Response.json({ ok: true });
      }

      if (!userId) return Response.json({ ok: true, skip: "no user" });

      const leafAmount = LEAF_GRANT[baseProduct];
      const isSub = !leafAmount && (
        baseProduct.startsWith("quokka_pass") ||
        (e.entitlement_ids ?? []).includes(ENTITLEMENT) ||
        e.entitlement_id === ENTITLEMENT
      );

      // 2) 소모성 잎사귀 팩 구매 → 유료 잎사귀 적립
      if (leafAmount && (e.type === "NON_RENEWING_PURCHASE" || e.type === "INITIAL_PURCHASE")) {
        await admin.rpc("wallet_credit", { p_user_id: userId, p_amount: leafAmount, p_paid: true });
        return Response.json({ ok: true });
      }

      // 3) 구독 (쿼카 패스)
      if (isSub) {
        switch (e.type) {
          case "INITIAL_PURCHASE":
          case "RENEWAL":
            // 신규 주기 → 구독 활성 + 이번 달 잎사귀 지급 (event.id 멱등 → 주기당 1회)
            // p_paid: true → 유료 칸(leaf_paid)에 적립 = 소비 순서상 마지막에 지켜짐
            await admin.rpc("wallet_set_pro", { p_user_id: userId, p_is_pro: true });
            await admin.rpc("wallet_credit", { p_user_id: userId, p_amount: PRO_MONTHLY, p_paid: true });
            break;
          case "PRODUCT_CHANGE":
          case "UNCANCELLATION":
            await admin.rpc("wallet_set_pro", { p_user_id: userId, p_is_pro: true });
            break;
          case "EXPIRATION":
            // 실제 접근 종료 → 구독 해제
            await admin.rpc("wallet_set_pro", { p_user_id: userId, p_is_pro: false });
            break;
          // CANCELLATION(자동갱신만 끔, 만료 전까지 유지) / BILLING_ISSUE → 상태 유지
        }
      }

      return Response.json({ ok: true });
    } catch (err) {
      // 처리 실패 → 멱등 레코드 제거해서 RC 재시도 때 다시 처리되게
      await admin.from("processed_events").delete().eq("event_id", e.id);
      return Response.json({ error: String(err) }, { status: 500 });
    }
  },
};
