import * as SecureStore from 'expo-secure-store';

// 구독 / Pro 멤버십 상태 관리.
// 지금은 IAP 미연동 — 개발자모드에서 수동 토글로 테스트.
// 나중에 expo-iap / RevenueCat 으로 갈아끼울 때 setIsPro() 호출 지점만 바꾸면 됨.

const PRO_KEY = 'subscription_is_pro';

let _isPro = false;

export async function loadSubscription(): Promise<void> {
  try {
    const v = await SecureStore.getItemAsync(PRO_KEY);
    _isPro = v === '1';
  } catch {
    // 무시
  }
}

export function isPro(): boolean {
  return _isPro;
}

export async function setIsPro(v: boolean): Promise<void> {
  _isPro = v;
  await SecureStore.setItemAsync(PRO_KEY, v ? '1' : '0');
}
