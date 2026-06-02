// Gemini API 호출 — Supabase 의 gemini-proxy 를 통해 프록시.
// Gemini API 키는 서버에만 존재하고, 앱에는 publishable key 만 박힘.
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
const GEMINI_PROXY_URL = `${SUPABASE_URL}/functions/v1/gemini-proxy`;

// 텍스트/비전 모두 처리하는 가성비 모델. 필요 시 'gemini-2.5-flash-lite' 로 더 저렴하게.
export const GEMINI_MODEL = 'gemini-2.5-flash';

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
  model?: string;         // 미지정 시 GEMINI_MODEL
  temperature?: number;   // 미지정 시 1 (비전/추출은 0 권장)
}

/**
 * Gemini 호출. 응답 텍스트(파트 결합)를 반환.
 * thinkingBudget: 0 → 비용/지연 예측 가능하게 thinking 끔 (품질 부족 시 키울 수 있음).
 */
export async function callGemini(opts: CallGeminiOpts): Promise<string> {
  const parts: Array<Record<string, unknown>> = [];
  for (const img of opts.images ?? []) {
    parts.push({ inlineData: { mimeType: img.mimeType, data: img.dataBase64 } });
  }
  parts.push({ text: opts.userText });

  const body = {
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

  const res = await fetch(GEMINI_PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_PUBLISHABLE_KEY,
      'Authorization': `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify(body),
  });

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
