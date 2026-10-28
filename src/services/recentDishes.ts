// 최근 추천된 요리명 기록 — 같은 재료로 다시 추천받아도 "늘 그 요리"가 나오는 걸 줄인다.
// 세션(화면) 내 중복 제외는 RecipeScreen 의 seenNames 가 담당하고,
// 여기 기록은 앱을 껐다 켠 뒤에도 남는 소프트 제외용이다.
import * as SecureStore from 'expo-secure-store';

export const RECENT_DISHES_KEY = 'recent_dishes_v1';

// SecureStore 는 값 1개당 2048바이트 제한이 있다(초과 시 Android 에서 저장 실패).
// 한글은 UTF-8 로 글자당 3바이트라, 최악을 가정해 JSON 길이를 600자(≈1800바이트)로 묶는다.
const MAX = 20;
const MAX_NAME_LEN = 30;
const MAX_JSON_CHARS = 600;

// 앞(최신)에서부터 한도에 들어갈 만큼만 남긴다.
function fitToLimit(names: string[]): string[] {
  const out: string[] = [];
  for (const n of names) {
    const next = [...out, n];
    if (JSON.stringify(next).length > MAX_JSON_CHARS) break;
    out.push(n);
  }
  return out;
}

let _cache: string[] | null = null;

export async function getRecentDishes(): Promise<string[]> {
  if (_cache) return _cache;
  try {
    const raw = await SecureStore.getItemAsync(RECENT_DISHES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    _cache = Array.isArray(parsed) ? parsed.filter((n): n is string => typeof n === 'string') : [];
  } catch {
    _cache = [];
  }
  return _cache;
}

/** 방금 추천한 요리명을 앞쪽에 쌓는다(최신 우선, 중복 제거, 최대 MAX개). */
export async function rememberDishes(names: string[]): Promise<void> {
  const fresh = names
    .map(n => (n ?? '').trim().slice(0, MAX_NAME_LEN))   // 이름도 길이를 자른다
    .filter(Boolean);
  if (fresh.length === 0) return;
  const prev = await getRecentDishes();
  const merged = fitToLimit([...new Set([...fresh, ...prev])].slice(0, MAX));
  _cache = merged;
  try {
    await SecureStore.setItemAsync(RECENT_DISHES_KEY, JSON.stringify(merged));
  } catch {
    // 저장 실패는 추천 품질 문제일 뿐이므로 조용히 무시
  }
}

/** "모든 데이터 삭제" 후 메모리 캐시까지 비우기 위해 reset 에서 호출. */
export function clearRecentDishesCache(): void {
  _cache = null;
}
