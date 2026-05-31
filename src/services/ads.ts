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

if (!isExpoGo) {
  const ads = require('react-native-google-mobile-ads');
  BannerAd = ads.BannerAd;
  BannerAdSize = ads.BannerAdSize;
  TestIds = ads.TestIds;
  initAds = () => ads.default().initialize().then(() => undefined);
}
