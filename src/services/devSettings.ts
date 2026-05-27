import * as SecureStore from 'expo-secure-store';

// 테스트 전용: API 호출을 끄고 목 데이터로 화면 이동만 확인 / 사용할 Claude 모델 변경
// SecureStore 에 영속화 + 모듈 내 캐시로 동기 읽기 가능하도록 유지.

export type ModelKey = 'haiku' | 'sonnet' | 'opus';

export const MODEL_IDS: Record<ModelKey, string> = {
  haiku: 'claude-haiku-4-5-20251001',
  sonnet: 'claude-sonnet-4-6',
  opus: 'claude-opus-4-7',
};

const MOCK_KEY = 'dev_mock_mode';
const MODEL_KEY = 'dev_model_key';

let _mockMode = false;
let _modelKey: ModelKey = 'sonnet';

export async function loadDevSettings(): Promise<void> {
  try {
    const [mock, model] = await Promise.all([
      SecureStore.getItemAsync(MOCK_KEY),
      SecureStore.getItemAsync(MODEL_KEY),
    ]);
    _mockMode = mock === '1';
    if (model === 'haiku' || model === 'sonnet' || model === 'opus') {
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

export function getActiveModelId(): string {
  return MODEL_IDS[_modelKey];
}

export async function setModelKey(k: ModelKey): Promise<void> {
  _modelKey = k;
  await SecureStore.setItemAsync(MODEL_KEY, k);
}
