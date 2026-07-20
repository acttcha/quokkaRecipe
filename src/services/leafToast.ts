// 잎사귀 사용 토스트 이벤트 버스.
// gemini-proxy 가 차감 후 응답 헤더로 알려주면 callGemini 가 emit,
// 앱 루트의 <LeafToast/> 가 구독해서 표시한다. (화면별 코드 불필요)

export interface LeafSpendEvent {
  spent: number;  // 이번에 사용한 잎사귀
  total: number;  // 사용 후 남은 총 잔액
}

let _listener: ((e: LeafSpendEvent) => void) | null = null;

/** 토스트 컴포넌트가 구독. null 로 해제. */
export function onLeafSpend(fn: ((e: LeafSpendEvent) => void) | null): void {
  _listener = fn;
}

/** callGemini 가 차감 발생 시 호출. */
export function emitLeafSpend(e: LeafSpendEvent): void {
  _listener?.(e);
}
