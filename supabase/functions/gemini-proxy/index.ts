import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { createClient } from "@supabase/supabase-js";
import {
  buildRecipePrompt, buildNamePrompt, buildDetailPrompt, pickTwo, parseLegacyRecipe, normalizeRecipes,
  findViolations, avoidNote, allergyNote, legacyPrefsInput, hardTerms,
  type RecipeInput, type Candidate,
} from "./prompt.ts";

// Gemini API 프록시 (서버 권위 잎사귀 차감 포함).
// - GEMINI_API_KEY 는 서버에만 존재. 앱엔 publishable key 만.
// - 모델은 서버가 액션별로 결정 → 클라 조작으로 비싼 모델 못 쓰게 + 폐기 시 여기만 바꾸면 됨.
//   · scan(재료 인식) = Flash (비전 정확도 우선)
//   · recipe(레시피/유튜브 분석)·qa = Flash-Lite (원가 절감)
// - 신원(userId)+알려진 action 필수 → wallet_spend 로 서버가 직접 차감/로깅 (위변조 불가).
//   둘 중 하나라도 없으면 400 거부 (차감 없이 Gemini 무료사용 되는 구멍 차단).
// - 레시피 프롬프트는 서버(prompt.ts)가 조립한다. body.recipeInput 이 오면 그 경로를 타고,
//   없으면 앱이 보낸 payload 를 그대로 통과시킨다(구버전 앱 호환).

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
// 2.5 는 신규 프로젝트에 제공 중단 → 버전 고정(폐기되면 이 상수만 교체).
//  · scan(재료 인식) = 3.5-flash → 인식 정확도 우선 (출력 짧아 원가 ~2.7원)
//  · recipe/qa = 3.1-flash-lite → 현행 최저가 (입력$0.25/출력$1.50 → 레시피 ~3.5원)
const MODEL_SCAN   = Deno.env.get("GEMINI_MODEL_SCAN")   || "gemini-3.5-flash";       // 재료 인식 (정확도 우선)
const MODEL_RECIPE = Deno.env.get("GEMINI_MODEL_RECIPE") || "gemini-3.1-flash-lite";  // 레시피 생성 (최저가)
const MODEL_QA     = Deno.env.get("GEMINI_MODEL_QA")     || "gemini-3.1-flash-lite";
function modelFor(action: string): string {
  if (action === "scan") return MODEL_SCAN;
  if (action === "qa") return MODEL_QA;
  return MODEL_RECIPE; // recipe (+ youtube 분석)
}

