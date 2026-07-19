# 결제(RevenueCat) 셋업 가이드

앱 코드는 "키만 꽂으면 작동"하는 상태로 준비돼 있다. 아래 외부 설정을 마치고 빌드하면 실결제가 켜진다.
키/상품을 만들기 전까지는 `isPurchasesReady()` 가 false → 구매 버튼은 기존 "준비 중" 안내로 동작하므로 앱은 안 깨진다.

코드 진입점: `src/services/purchases.ts`

---

## 0. 전제
- **Expo Go 에선 결제 안 됨.** EAS 개발빌드/프로덕션 빌드에서만 동작 (`react-native-purchases` 네이티브 모듈).
- 빌드: `eas build --profile development --platform android` (또는 ios)

## 1. RevenueCat 프로젝트
1. https://app.revenuecat.com 가입 → 프로젝트 생성
2. 앱 등록: iOS(`com.chasoft.quokkarecipe`) / Android(`com.chasoft.quokkarecipe`)
3. **API keys** → 각 플랫폼의 "public app-specific key" 복사
4. `src/services/purchases.ts` 의 `RC_KEYS` 에 붙여넣기
   ```ts
   const RC_KEYS = { ios: 'appl_xxxxx', android: 'goog_xxxxx' };
   ```

## 2. 스토어 상품 생성 (상품ID는 아래와 정확히 일치시킬 것)

| 종류 | 상품ID | 비고 |
|---|---|---|
| 구독(월) | `quokka_pass_monthly` | 자동 갱신 구독 |
| 소모성 | `leaf_pack_1` | 잎사귀 15 (₩1,100) — 개수는 코드 LEAF_GRANT 에서 관리 |
| 소모성 | `leaf_pack_2` | 잎사귀 60 (₩3,300) |
| 소모성 | `leaf_pack_3` | 잎사귀 125 (₩5,500) |
| 소모성 | `leaf_pack_4` | 잎사귀 300 (₩11,000) |
| 소모성 | `leaf_pack_5` | 잎사귀 1000 (₩33,000) |

- **App Store Connect**: 앱 내 구입(소모성) 5개 + 자동 갱신 구독 1개. "유료 앱 계약" 서명 필요.
- **Google Play Console**: 인앱 상품(관리형, 소모성) 5개 + 정기 결제 1개. 앱이 최소 내부테스트 트랙에 업로드돼 있어야 상품 생성 가능.

## 3. RevenueCat 구성
1. **Entitlement** 생성: 식별자 `pro` → 구독 상품(`quokka_pass_monthly`) 연결
2. **Offering** 생성: 식별자 `default`(current) → 위 6개 상품을 패키지로 추가
3. 상품을 각 스토어 상품과 연결 (RevenueCat → Products)

## 4. 빌드 & 테스트
1. `RC_KEYS` 채운 뒤 `eas build` 로 새 빌드
2. 샌드박스 계정(Apple) / 라이선스 테스터(Google)로 결제 테스트
3. 잎사귀 팩 구매 → 잔액 증가 확인 / 구독 → 광고 사라지고 월 지급 확인 / "구매 복원" 동작 확인

---

## 5. (Phase 2) 잎사귀 잔액 서버화 — Supabase

현재 소모성 잎사귀는 구매 성공 시 **로컬(SecureStore)** 에 적립한다 (`purchases.ts` 의 `addBonusLeaves`).
→ 재설치/기기변경 시 유실, 위변조 가능. 출시 후 다음으로 이관:

1. Supabase 테이블 `leaf_wallets(app_user_id text pk, balance int, updated_at timestamptz)`
2. RevenueCat **웹훅** → Supabase Edge Function (`revenuecat-webhook`):
   - `NON_RENEWING_PURCHASE` 이벤트 수신 → product_id 로 잎사귀 수 매핑 → 해당 `app_user_id` 잔액 증가 (서버에서 검증되므로 위변조 불가)
3. 앱은 `app_user_id` = RevenueCat `Purchases.getAppUserID()` 로 잔액을 서버에서 읽기 (leaves.ts 의 bonus 저장소를 서버 조회로 교체)
4. 구독은 entitlement 라 서버 불필요 (RevenueCat 이 관리).

> 로그인 체계는 불필요. RevenueCat 익명 app_user_id 를 키로 쓰면 됨(같은 스토어 계정이면 복원으로 이어짐).
