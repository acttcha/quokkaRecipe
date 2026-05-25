import * as SecureStore from 'expo-secure-store';
import { UserPreferences, DEFAULT_PREFERENCES, PREFERENCES_KEY, ONBOARDING_DONE_KEY } from '../types/preferences';

export async function savePreferences(prefs: UserPreferences): Promise<void> {
  await SecureStore.setItemAsync(PREFERENCES_KEY, JSON.stringify(prefs));
  await SecureStore.setItemAsync(ONBOARDING_DONE_KEY, 'true');
}

export async function loadPreferences(): Promise<UserPreferences> {
  const raw = await SecureStore.getItemAsync(PREFERENCES_KEY);
  if (!raw) return DEFAULT_PREFERENCES;
  try {
    return JSON.parse(raw) as UserPreferences;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export async function isOnboardingDone(): Promise<boolean> {
  const val = await SecureStore.getItemAsync(ONBOARDING_DONE_KEY);
  return val === 'true';
}

export async function resetOnboarding(): Promise<void> {
  await SecureStore.deleteItemAsync(ONBOARDING_DONE_KEY);
}

export function preferencesToPrompt(prefs: UserPreferences): string {
  const lines: string[] = [];

  if (prefs.allergies.length > 0) {
    lines.push(`🚨 알레르기/못 먹는 재료: ${prefs.allergies.join(', ')} → 이 재료는 절대 사용하지 마세요. ingredients 와 steps 어디에도 포함 금지.`);
  }
  if (prefs.dietType && prefs.dietType !== '일반') {
    lines.push(`🚨 식단 유형: ${prefs.dietType} → 이 식단에 맞지 않는 재료는 절대 사용하지 마세요.`);
  }
  if (prefs.spiceLevel) {
    lines.push(`- 매운 정도: ${prefs.spiceLevel} → 이 수준을 넘는 매운 양념(고추, 고춧가루, 페퍼소스 등)은 줄이거나 빼세요.`);
  }
  if (prefs.cookingTime) {
    lines.push(`- 조리 시간 여유: ${prefs.cookingTime} → cookTime은 이 안에 들어가야 합니다.`);
  }
  if (prefs.cookingSkill) {
    lines.push(`- 요리 실력: ${prefs.cookingSkill} → difficulty 와 steps 복잡도를 이에 맞추세요.`);
  }
  if (prefs.cuisineStyles.length > 0) {
    lines.push(`- 선호 음식 스타일: ${prefs.cuisineStyles.join(', ')} → 가능하면 이 스타일 위주로 추천하세요.`);
  }

  if (lines.length === 0) return '';
  return `\n\n[사용자 선호도 — 반드시 반영할 것]\n${lines.join('\n')}`;
}
