import * as SecureStore from 'expo-secure-store';
import { t } from '../i18n';

const SCAN_COUNT_KEY = 'scan_count';
const NICKNAME_KEY = 'user_nickname';

export async function incrementScanCount(): Promise<void> {
  const current = await getScanCount();
  await SecureStore.setItemAsync(SCAN_COUNT_KEY, String(current + 1));
}

export async function getScanCount(): Promise<number> {
  const val = await SecureStore.getItemAsync(SCAN_COUNT_KEY);
  return val ? parseInt(val, 10) : 0;
}

export async function getNickname(): Promise<string> {
  const val = await SecureStore.getItemAsync(NICKNAME_KEY);
  return val || t('profile.defaultNickname');
}

export async function saveNickname(name: string): Promise<void> {
  await SecureStore.setItemAsync(NICKNAME_KEY, name);
}
