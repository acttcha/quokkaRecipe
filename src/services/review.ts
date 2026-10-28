// 스토어 리뷰 요청 — 리뷰 수는 스토어 설치 전환율에 직접 영향을 준다.
// 요리를 "끝낸" 직후가 가장 긍정적인 순간이라 그때만 띄운다.
// iOS/Android 모두 시스템이 노출 빈도를 자체 제한하므로, 우리 쪽에서도 한 번만 시도한다.
import * as StoreReview from 'expo-store-review';
import * as SecureStore from 'expo-secure-store';

export const REVIEW_ASKED_KEY = 'review_asked';
export const COOK_DONE_COUNT_KEY = 'cook_done_count';

// 첫 완료에 바로 띄우면 성급하다 — 두 번째 요리를 마쳤을 때.
const ASK_AFTER_COOKS = 2;

async function getCount(): Promise<number> {
  try {
    const raw = await SecureStore.getItemAsync(COOK_DONE_COUNT_KEY);
    return raw ? parseInt(raw, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

/**
 * 쿡모드를 완주했을 때 호출.
 * 조건이 차면 시스템 리뷰 팝업을 띄운다(실제 노출 여부는 OS가 결정).
 */
export async function noteCookFinished(): Promise<void> {
  try {
    const count = (await getCount()) + 1;
    await SecureStore.setItemAsync(COOK_DONE_COUNT_KEY, String(count));

    if (count < ASK_AFTER_COOKS) return;
    if ((await SecureStore.getItemAsync(REVIEW_ASKED_KEY)) === '1') return;
    if (!(await StoreReview.isAvailableAsync())) return;
    if (!(await StoreReview.hasAction())) return;

    // 완료 화면을 잠깐 본 뒤에 뜨도록 지연 — 바로 띄우면 축하 화면을 팝업이 덮는다.
    // 기록은 타이머 안에서 한다: 지연 중에 앱을 닫으면 팝업이 뜨지 않으므로,
    // 미리 기록해두면 기회를 영영 잃는다.
    setTimeout(() => {
      SecureStore.setItemAsync(REVIEW_ASKED_KEY, '1').catch(() => {});
      StoreReview.requestReview().catch(() => {});
    }, 1800);
  } catch {
    // 리뷰 요청 실패는 사용자 경험에 영향이 없어야 하므로 조용히 무시
  }
}
