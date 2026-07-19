// Gemini API 호출 — Supabase 의 gemini-proxy 를 통해 프록시.
// Gemini API 키는 서버에만 존재하고, 앱에는 publishable key 만 박힘.
// action 을 함께 보내면 서버(gemini-proxy)가 잎사귀를 직접 차감한다(위변조 불가).
import { getIdentity } from './auth';
import type { LeafAction } from './leaves';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
const GEMINI_PROXY_URL = `${SUPABASE_URL}/functions/v1/gemini-proxy`;

// 텍스트/비전 모두 처리하는 가성비 모델.
// ⚠️ 실제 사용 모델은 서버(gemini-proxy)가 결정한다. 이 값은 하위호환용 필드일 뿐.
export const GEMINI_MODEL = 'gemini-2.5-flash';

// 잎사귀 부족(402) 시 던지는 에러 — 호출 측에서 code 로 구분 가능.
export class InsufficientLeavesError extends Error {
  code = 'insufficient_leaves' as const;
  balance: unknown;
  constructor(balance?: unknown) {
    super('insufficient_leaves');
    this.name = 'InsufficientLeavesError';
    this.balance = balance;
  }
}

interface GeminiImage {
  mimeType: string;
  dataBase64: string;
}

interface CallGeminiOpts {
  system: string;
  userText: string;
  maxOutputTokens?: number;
  images?: GeminiImage[];
  jsonOutput?: boolean;   // true 면 responseMimeType: application/json 강제 (JSON 안정성↑)
  model?: string;         // 미지정 시 GEMINI_MODEL (서버가 무시하고 서버 모델 사용)
  temperature?: number;   // 미지정 시 1 (비전/추출은 0 권장)
  action?: LeafAction;    // 지정 시 서버가 해당 액션 비용만큼 잎사귀 차감
}

/**
 * Gemini 호출. 응답 텍스트(파트 결합)를 반환.
 * thinkingBudget: 0 → 비용/지연 예측 가능하게 thinking 끔 (품질 부족 시 키울 수 있음).
 * action 을 주면 서버가 잎사귀를 차감하고, 부족하면 InsufficientLeavesError 를 던진다.
 */
export async function callGemini(opts: CallGeminiOpts): Promise<string> {
  const parts: Array<Record<string, unknown>> = [];
  for (const img of opts.images ?? []) {
    parts.push({ inlineData: { mimeType: img.mimeType, data: img.dataBase64 } });
  }
  parts.push({ text: opts.userText });

  const body: Record<string, unknown> = {
    model: opts.model ?? GEMINI_MODEL,
    systemInstruction: { parts: [{ text: opts.system }] },
    contents: [{ role: 'user', parts }],
    generationConfig: {
      maxOutputTokens: opts.maxOutputTokens ?? 2200,
      temperature: opts.temperature ?? 1,
      thinkingConfig: { thinkingBudget: 0 },
      ...(opts.jsonOutput ? { responseMimeType: 'application/json' } : {}),
    },
  };

  // 서버 권위 차감: action 이 있으면 신원(로그인=uid / 게스트=기기ID)을 실어 서버가 직접 차감.
  let userJwt: string | null = null;
  if (opts.action) {
    try {
      const id = await getIdentity();
      body.userId = id.userId;
      body.action = opts.action;
      userJwt = id.jwt;
    } catch { /* 신원 실패 시 차감 없이 진행(전환기 호환) */ }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_PUBLISHABLE_KEY,
    'Authorization': `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
  };
  if (userJwt) headers['x-user-jwt'] = userJwt; // 로그인 유저 → 서버가 JWT로 uid 검증

  const res = await fetch(GEMINI_PROXY_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (res.status === 402) {
    const err = await res.json().catch(() => ({}));
    throw new InsufficientLeavesError(err?.balance);
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err?.error?.message || err?.error || `HTTP ${res.status} 오류`;
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }

  const data = await res.json();
  const text: string = (data?.candidates?.[0]?.content?.parts ?? [])
    .map((p: { text?: string }) => p?.text ?? '')
    .join('');
  if (!text) throw new Error('Gemini 응답이 비어있어요');
  return text;
}
