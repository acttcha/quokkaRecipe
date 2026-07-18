import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { setIsPro } from './subscription';
import { addBonusLeaves, grantProMonthlyLeavesIfNew } from './leaves';

// ─── RevenueCat 결제 연동 ──────────────────────────────────────
// 광고와 동일하게 Expo Go 에선 네이티브 모듈이 없으므로 조건부 require + no-op.
// API 키가 비어있으면(아직 미설정) 역시 no-op → 앱은 개발자 토글로 기존처럼 동작.
//
// ⚠️ 출시 전 해야 할 것 (자세한 건 docs/PAYMENTS_SETUP.md):
//   1) RevenueCat 프로젝트 생성 → iOS/Android "public SDK key" 발급해 아래 RC_KEYS 채우기
//   2) App Store / Play Console 에 아래 PRODUCT_IDS 와 동일한 상품ID로
//      구독 1개 + 소모성 인앱 5개 생성, RevenueCat 에 연결
//   3) RevenueCat 에 "pro" entitlement + "default" offering 구성
//   4) 소모성(잎사귀) 잔액은 Supabase 서버 적립으로 이관 (creditLeaves TODO)

export const isExpoGo = Constants.executionEnvironment === 'storeClient';

// RevenueCat 대시보드 > Project settings > API keys 의 "public app-specific key"
// (public 키라 앱에 박혀도 안전. iOS 는 App Store 앱 등록 후 채우기)
const RC_KEYS = { ios: '', android: 'goog_ACpGGDXNZGcPxcpUASNHFqGaSpT' };

const ENTITLEMENT_ID = 'pro';            // 구독 활성 여부 판정용 entitlement
export const SUBSCRIPTION_PRODUCT_ID = 'quokka_pass_monthly';

// 잎사귀 팩 productId → 지급 잎사귀 수. (leafPackages.ts 의 id 와 1:1, 스토어 상품ID와 일치)
// productId 는 영구 고정(개수 미포함). 지급 개수는 LEAF_GRANT 에서 관리 → 언제든 변경 가능.
export const LEAF_PRODUCT_IDS: Record<string, string> = {
  handful: 'leaf_pack_1',
  bundle:  'leaf_pack_2',
  armful:  'leaf_pack_3',
  basket:  'leaf_pack_4',
  box:     'leaf_pack_5',
};
const LEAF_GRANT: Record<string, number> = {
  leaf_pack_1: 15, leaf_pack_2: 60, leaf_pack_3: 125, leaf_pack_4: 300, leaf_pack_5: 1000,
};

let Purchases: any = null;
let _configured = false;

if (!isExpoGo) {
  try { Purchases = require('react-native-purchases').default; } catch { Purchases = null; }
}

/** 결제 모듈이 실제로 구성됐는지 (키 설정 + 네이티브 사용 가능). 미구성이면 UI 는 "준비 중" 유지. */
export function isPurchasesReady(): boolean {
  return _configured;
}

export async function initPurchases(): Promise<void> {
  if (isExpoGo || !Purchases) return;
  const apiKey = Platform.OS === 'ios' ? RC_KEYS.ios : RC_KEYS.android;
  if (!apiKey) return; // 키 미설정 → 무시 (개발자 토글로 동작)
  try {
    Purchases.configure({ apiKey });
    _configured = true;
    Purchases.addCustomerInfoUpdateListener(syncEntitlement);
    syncEntitlement(await Purchases.getCustomerInfo());
  } catch {
    _configured = false;
  }
}

function syncEntitlement(info: any): void {
  const pro = info?.entitlements?.active?.[ENTITLEMENT_ID];
  setIsPro(!!pro);
  if (pro) {
    // 구독 활성 → 이번 주기 월 잎사귀 지급 (무제한 아님, 매달 PRO_MONTHLY_LEAVES).
    // periodId 가 갱신마다 바뀌어 주기당 1회만 지급됨.
    const periodId = String(pro.latestPurchaseDate || pro.originalPurchaseDate || 'active');
    grantProMonthlyLeavesIfNew(periodId).catch(() => { /* 무시 */ });
  }
}

/** 현재 offering 의 구매 가능한 패키지 목록 (가격 표시 등에 사용). 미구성 시 빈 배열. */
export async function getOfferingPackages(): Promise<any[]> {
  if (!_configured || !Purchases) return [];
  try {
    const offerings = await Purchases.getOfferings();
    return offerings?.current?.availablePackages ?? [];
  } catch {
    return [];
  }
}

async function purchaseByProductId(productId: string): Promise<boolean> {
  if (!_configured || !Purchases) return false;
  try {
    const offerings = await Purchases.getOfferings();
    const pkgs = offerings?.current?.availablePackages ?? [];
    // 소모성은 'leaf_pack_1', 안드 구독은 'quokka_pass_monthly:monthly'(상품ID:기본요금제) 형식이라
    // 정확 일치 + 콜론 접두 일치 둘 다 허용.
    const pkg = pkgs.find((p: any) => {
      const id = p.product?.identifier;
      return id === productId || id?.startsWith(productId + ':');
    });
    if (!pkg) {
      // 패키지 못 찾음 = offering 미설정(Current 아님)/상품 전파 전/ID 불일치.
      // 조용히 false 대신 이유를 던져 UI 에서 표시(진단 용이).
      throw new Error(`상품을 찾을 수 없어요 (offerings: ${pkgs.length}개, id=${productId})`);
    }
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    syncEntitlement(customerInfo);
    // 소모성 잎사귀면 지급.
    // TODO(server): 클라 적립은 위변조 가능 → RevenueCat 웹훅 → Supabase 로 이관.
    const grant = LEAF_GRANT[productId];
    if (grant) await addBonusLeaves(grant);
    return true;
  } catch (e: any) {
    if (e?.userCancelled) return false;
    throw e;
  }
}

/** 잎사귀 팩 구매. leafPackages.id ('handful' 등) 전달. 성공 시 true. */
export async function purchaseLeafPackage(packageId: string): Promise<boolean> {
  const productId = LEAF_PRODUCT_IDS[packageId];
  if (!productId) return false;
  return purchaseByProductId(productId);
}

/** 쿼카 패스 구독. 성공 시 true (entitlement 동기화됨). */
export async function purchaseSubscription(): Promise<boolean> {
  return purchaseByProductId(SUBSCRIPTION_PRODUCT_ID);
}

/** 구매 복원 (기기 변경/재설치 시 구독 되살리기). */
export async function restorePurchases(): Promise<boolean> {
  if (!_configured || !Purchases) return false;
  try {
    syncEntitlement(await Purchases.restorePurchases());
    return true;
  } catch {
    return false;
  }
}
