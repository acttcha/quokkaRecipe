import React from 'react';
import Constants from 'expo-constants';

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
  initAds = () => ads.default().initialize().then(() => undefined);

  const { RewardedAd, RewardedAdEventType, AdEventType } = ads;

  // 개발 중엔 무조건 구글 공용 테스트 단위. 출시 때 AdMob 콘솔에서 만든
  // 실제 보상형 광고 단위 ID 로 교체 (배너와 동일한 정책).
  // TODO(release): 'ca-app-pub-8578688184080776/<실제 보상형 unit ID>'
  const rewardedUnitId = ads.TestIds.REWARDED;

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