// 서버 권위 잎사귀 비용 (앱 LEAF_COST 와 동기화)
const COST: Record<string, number> = { scan: 1, recipe: 1, qa: 0.2 };
const DAILY_MAX = 5;   // wallet 함수와 동기화 (일일 무료 잎사귀 리셋 기준)

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
    const model = modelFor(action);   // 액션별 서버 결정 모델 (클라 model 필드는 무시)

    // model/userId/action/recipeInput 은 Gemini 로 안 보냄 (서버 전용 필드)
    const { model: _m, userId: _u, action: _a, recipeInput: _r, ...rest } = body;
    let payload: Record<string, unknown> = rest;

    // 레시피 프롬프트는 서버가 만든다. 앱은 재료·선호도 같은 "데이터"만 보낸다.
    // 아래 payload 는 2단계 생성이 실패했을 때 쓰는 폴백(1회 생성)이다.
    let ri: RecipeInput | null = null;
    if (action === "recipe" && _r && typeof _r === "object") {
      ri = _r as RecipeInput;
      const built = buildRecipePrompt(ri);
      payload = {
        systemInstruction: { parts: [{ text: built.system }] },
        contents: [{ role: "user", parts: [{ text: built.user }] }],
        generationConfig: {
          maxOutputTokens: 2200,
          temperature: 1,
          thinkingConfig: { thinkingBudget: 0 },
          responseMimeType: "application/json",
        },
      };
    } else if (action === "recipe") {
      // 구버전 앱(≤1.0.5): 완성된 프롬프트를 보낸다. 재료 기반이면 파싱해서 2단계로 태우고,
      // 실패 시 앱이 보낸 payload(rest) 그대로 → 기존 동작과 동일.
      ri = parseLegacyRecipe(rest);
    }

    // ── 잎사귀 차감 (서버 권위, 항상 수행) ──
    const { data: spend, error } = await admin.rpc("wallet_spend", {
      p_user_id: userId,
      p_action: action,
      p_cost: cost,
      p_daily_max: DAILY_MAX,
      p_model: model,
    });
    if (error) {
      console.error("wallet_spend failed", error.code, error.message);
      return Response.json({ error: "wallet error", code: error.code ?? null }, { status: 500 });
    }
    if (!spend?.ok) {
      return Response.json({ error: "insufficient_leaves", balance: spend }, { status: 402 });
    }
    const spentTotal: number | null = typeof spend.total === "number" ? spend.total : null;

    // ── 2단계 생성 (재료 기반 레시피) ──
    // 1단계: 후보 8개를 {요리명, 사용재료} 로 받는다 (짧은 출력이라 싸다).
    // 서버가 목록 밖 재료·최근 추천·같은 주재료/조리법을 걸러 2개를 무작위로 고른다.
    // 2단계: 고른 2개의 레시피를 받아쓴다.
    // 측정 결과(재료 세트 5종 × 35회): 목록 밖 재료 0/70, 제약 위반 0, 연속 반복 0, 1회 약 2.2원.
    // 단일 생성(lite)은 목록 밖 재료가 20개 중 9~13개였고, 1단계를 flash 로 바꿔도 품질 차이는 없고 원가만 2배였다.
    // 어느 단계든 실패하면 위 payload(1회 생성)로 폴백한다.
    let stage1 = { in: 0, out: 0, names: [] as string[] };
    // 1단계 후보·적합도 — 응답 헤더(x-stage1-cands)로만 내보낸다(평가 스크립트용, 앱은 사용 안 함)
    const diag: Record<string, unknown> = {};
    if (ri && ri.mode === "ingredients" && ri.twoStage !== false) {
      try {
        const np = buildNamePrompt(ri, 8);
        const res1 = await fetch(`${GEMINI_BASE}/${MODEL_RECIPE}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: np.system }] },
            contents: [{ role: "user", parts: [{ text: np.user }] }],
            generationConfig: {
              maxOutputTokens: 800,
              temperature: 1,
              thinkingConfig: { thinkingBudget: 0 },
              responseMimeType: "application/json",
            },
          }),
        });
        const j1 = await res1.json();
        stage1.in = j1?.usageMetadata?.promptTokenCount ?? 0;
        stage1.out = j1?.usageMetadata?.candidatesTokenCount ?? 0;
        const t1 = (j1?.candidates?.[0]?.content?.parts ?? [])
          .map((x: { text?: string }) => x?.text ?? "").join("");
        const parsed = JSON.parse(t1.slice(t1.indexOf("["), t1.lastIndexOf("]") + 1));
        // 1단계 응답: [{"n":"요리명","u":["재료",...]}]. 형식이 어긋나도 이름만은 살린다.
        const cands: Candidate[] = Array.isArray(parsed)
          ? parsed.map((x: unknown) => {
              if (typeof x === "string") return { name: x, uses: [] };
              const o = (x ?? {}) as Record<string, unknown>;
              const uses = Array.isArray(o.u) ? o.u.map((v) => String(v)) : [];
              const fit = typeof o.f === "number" ? o.f : undefined;   // 페르소나 적합도(있을 때만)
              return { name: String(o.n ?? o.name ?? ""), uses, fit };
            })
          : [];
        const chosen = pickTwo(cands, ri);
        diag.cands = cands.map((c) => (c.fit !== undefined ? `${c.name}(${c.fit})` : c.name));
        if (ri.persona) diag.persona = ri.persona.slice(0, 40);
        diag.chosen = chosen;
        if (chosen.length >= 2) {
          stage1.names = chosen;
          const dp = buildDetailPrompt(ri, stage1.names);
          payload = {
            systemInstruction: { parts: [{ text: dp.system }] },
            contents: [{ role: "user", parts: [{ text: dp.user }] }],
            generationConfig: {
              maxOutputTokens: 2200,
              temperature: 1,
              thinkingConfig: { thinkingBudget: 0 },
              responseMimeType: "application/json",
            },
          };
        }
      } catch (e) {
        // 1단계 실패 → 기존 payload 그대로(1회 생성)
        diag.err = String(e).slice(0, 120);
      }
    }

    // 알레르기·비건이 있으면 실제 재료명(굴소스·액젓·버터…)을 첫 생성부터 알려준다 — 아래 최종 검사의 재생성을 줄인다.
    const guardIn = action === "recipe" ? (ri ?? legacyPrefsInput(rest)) : null;
    const note = guardIn ? allergyNote(guardIn) : "";
    if (note) {
      payload = JSON.parse(JSON.stringify(payload));
      const part = (payload.contents as { parts?: { text?: string }[] }[] | undefined)?.[0]?.parts?.[0];
      if (part && typeof part.text === "string") part.text += note;
    }

    // ── Gemini 호출 (모델은 서버 결정) ──
    let upstream: Response;
    let responseText: string;
    try {
      upstream = await fetch(`${GEMINI_BASE}/${model}:generateContent`, {
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

    // ── 알레르기·비건 최종 검사 ──
    // 입력 단계에서 걸러도 모델이 레시피를 쓰면서 버터·새우를 "추가"할 수 있다. 완성본을 서버가 다시 본다.
    // 걸리면 무엇이 걸렸는지 알려주고 한 번 다시 생성 → 그래도 걸리는 레시피는 빼고 보낸다.
    // 하나도 안 남으면 환불하고 실패로 돌려준다(알레르기 재료가 든 레시피를 보내는 것보다 낫다).
    let guardResult = "";
    if (upstream.ok && guardIn && hardTerms(guardIn).length) {
      const recipesOf = (text: string): unknown[] | null => {
        try {
          const t = JSON.parse(text)?.candidates?.[0]?.content?.parts?.[0]?.text;
          const arr = JSON.parse(t.slice(t.indexOf("["), t.lastIndexOf("]") + 1));
          return Array.isArray(arr) ? arr : null;
        } catch {
          return null;
        }
      };
      const checkName = guardIn.mode === "ingredients";
      let arr = recipesOf(responseText);
      let bad = arr ? findViolations(arr, guardIn, checkName) : [];
      if (arr && bad.length) {
        guardResult = `retry(${bad.map((b) => b.term).join(",")})`;
        try {
          const p2 = JSON.parse(JSON.stringify(payload));
          const part = p2?.contents?.[0]?.parts?.[0];
          if (part && typeof part.text === "string") {
            part.text += avoidNote(guardIn, bad.map((b) => b.term));
            const r2 = await fetch(`${GEMINI_BASE}/${model}:generateContent`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
              body: JSON.stringify(p2),
            });
            const t2 = await r2.text();
            const a2 = r2.ok ? recipesOf(t2) : null;
            if (a2 && a2.length) {
              responseText = t2;
              arr = a2;
              bad = findViolations(arr, guardIn, checkName);
            }
          }
        } catch { /* 재생성 실패 → 아래에서 걸린 레시피만 뺀다 */ }
        if (bad.length) {
          const keep = arr.filter((_, i) => !bad.some((b) => b.index === i));
          guardResult += ` dropped:${bad.length}(${bad.map((b) => b.term).join(",")})`;
          if (keep.length === 0) {
            if (cost > 0) await admin.rpc("wallet_credit", { p_user_id: userId, p_amount: cost, p_paid: false });
            console.error("allergen guard: all recipes dropped", bad.map((b) => b.term).join(","));
            // 앱은 error 문자열을 그대로 보여준다 → 사용자 언어로
            const ko = /korean|한국/i.test(guardIn.lang ?? "");
            return Response.json({
              code: "allergen_filtered",
              terms: bad.map((b) => b.term),
              error: ko
                ? "못 드시는 재료 없이 만들 수 있는 레시피를 찾지 못했어요. 재료를 바꿔 다시 시도해 주세요. (잎사귀는 돌려드렸어요)"
                : "We couldn't find a recipe without the ingredients you can't eat. Please try different ingredients. (Your leaf was refunded.)",
            }, { status: 502 });
          }
          const j = JSON.parse(responseText);
          j.candidates[0].content.parts[0].text = JSON.stringify(keep);
          responseText = JSON.stringify(j);
        }
      }
    }

    // 재료 기반 레시피 표기를 서버에서 바로잡는다(예: 한국어인데 "20 min"). 응답 형식은 그대로 유지.
    // 어느 단계에서든 파싱이 안 되면 원문을 그대로 돌려준다.
    if (upstream.ok && ri && ri.mode === "ingredients") {
      try {
        const j = JSON.parse(responseText);
        const part = j?.candidates?.[0]?.content?.parts?.[0];
        if (part && typeof part.text === "string") {
          const t = part.text;
          const arr = JSON.parse(t.slice(t.indexOf("["), t.lastIndexOf("]") + 1));
          part.text = JSON.stringify(normalizeRecipes(arr, ri));
          responseText = JSON.stringify(j);
        }
      } catch {
        // 원문 유지
      }
    }

    // 성공 시 잎사귀 사용량/잔액을 헤더로 알려줌 (앱 토스트용). 실패(환불)면 안 붙임.
    const outHeaders: Record<string, string> = { "Content-Type": "application/json" };
    // 원가·경로 모니터링용 (앱은 사용 안 함)
    if (stage1.in || stage1.out) {
      outHeaders["x-stage1-in"] = String(stage1.in);
      outHeaders["x-stage1-out"] = String(stage1.out);
      outHeaders["x-stage1-names"] = encodeURIComponent(stage1.names.join("|"));
      // 후보 전체와 페르소나 적합도 — 품질 평가용(앱은 사용 안 함)
      if (Array.isArray(diag.cands)) outHeaders["x-stage1-cands"] = encodeURIComponent((diag.cands as string[]).join("|"));
    }
    if (guardResult) outHeaders["x-allergy-guard"] = encodeURIComponent(guardResult);
    if (action === "recipe") {
      outHeaders["x-recipe-path"] = stage1.names.length >= 2 ? (_r ? "two-stage" : "two-stage-legacy") : "single";
    }
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
