import React from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// 실제 보상형 광고 단위 ID (프로덕션 전용). iOS 는 iOS AdMob 앱 만든 뒤 채우기.
const REAL_REWARDED = Platform.select({
  android: 'ca-app-pub-8578688184080776/4716744826',
  ios: '', // TODO(iOS): iOS 보상형 광고 단위 ID
}) ?? '';

// Expo Go 에서는 react-native-google-mobile-ads 의 네이티브 뷰가 등록 안 돼서
// import 자체로 크래시 가능. 그래서 조건부 require 로 감싸서 Expo Go 일 땐
// 아예 라이브러리를 로드하지 않음.

export const isExpoGo = Constants.executionEnvironment === 'storeClient';

type BannerAdSizeMap = {
  BANNER: string;
  LARGE_BANNER: string;
  MEDIUM_RECTANGLE: string;
  FULL_BANNER: string;
};

type TestIdsMap = { BANNER: string; INTERSTITIAL: string; REWARDED: string };

export let BannerAd: React.ComponentType<{ unitId: string; size: string }> | null = null;
export let BannerAdSize: BannerAdSizeMap = {
  BANNER: '', LARGE_BANNER: '', MEDIUM_RECTANGLE: '', FULL_BANNER: '',
};
export let TestIds: TestIdsMap = { BANNER: '', INTERSTITIAL: '', REWARDED: '' };
export let initAds: () => Promise<void> = async () => { /* no-op in Expo Go */ };

// 보상형 광고를 1회 로드→재생하고, 보상 획득 시 true 로 resolve.
// Expo Go 에선 항상 false (네이티브 모듈 없음 → 호출 측에서 isExpoGo 로 안내).
export let showRewardedAd: () => Promise<boolean> = async () => false;

if (!isExpoGo) {
  const ads = require('react-native-google-mobile-ads');
  BannerAd = ads.BannerAd;
  BannerAdSize = ads.BannerAdSize;
  TestIds = ads.TestIds;
  // UMP 동의(개인화 광고 동의) 수집 후 광고 초기화.
  //  - EEA/영국 등 동의 필요한 지역 사용자에게만 폼이 뜸(AdMob 콘솔에 동의 메시지 구성 필요).
  //  - 한국 등 그 외 지역은 폼 없이 통과. 동의 실패해도 초기화는 진행(비개인화로 송출).
  initAds = async () => {
    try {
      await ads.AdsConsent.requestInfoUpdate();
      await ads.AdsConsent.loadAndShowConsentFormIfRequired();
    } catch { /* 무시 — 동의 수집 실패가 광고를 막진 않음 */ }
    await ads.default().initialize();
  };

  const { RewardedAd, RewardedAdEventType, AdEventType } = ads;

  // 개발 빌드/시뮬레이터는 항상 테스트 단위(자기 클릭=계정정지 방지).
  // 프로덕션에서 실 단위가 있을 때만 실제 광고 송출. (iOS 미설정 시 테스트로 폴백)
  const rewardedUnitId = __DEV__ || !REAL_REWARDED ? ads.TestIds.REWARDED : REAL_REWARDED;

  showRewardedAd = () => new Promise<boolean>((resolve) => {
    const rewarded = RewardedAd.createForAdRequest(rewardedUnitId, {
      requestNonPersonalizedAdsOnly: true,
    });
    let earned = false;
    let settled = false;
    const subs: Array<() => void> = [];
    const finish = (result: boolean) => {
      if (settled) return;
      settled = true;
      subs.forEach((unsub) => unsub());
      resolve(result);
    };

    subs.push(rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
      try { rewarded.show(); } catch { finish(false); }
    }));
    subs.push(rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
      earned = true;
    }));
    subs.push(rewarded.addAdEventListener(AdEventType.CLOSED, () => finish(earned)));
    subs.push(rewarded.addAdEventListener(AdEventType.ERROR, () => finish(false)));

    try { rewarded.load(); } catch { finish(false); }
  });
}
