export interface UserPreferences {
  allergies: string[];       // 알레르기 재료
  spiceLevel: string;        // 매운 정도
  cookingTime: string;       // 조리 시간 여유
  dietType: string;          // 식단 유형
  cookingSkill: string;      // 요리 실력
  cuisineStyles: string[];   // 선호 음식 스타일
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  allergies: [],
  spiceLevel: '',
  cookingTime: '',
  dietType: '',
  cookingSkill: '',
  cuisineStyles: [],
};

export const PREFERENCES_KEY = 'user_preferences';
export const ONBOARDING_DONE_KEY = 'onboarding_done';
