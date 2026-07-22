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

// 동기 캐시 — 앱 시작 시 getNickname 으로 채워두면, 마이/프로필에서 기본값 플래시 없이 바로 노출.
let _nickname: string | null = null;

export async function getNickname(): Promise<string> {
  const val = await SecureStore.getItemAsync(NICKNAME_KEY);
  _nickname = val || t('profile.defaultNickname');
  return _nickname;
}

/** 마지막으로 읽은 닉네임(동기). 아직 안 읽었으면 null. */
export function getCachedNickname(): string | null {
  return _nickname;
}

export async function saveNickname(name: string): Promise<void> {
  await SecureStore.setItemAsync(NICKNAME_KEY, name);
  _nickname = name;
}
