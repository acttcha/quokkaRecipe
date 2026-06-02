import * as SecureStore from 'expo-secure-store';
import { isPro } from './subscription';

// 잎사귀 (쿼카 테마 토큰) — AI 호출 단위로 소비.
//   재료 인식 / 영수증 인식 / 레시피 생성 / 유튜브 분석 = 1🍃
//   쿼카 질문 (가벼운 Haiku 호출) = 0.1🍃
// PRO 구독자는 모든 잎사귀 체크/차감 우회 (무제한).

export type LeafAction = 'scan' | 'recipe' | 'qa';

export const LEAF_COST: Record<LeafAction, number> = {
  scan: 1,
  recipe: 1,
  qa: 0.1,
};

export const ACTION_LABEL: Record<LeafAction, string> = {
  scan: '재료 인식',
  recipe: '레시피 생성',
  qa: '쿼카 질문',
};

export const FREE_DAILY_LEAVES = 3;   // 매일 자정 리셋되는 무료 잎사귀
export const WELCOME_BONUS = 2;        // 첫 실행 1회만 — 초기 경험용
export const AD_REWARD = 1;            // 광고 1회 보상 (보너스 풀로)
export const AD_DAILY_LIMIT = 5;            // 하루 보상형 광고 시청 최대 횟수
export const AD_COOLDOWN_MS = 60 * 60 * 1000; // 광고 간 최소 간격 (1시간) — 연달아 몰아보기 방지

const DAILY_KEY = 'leaves_daily_v1';
const BONUS_KEY = 'leaves_bonus_v1';
const AD_KEY = 'leaves_ad_v1';

interface DailyState {
  date: string;     // YYYY-MM-DD
  leaves: number;   // 오늘 남은 무료 잎사귀
}
interface BonusState {
  leaves: number;   // 보너스 풀 (웰컴/광고/구매)
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

async function getDaily(): Promise<DailyState> {
  const today = todayStr();
  const raw = await SecureStore.getItemAsync(DAILY_KEY);
  if (!raw) return { date: today, leaves: FREE_DAILY_LEAVES };
  try {
    const parsed: DailyState = JSON.parse(raw);
    if (parsed.date !== today) return { date: today, leaves: FREE_DAILY_LEAVES };
    return parsed;
  } catch {
    return { date: today, leaves: FREE_DAILY_LEAVES };
  }
}

async function setDaily(state: DailyState): Promise<void> {
  await SecureStore.setItemAsync(DAILY_KEY, JSON.stringify(state));
}

async function getBonus(): Promise<BonusState> {
  const raw = await SecureStore.getItemAsync(BONUS_KEY);
  if (!raw) {
    // 첫 실행 — 웰컴 보너스 지급 후 영속화
    const init: BonusState = { leaves: WELCOME_BONUS };
    await SecureStore.setItemAsync(BONUS_KEY, JSON.stringify(init));
    return init;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return { leaves: 0 };
  }
}

async function setBonus(state: BonusState): Promise<void> {
  await SecureStore.setItemAsync(BONUS_KEY, JSON.stringify(state));
}

export interface LeafBalance {
  daily: number;     // 오늘 남은 무료
  bonus: number;     // 보너스 풀
  total: number;     // 합계
  isUnlimited: boolean;  // PRO 여부
}

export async function getBalance(): Promise<LeafBalance> {
  if (isPro()) {
    return { daily: Infinity, bonus: Infinity, total: Infinity, isUnlimited: true };
  }
  const [d, b] = await Promise.all([getDaily(), getBonus()]);
  return {
    daily: round1(d.leaves),
    bonus: round1(b.leaves),
    total: round1(d.leaves + b.leaves),
    isUnlimited: false,
  };
}

export async function canSpend(action: LeafAction): Promise<boolean> {
  if (isPro()) return true;
  const cost = LEAF_COST[action];
  const { total } = await getBalance();
  return total >= cost;
}

/**
 * 잎사귀 차감. 일일 먼저, 부족분은 보너스에서.
 * 잔액 부족이면 false (호출 측에서 사전 체크 권장 — checkLeafOrAlert).
 */
export async function spend(action: LeafAction): Promise<boolean> {
  if (isPro()) return true;
  const cost = LEAF_COST[action];
  const daily = await getDaily();
  const bonus = await getBonus();

  if (daily.leaves + bonus.leaves < cost) return false;

  if (daily.leaves >= cost) {
    daily.leaves = round1(daily.leaves - cost);
    await setDaily(daily);
  } else {
    const remainder = round1(cost - daily.leaves);
    daily.leaves = 0;
    bonus.leaves = round1(bonus.leaves - remainder);
    await Promise.all([setDaily(daily), setBonus(bonus)]);
  }
  return true;
}

export async function addBonusLeaves(amount: number): Promise<void> {
  const bonus = await getBonus();
  bonus.leaves = round1(bonus.leaves + amount);
  await setBonus(bonus);
}

// ── 보상형 광고 시청 제한 (일일 상한 + 쿨다운) ──────────────
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
 * SecureStore 의 첫 실행 분기를 트리거 (웰컴 보너스 지급).
 */
export async function loadLeaves(): Promise<void> {
  await Promise.all([getDaily(), getBonus()]);
}

/**
 * 테스트용 — 일일 잎사귀 + 광고 시청 제한(횟수/쿨다운)을 리셋 (보너스는 유지)
 */
export async function resetDailyLeaves(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(DAILY_KEY),
    SecureStore.deleteItemAsync(AD_KEY),
  ]);
}
