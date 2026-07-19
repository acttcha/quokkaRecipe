import * as SecureStore from 'expo-secure-store';
import { isPro } from './subscription';
import { getIdentity } from './auth';

// 잎사귀 (쿼카 테마 토큰) — AI 호출 단위로 소비.
//   재료 인식 / 영수증 인식 / 레시피 생성 / 유튜브 분석 = 1🍃
//   쿼카 질문 (가벼운 호출) = 0.2🍃
//
// ⚠️ 잔액과 차감은 서버(Supabase 지갑)가 권위. 여기서는 조회/적립 트리거만 한다.
//    실제 차감은 AI 호출 시 gemini-proxy 가 서버에서 직접 수행(위변조 불가).
//    - getBalance/canSpend  → wallet 함수(op:'balance')에서 서버 잔액을 읽음
//    - creditAdReward/Purchase/ProMonthly → wallet 함수가 서버에서 적립
//    광고 시청 제한(횟수/쿨다운)만 기기 로컬로 관리(파밍 방지 UX).

export type LeafAction = 'scan' | 'recipe' | 'qa';

export const LEAF_COST: Record<LeafAction, number> = {
  scan: 1,
  recipe: 1,
  qa: 0.2,
};

export const ACTION_LABEL: Record<LeafAction, string> = {
  scan: '재료 인식',
  recipe: '레시피 생성',
  qa: '쿼카 질문',
};

export const FREE_DAILY_LEAVES = 3;   // 매일 자정(KST) 리셋되는 무료 잎사귀 (서버 기준)
export const WELCOME_BONUS = 2;        // 첫 실행 1회만 — 초기 경험용 (서버가 1회 지급)
export const AD_REWARD = 2;            // 광고 1회 보상 (보너스 풀로)
export const AD_DAILY_LIMIT = 5;            // 하루 보상형 광고 시청 최대 횟수
export const AD_COOLDOWN_MS = 30 * 60 * 1000; // 광고 간 최소 간격 (30분) — 연달아 몰아보기 방지
export const PRO_MONTHLY_LEAVES = 130;      // 쿼카 패스(PRO) 월 지급 잎사귀 (서버 상수와 동기화)

const AD_KEY = 'leaves_ad_v1';

// ── 서버 지갑 클라이언트 ────────────────────────────────────────
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
const WALLET_URL = `${SUPABASE_URL}/functions/v1/wallet`;

// 서버 wallet_touch/credit 이 돌려주는 형태
interface ServerBalance {
  daily?: number;
  bonus?: number;  // 무료 보너스(웰컴/광고)
  paid?: number;   // 유료 구매분
  total?: number;
  isPro?: boolean;
}

export interface LeafBalance {
  daily: number;     // 오늘 남은 무료
  bonus: number;     // 보너스 풀 (무료보너스 + 유료 구매분 합산 표시)
  total: number;     // 합계
  isPro: boolean;    // PRO 구독자 (무제한 아님 — 매달 지급 + 광고 제거)
}

let _cache: LeafBalance | null = null;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function toBalance(s: ServerBalance): LeafBalance {
  const daily = round1(s.daily ?? 0);
  const bonus = round1((s.bonus ?? 0) + (s.paid ?? 0));
  return {
    daily,
    bonus,
    total: round1(s.total ?? daily + bonus),
    isPro: isPro(), // RevenueCat 이 실시간 권위 (서버 subs_fg 는 웹훅 연동 후)
  };
}

