// 잎사귀 사용 토스트 이벤트 버스.
// gemini-proxy 가 차감 후 응답 헤더로 알려주면 callGemini 가 emit,
// <LeafToast/> 들이 구독해서 표시한다. (앱 루트 + 모달 안 등 여러 곳 동시 구독 가능)

export interface LeafSpendEvent {
  spent: number;  // 이번에 사용한 잎사귀
  total: number;  // 사용 후 남은 총 잔액
}

type Listener = (e: LeafSpendEvent) => void;
const _listeners = new Set<Listener>();

/** 구독. 반환된 함수를 호출하면 해제. */
export function subscribeLeafSpend(fn: Listener): () => void {
  _listeners.add(fn);
  return () => { _listeners.delete(fn); };
}

/** callGemini 가 차감 발생 시 호출. 구독 중인 모든 토스트에 전달. */
export function emitLeafSpend(e: LeafSpendEvent): void {
  _listeners.forEach((fn) => { try { fn(e); } catch { /* 무시 */ } });
}
