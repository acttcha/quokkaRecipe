// 스토어 업데이트 안내 — 서버(wallet op 'app_version')가 알려준 최신/최소 버전과 설치된 앱 버전을 비교한다.
// 스토어 없이 받는 작은 업데이트(EAS Update)는 조용히 적용되고, 여기서는 스토어를 거쳐야 하는 큰 업데이트만 다룬다.
import { Linking, Platform } from 'react-native';
import * as Application from 'expo-application';
import * as SecureStore from 'expo-secure-store';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

const APP_STORE_ID = '6776677242';
const ANDROID_PACKAGE = 'com.chasoft.quokkarecipe';

// "나중에" 를 누르면 같은 버전은 하루 동안 다시 묻지 않는다
const SNOOZE_KEY = 'store_update_snooze_v1';
const SNOOZE_MS = 24 * 60 * 60 * 1000;

// required = 업데이트해야만 사용, available = 안내(나중에 가능). version = 안내 대상 최신 버전
export type StoreUpdate = { kind: 'required' | 'available'; version: string } | null;

/** "1.0.10" 과 "1.0.9" 를 숫자로 비교. a < b 면 음수. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(n => parseInt(n, 10) || 0);
  const pb = b.split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

/** 지금 안내할 스토어 업데이트. 실패·미설정·개발 환경이면 null(앱 동작에 영향 없음). */
export async function checkStoreUpdate(): Promise<StoreUpdate> {
  const current = Application.nativeApplicationVersion;
  if (__DEV__ || !current || !SUPABASE_URL) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/wallet`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_PUBLISHABLE_KEY,
        'Authorization': `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ op: 'app_version' }),
    });
    if (!res.ok) return null;
    const j = await res.json();
    const v = Platform.OS === 'ios' ? j?.ios : j?.android;
    if (v?.min && compareVersions(current, v.min) < 0) return { kind: 'required', version: v.latest ?? v.min };
    if (v?.latest && compareVersions(current, v.latest) < 0) {
      const snooze = await SecureStore.getItemAsync(SNOOZE_KEY).catch(() => null);
      const [ver, at] = (snooze ?? '').split('|');
      if (ver === v.latest && Date.now() - Number(at) < SNOOZE_MS) return null;
      return { kind: 'available', version: v.latest };
    }
    return null;
  } catch {
    return null;
  }
}

/** "나중에" — 이 버전에 대해 하루 동안 묻지 않는다. */
export async function snoozeStoreUpdate(version: string): Promise<void> {
  await SecureStore.setItemAsync(SNOOZE_KEY, `${version}|${Date.now()}`).catch(() => {});
}

/** 스토어 앱의 이 앱 페이지를 연다(스토어 앱이 없으면 웹). */
export async function openStorePage(): Promise<void> {
  const [app, web] = Platform.OS === 'ios'
    ? [`itms-apps://apps.apple.com/app/id${APP_STORE_ID}`, `https://apps.apple.com/app/id${APP_STORE_ID}`]
    : [`market://details?id=${ANDROID_PACKAGE}`, `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`];
  try { await Linking.openURL(app); } catch { await Linking.openURL(web).catch(() => {}); }
}
