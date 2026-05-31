import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';

const SECURE_STORE_KEYS = [
  'fridge_ingredients',
  'fridge_setup_done',
  'user_preferences',
  'onboarding_done',
  'scan_count',
  'user_nickname',
  // 잎사귀 / 구독 / 개발자 설정
  'leaves_daily_v1',
  'leaves_bonus_v1',
  'subscription_is_pro',
  'dev_mock_mode',
  'dev_model_key',
  // 레거시 (구 usage 시스템 잔재 — 정리)
  'daily_usage_v1',
  'bonus_credits_v1',
];

export async function resetAllData(): Promise<void> {
  await Promise.all(
    SECURE_STORE_KEYS.map(key => SecureStore.deleteItemAsync(key)),
  );

  const dir = FileSystem.documentDirectory;
  if (!dir) return;

  try {
    const files = await FileSystem.readDirectoryAsync(dir);
    await Promise.all(
      files
        .filter(f =>
          f === 'folders.json' ||
          f === 'saved_recipes.json' ||
          f.startsWith('recipe_notes_'),
        )
        .map(f => FileSystem.deleteAsync(dir + f, { idempotent: true })),
    );
  } catch {
    // 파일 삭제 실패해도 SecureStore는 비워졌으므로 무시
  }
}
