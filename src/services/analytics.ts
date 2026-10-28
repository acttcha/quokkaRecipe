// 퍼널 측정 — 외부 분석 SDK 없이 기존 Supabase(usage_events)에 이벤트만 남긴다.
// usage_events 에는 AI 호출(scan/recipe/qa)이 이미 쌓이고 있어서,
// 여기서는 "AI 를 쓰기 전" 구간(설치·온보딩)만 채우면 퍼널이 완성된다.
//   설치 → fridge_setup_done → onboarding_done → 첫 recipe → app_open 재방문
// 개인정보처리방침의 "앱 사용 통계" 범위 안이라 별도 고지 추가가 필요 없다.
import { getIdentity } from './auth';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
const WALLET_URL = `${SUPABASE_URL}/functions/v1/wallet`;

// 서버(wallet 엣지함수) TRACK_ACTIONS 와 동기화. 목록에 없는 값은 서버가 400 으로 거부한다.
export type TrackAction = 'app_open' | 'fridge_setup_done' | 'onboarding_done';

// 같은 실행에서의 중복 전송 방지 — 서버도 막지만 불필요한 왕복을 줄인다.
const _sent = new Set<TrackAction>();

/** 측정 이벤트 1건 전송. 실패해도 앱 동작에 영향이 없어야 한다(모두 삼킨다). */
export async function track(action: TrackAction): Promise<void> {
  if (_sent.has(action)) return;
  _sent.add(action);
  try {
    const { userId, jwt } = await getIdentity();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_PUBLISHABLE_KEY,
      'Authorization': `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
    };
    if (jwt) headers['x-user-jwt'] = jwt;
    await fetch(WALLET_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ op: 'track', action, userId }),
    });
  } catch {
    // 측정 실패는 조용히 무시 — 재시도하지 않는다.
  }
}