async function walletCall(op: 'balance' | 'ad_reward'): Promise<LeafBalance> {
  const { userId, jwt } = await getIdentity();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_PUBLISHABLE_KEY,
    'Authorization': `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
  };
  if (jwt) headers['x-user-jwt'] = jwt; // 로그인 유저 → 서버가 JWT로 uid 검증
  const res = await fetch(WALLET_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ op, userId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || `wallet ${op} 실패 (HTTP ${res.status})`);
  }
  _cache = toBalance(await res.json());
  return _cache;
}

/** 서버 잔액 조회 (+ 서버측 일일 리셋/웰컴 지급). 네트워크 실패 시 마지막 캐시. */
export async function getBalance(): Promise<LeafBalance> {
  try {
    return await walletCall('balance');
  } catch {
    return _cache ?? { daily: 0, bonus: 0, total: 0, isPro: isPro() };
  }
}

/** 마지막으로 읽은 잔액(동기). 서버 왕복 없이 즉시 표시용. */
export function getCachedBalance(): LeafBalance | null {
  return _cache;
}

/**
 * 사전 체크(권고). 실제 차감은 서버가 AI 호출 시 수행하므로 이건 UX 용도.
 * 잔액이 부족하면 광고 유도 다이얼로그를 띄우기 위해 사용.
 */
export async function canSpend(action: LeafAction): Promise<boolean> {
  const cost = LEAF_COST[action];
  const { total } = await getBalance();
  return total >= cost;
}

/** 보상형 광고 보상 적립 (서버). */
export async function creditAdReward(): Promise<LeafBalance> {
  return walletCall('ad_reward');
}

// 구매(잎사귀 팩)·구독(PRO 월 지급) 적립은 RevenueCat 웹훅(rc-webhook)이 서버간으로 처리한다.
// → 클라가 트리거하던 임시 적립 제거(위변조 방지). 앱은 결제 후 잔액을 다시 조회(getBalance)만 하면 됨.

// ── 보상형 광고 시청 제한 (일일 상한 + 쿨다운) — 기기 로컬 ──────────
function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

interface AdState {
  date: string;        // YYYY-MM-DD (count 의 기준일)
  count: number;       // 오늘 시청한 광고 횟수
  lastWatchAt: number; // 마지막 시청 시각 (epoch ms) — 쿨다운 계산용, 날짜와 무관
}

async function getAdState(): Promise<AdState> {
  const today = todayStr();
  const raw = await SecureStore.getItemAsync(AD_KEY);
  if (!raw) return { date: today, count: 0, lastWatchAt: 0 };
  try {
    const parsed: AdState = JSON.parse(raw);
    // 날짜가 바뀌면 count 만 리셋. lastWatchAt(쿨다운)은 자정과 무관하게 유지.
    if (parsed.date !== today) {
      return { date: today, count: 0, lastWatchAt: parsed.lastWatchAt ?? 0 };
    }
    return { date: parsed.date, count: parsed.count, lastWatchAt: parsed.lastWatchAt ?? 0 };
  } catch {
    return { date: today, count: 0, lastWatchAt: 0 };
  }
}

/** 오늘 남은 광고 시청 가능 횟수 (0 이면 일일 한도 소진). */
export async function getAdWatchesLeft(): Promise<number> {
  const { count } = await getAdState();
  return Math.max(0, AD_DAILY_LIMIT - count);
}

/** 쿨다운 남은 시간(ms). 0 이면 지금 시청 가능. */
export async function getAdCooldownRemaining(): Promise<number> {
  const { lastWatchAt } = await getAdState();
  if (!lastWatchAt) return 0;
  return Math.max(0, AD_COOLDOWN_MS - (Date.now() - lastWatchAt));
}

/** 광고 1회 시청 기록 (보상 지급에 성공한 직후 호출). */
export async function recordAdWatch(): Promise<void> {
  const state = await getAdState();
  state.count += 1;
  state.lastWatchAt = Date.now();
  await SecureStore.setItemAsync(AD_KEY, JSON.stringify(state));
}

/**
 * 잎사귀 시스템 초기 워밍업 (App 시작 시 호출).
 * 서버 잔액을 한 번 읽어 캐시 + 서버측 일일 리셋/웰컴 지급 트리거.
 */
export async function loadLeaves(): Promise<void> {
  try { await getBalance(); } catch { /* 무시 */ }
}

/**
 * 테스트용 — 광고 시청 제한(횟수/쿨다운) 로컬 리셋.
 * (일일 잎사귀 리셋은 서버가 KST 자정에 자동 처리)
 */
export async function resetDailyLeaves(): Promise<void> {
  await SecureStore.deleteItemAsync(AD_KEY);
}
