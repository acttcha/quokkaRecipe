import * as SecureStore from 'expo-secure-store';
import { UserPreferences, DEFAULT_PREFERENCES, PREFERENCES_KEY, ONBOARDING_DONE_KEY } from '../types/preferences';
import { t } from '../i18n';

export async function savePreferences(prefs: UserPreferences): Promise<void> {
  await SecureStore.setItemAsync(PREFERENCES_KEY, JSON.stringify(prefs));
  await SecureStore.setItemAsync(ONBOARDING_DONE_KEY, 'true');
}

export async function loadPreferences(): Promise<UserPreferences> {
  const raw = await SecureStore.getItemAsync(PREFERENCES_KEY);
  if (!raw) return DEFAULT_PREFERENCES;
  try {
    // 기존 저장본에 없는 필드(servings 등)는 기본값으로 채움
    return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) } as UserPreferences;
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
    lines.push(`🚨 Allergies / cannot eat: ${prefs.allergies.join(', ')} → NEVER use these ingredients. Do not include them anywhere in ingredients or steps.`);
  }
  if (prefs.dietType && prefs.dietType !== t('onboarding.dietNoneValue')) {
    lines.push(`🚨 Diet type: ${prefs.dietType} → never use ingredients that don't fit this diet.`);
  }
  if (prefs.spiceLevel) {
    lines.push(`- Spice tolerance: ${prefs.spiceLevel} → reduce or omit spicy seasonings (chili, chili powder, hot sauce, etc.) beyond this level.`);
  }
  if (prefs.cookingTime) {
    lines.push(`- Available cooking time: ${prefs.cookingTime} → cookTime must fit within this.`);
  }
  if (prefs.cookingSkill) {
    lines.push(`- Cooking skill: ${prefs.cookingSkill} → match difficulty and step complexity to this.`);
  }
  const cuisines = prefs.cuisineStyles.filter(c => c && c !== t('onboarding.cuisineAnyValue'));
  if (cuisines.length > 0) {
    lines.push(`- Preferred cuisine styles: ${cuisines.join(', ')} → recommend mainly in these styles when possible.`);
  }

  if (lines.length === 0) return '';
  return `\n\n[User preferences — MUST be reflected]\n${lines.join('\n')}`;
}
