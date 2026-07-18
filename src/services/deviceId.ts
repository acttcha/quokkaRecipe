import * as SecureStore from 'expo-secure-store';
import * as Application from 'expo-application';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

// 로그인 없는 "게스트" 신원 = 안정적 기기 ID.
// - iOS: SecureStore(Keychain)에 UUID 저장 → 앱 재설치해도 유지됨.
// - Android: ANDROID_ID 사용 → 재설치해도 유지(같은 서명키). (SecureStore 는 안드에서 재설치 시 지워짐)
// 이 값을 RevenueCat app_user_id + Supabase 지갑 키로 써서 "같은 폰 재설치" 시 잔액이 살아남는다.
// 새 폰 이전/크로스기기는 이후 선택적 로그인(Purchases.logIn)으로 승격.

const KEY = 'device_id_v1';
let _cached: string | null = null;

export async function getDeviceId(): Promise<string> {
  if (_cached) return _cached;

  // 1) 저장돼 있으면 사용 (iOS Keychain 은 재설치에도 유지)
  try {
    const saved = await SecureStore.getItemAsync(KEY);
    if (saved) { _cached = saved; return saved; }
  } catch { /* 무시 */ }

  // 2) 없으면 생성
  let id: string | null = null;
  if (Platform.OS === 'android') {
    try { id = Application.getAndroidId(); } catch { id = null; }
  }
  if (!id) {
    // iOS 또는 androidId 실패 → 랜덤 UUID (iOS 는 Keychain 저장이라 재설치 유지)
    id = Crypto.randomUUID();
  }

  try { await SecureStore.setItemAsync(KEY, id); } catch { /* 무시 */ }
  _cached = id;
  return id;
}
