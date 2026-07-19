import 'react-native-url-polyfill/auto';
import { createClient, type Session } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { getDeviceId } from './deviceId';
import { rcLogIn } from './purchases';

// 선택적 로그인 (구글/애플). 목적 = 폰을 바꿔도 잎사귀 지갑을 이어받기.
//  · 게스트: userId = 기기ID (로그인 안 해도 앱 그대로 동작)
//  · 로그인: Supabase Auth uid (서버가 구글 토큰을 검증해 발급 = 위변조 불가)
//    → 로그인 시 기기 지갑을 계정 지갑으로 병합(wallet_merge) + RevenueCat 신원도 계정으로
//  네이티브 구글 모듈은 Expo Go 에 없으므로 조건부 require (ads/purchases 와 동일 패턴).

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';

export const isExpoGo = Constants.executionEnvironment === 'storeClient';

// Supabase 세션은 AsyncStorage 에 영속화 (자동 토큰 갱신)
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

let GoogleSignin: any = null;
if (!isExpoGo) {
  try { GoogleSignin = require('@react-native-google-signin/google-signin').GoogleSignin; } catch { GoogleSignin = null; }
}

let _session: Session | null = null;

supabase.auth.onAuthStateChange((_event, session) => { _session = session; });

/** 앱 시작 시 호출: 저장된 세션 복원 + 구글 SDK 구성. */
export async function loadAuth(): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession();
    _session = data.session;
  } catch { /* 무시 */ }
  if (GoogleSignin && GOOGLE_WEB_CLIENT_ID) {
    try { GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID }); } catch { /* 무시 */ }
  }
}

export function isLoggedIn(): boolean {
  return !!_session?.user?.id;
}

export function getUserEmail(): string | null {
  return _session?.user?.email ?? null;
}

/** 로그인 기능 사용 가능 여부 (빌드된 앱 + 클라이언트ID 설정). */
export function isAuthReady(): boolean {
  return !!GoogleSignin && !!GOOGLE_WEB_CLIENT_ID;
}

/**
 * 현재 신원. 로그인이면 계정 uid + 검증용 JWT, 아니면 기기ID(게스트).
 * 서버 호출 시 userId 는 body, jwt 는 x-user-jwt 헤더로 보낸다.
 */
export async function getIdentity(): Promise<{ userId: string; jwt: string | null }> {
  if (_session?.user?.id) return { userId: _session.user.id, jwt: _session.access_token };
  return { userId: await getDeviceId(), jwt: null };
}

/** 구글 로그인 → Supabase 세션 → 기기 지갑 병합 → RevenueCat 신원 전환. */
export async function signInWithGoogle(): Promise<void> {
  if (!GoogleSignin) throw new Error('로그인은 빌드된 앱에서만 가능해요');
  if (!GOOGLE_WEB_CLIENT_ID) throw new Error('구글 클라이언트 ID가 설정되지 않았어요');

  const deviceId = await getDeviceId(); // 병합 원본(게스트 지갑)

  await GoogleSignin.hasPlayServices();
  const res: any = await GoogleSignin.signIn();
  const idToken = res?.data?.idToken ?? res?.idToken; // 라이브러리 버전 호환
  if (!idToken) throw new Error('구글 토큰을 받지 못했어요');

  const { data, error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
  if (error) throw error;
  _session = data.session;

  const uid = data.user?.id;
  if (uid) {
    await mergeGuestWallet(deviceId);              // 기기 지갑 → 계정 지갑
    try { await rcLogIn(uid); } catch { /* 결제 미구성 시 무시 */ }
  }
}

/** RevenueCat 신원을 현재 신원(로그인=uid / 게스트=기기ID)으로 맞춤. 앱 시작 시 initPurchases 뒤 호출. */
export async function syncRcIdentity(): Promise<void> {
  const { userId } = await getIdentity();
  try { await rcLogIn(userId); } catch { /* 결제 미구성 시 무시 */ }
}

/** 로그아웃 → 게스트(기기ID)로 복귀. */
export async function signOut(): Promise<void> {
  try { if (GoogleSignin) await GoogleSignin.signOut(); } catch { /* 무시 */ }
  await supabase.auth.signOut();
  _session = null;
  try { await rcLogIn(await getDeviceId()); } catch { /* 무시 */ } // RC 신원도 기기로 되돌림
}

/** 계정 및 서버 데이터(잎사귀 잔액·사용 내역) 완전 삭제 후 로그아웃. */
export async function deleteAccount(): Promise<void> {
  const jwt = _session?.access_token;
  if (!jwt) throw new Error('로그인 상태가 아니에요');
  const res = await fetch(`${SUPABASE_URL}/functions/v1/wallet`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_PUBLISHABLE_KEY,
      'Authorization': `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      'x-user-jwt': jwt,
    },
    body: JSON.stringify({ op: 'delete_account' }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e?.error || '계정 삭제에 실패했어요');
  }
  await signOut(); // 로컬 세션 정리 + 게스트(기기ID)로 복귀
}

/** 기기(게스트) 지갑 잔액을 계정 지갑으로 합침 (서버가 JWT 로 uid 검증). */
async function mergeGuestWallet(fromDeviceId: string): Promise<void> {
  const jwt = _session?.access_token;
  if (!jwt) return;
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/wallet`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_PUBLISHABLE_KEY,
        'Authorization': `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        'x-user-jwt': jwt,
      },
      body: JSON.stringify({ op: 'merge', fromDeviceId }),
    });
  } catch { /* 무시 — 다음 로그인/TRANSFER 웹훅에서 재시도 */ }
}
