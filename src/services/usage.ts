import * as SecureStore from 'expo-secure-store';

export type UsageType = 'recipe' | 'scan' | 'qa';

const DAILY_KEY = 'daily_usage_v1';
const BONUS_KEY = 'bonus_credits_v1';

// 무료 사용자 한도
export const FREE_DAILY_LIMIT: Record<UsageType, number> = {
  recipe: 3,  // 레시피 추천 + 유튜브 분석
  scan: 5,    // 재료 스캔 + 영수증
  qa: 30,     // 쿼카 Q&A (1.7원/회로 저렴하지만 봇 방지용 상한)
};

// 광고 1회 시청 보상
export const AD_REWARD: Record<UsageType, number> = {
  recipe: 1,
  scan: 2,
  qa: 10,
};

interface DailyState {
  date: string;       // YYYY-MM-DD
  recipe: number;
  scan: number;
  qa: number;
}

interface BonusState {
  recipe: number;
  scan: number;
  qa: number;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

async function getDaily(): Promise<DailyState> {
  const raw = await SecureStore.getItemAsync(DAILY_KEY);
  const today = todayStr();
  if (!raw) return { date: today, recipe: 0, scan: 0, qa: 0 };
  try {
    const parsed: DailyState = JSON.parse(raw);
    if (parsed.date !== today) return { date: today, recipe: 0, scan: 0, qa: 0 };
    // 마이그레이션: 이전 버전에 qa 필드 없으면 0으로
    if (typeof parsed.qa !== 'number') parsed.qa = 0;
    return parsed;
  } catch {
    return { date: today, recipe: 0, scan: 0, qa: 0 };
  }
}

async function setDaily(state: DailyState): Promise<void> {
  await SecureStore.setItemAsync(DAILY_KEY, JSON.stringify(state));
}

async function getBonus(): Promise<BonusState> {
  const raw = await SecureStore.getItemAsync(BONUS_KEY);
  if (!raw) return { recipe: 0, scan: 0, qa: 0 };
  try {
    const parsed: BonusState = JSON.parse(raw);
    if (typeof parsed.qa !== 'number') parsed.qa = 0;
    return parsed;
  } catch {
    return { recipe: 0, scan: 0, qa: 0 };
  }
}

async function setBonus(state: BonusState): Promise<void> {
  await SecureStore.setItemAsync(BONUS_KEY, JSON.stringify(state));
}

export interface UsageStatus {
  used: number;          // 오늘 사용한 횟수
  limit: number;         // 일일 한도
  bonus: number;         // 보너스 풀 잔여
  remaining: number;     // 사용 가능한 총 잔여 (일일 + 보너스)
}

export async function getStatus(type: UsageType): Promise<UsageStatus> {
  const [daily, bonus] = await Promise.all([getDaily(), getBonus()]);
  const limit = FREE_DAILY_LIMIT[type];
  const used = daily[type];
  const bonusLeft = bonus[type];
  const dailyLeft = Math.max(0, limit - used);
  return {
    used,
    limit,
    bonus: bonusLeft,
    remaining: dailyLeft + bonusLeft,
  };
}

export async function canUse(type: UsageType): Promise<boolean> {
  const status = await getStatus(type);
  return status.remaining > 0;
}

/**
 * 사용 기록. 일일 한도 먼저 소진, 다 쓰면 보너스 차감.
 * 한도 초과면 false 반환 (호출 측에서 사전 체크하는 게 정석)
 */
export async function recordUsage(type: UsageType): Promise<boolean> {
  const [daily, bonus] = await Promise.all([getDaily(), getBonus()]);
  const limit = FREE_DAILY_LIMIT[type];

  if (daily[type] < limit) {
    daily[type]++;
    await setDaily(daily);
    return true;
  }
  if (bonus[type] > 0) {
    bonus[type]--;
    await setBonus(bonus);
    return true;
  }
  return false;
}

/**
 * 광고 시청 보상 등으로 보너스 적립
 */
export async function addBonus(type: UsageType, amount: number): Promise<void> {
  const bonus = await getBonus();
  bonus[type] += amount;
  await setBonus(bonus);
}

/**
 * 테스트용 — 일일 사용 카운트를 0으로 리셋 (보너스는 유지)
 */
export async function resetDailyUsage(): Promise<void> {
  await SecureStore.deleteItemAsync(DAILY_KEY);
}
