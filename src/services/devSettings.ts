import * as SecureStore from 'expo-secure-store';

// 테스트 전용: API 호출을 끄고 목 데이터로 화면 이동만 확인 / 레시피 생성 모델 변경.
// SecureStore 에 영속화 + 모듈 내 캐시로 동기 읽기 가능하도록 유지.

// 레시피 생성 전용 모델 선택 (개발자 모드). 전부 Gemini.
export type RecipeModelKey = 'gemini-flash' | 'gemini-flash-lite';

export const RECIPE_MODELS: Record<RecipeModelKey, { provider: 'gemini'; model: string; label: string }> = {
  'gemini-flash':      { provider: 'gemini', model: 'gemini-2.5-flash',      label: 'Gemini 2.5 Flash' },
  'gemini-flash-lite': { provider: 'gemini', model: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite' },
};

const MOCK_KEY = 'dev_mock_mode';
const RECIPE_MODEL_KEY = 'dev_recipe_model_key';
const DEV_MODE_KEY = 'dev_mode_enabled';

let _mockMode = false;
let _recipeModelKey: RecipeModelKey = 'gemini-flash';
let _devMode = false;   // 개발자 메뉴 노출 여부 (버전 7번 탭으로 해제)

export async function loadDevSettings(): Promise<void> {
  try {
    const [mock, recipeModel, devMode] = await Promise.all([
      SecureStore.getItemAsync(MOCK_KEY),
      SecureStore.getItemAsync(RECIPE_MODEL_KEY),
      SecureStore.getItemAsync(DEV_MODE_KEY),
    ]);
    _mockMode = mock === '1';
    _devMode = devMode === '1';
    if (recipeModel && Object.prototype.hasOwnProperty.call(RECIPE_MODELS, recipeModel)) {
      _recipeModelKey = recipeModel as RecipeModelKey;
    }
  } catch {
    // 무시 — 디폴트로 진행
  }
}

export function getDevMode(): boolean {
  return _devMode;
}

export async function setDevMode(v: boolean): Promise<void> {
  _devMode = v;
  await SecureStore.setItemAsync(DEV_MODE_KEY, v ? '1' : '0');
}

export function getMockMode(): boolean {
  return _mockMode;
}

export async function setMockMode(v: boolean): Promise<void> {
  _mockMode = v;
  await SecureStore.setItemAsync(MOCK_KEY, v ? '1' : '0');
}

export function getRecipeModelKey(): RecipeModelKey {
  return _recipeModelKey;
}

export async function setRecipeModelKey(k: RecipeModelKey): Promise<void> {
  _recipeModelKey = k;
  await SecureStore.setItemAsync(RECIPE_MODEL_KEY, k);
}
