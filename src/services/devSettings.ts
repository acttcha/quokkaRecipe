import * as SecureStore from 'expo-secure-store';

// 테스트 전용: API 호출을 끄고 목 데이터로 화면 이동만 확인 / 사용할 Claude 모델 변경
// SecureStore 에 영속화 + 모듈 내 캐시로 동기 읽기 가능하도록 유지.

// 코드 내 호출별 기본 모델 (auto 일 때 적용)
//   vision = 이미지 인식 (재료/영수증) — Sonnet 권장
//   light  = 텍스트 생성 (레시피/Q&A/유튜브 분석) — Haiku (비용 절감)
export type ModelTier = 'vision' | 'light';

// 'auto' = 코드 기본값 사용. 그 외는 모든 호출을 그 모델로 강제.
export type ModelKey = 'auto' | 'haiku' | 'sonnet' | 'opus';

const TIER_DEFAULT: Record<ModelTier, Exclude<ModelKey, 'auto'>> = {
  vision: 'sonnet',
  light: 'haiku',
};

export const MODEL_IDS: Record<Exclude<ModelKey, 'auto'>, string> = {
  haiku: 'claude-haiku-4-5-20251001',
  sonnet: 'claude-sonnet-4-6',
  opus: 'claude-opus-4-7',
};

const MOCK_KEY = 'dev_mock_mode';
const MODEL_KEY = 'dev_model_key';

let _mockMode = false;
let _modelKey: ModelKey = 'auto';

export async function loadDevSettings(): Promise<void> {
  try {
    const [mock, model] = await Promise.all([
      SecureStore.getItemAsync(MOCK_KEY),
      SecureStore.getItemAsync(MODEL_KEY),
    ]);
    _mockMode = mock === '1';
    if (model === 'auto' || model === 'haiku' || model === 'sonnet' || model === 'opus') {
      _modelKey = model;
    }
  } catch {
    // 무시 — 디폴트로 진행
  }
}

export function getMockMode(): boolean {
  return _mockMode;
}

export async function setMockMode(v: boolean): Promise<void> {
  _mockMode = v;
  await SecureStore.setItemAsync(MOCK_KEY, v ? '1' : '0');
}

export function getModelKey(): ModelKey {
  return _modelKey;
}

export function getModelIdFor(tier: ModelTier): string {
  const key = _modelKey === 'auto' ? TIER_DEFAULT[tier] : _modelKey;
  return MODEL_IDS[key];
}

export async function setModelKey(k: ModelKey): Promise<void> {
  _modelKey = k;
  await SecureStore.setItemAsync(MODEL_KEY, k);
}
