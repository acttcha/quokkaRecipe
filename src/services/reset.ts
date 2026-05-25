import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';

const SECURE_STORE_KEYS = [
  'fridge_ingredients',
  'fridge_setup_done',
  'user_preferences',
  'onboarding_done',
  'scan_count',
  'user_nickname',
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
