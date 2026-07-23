import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp, Platform } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from '../services/ads';
import { isPro } from '../services/subscription';

// 실제 배너 광고 단위 ID (프로덕션 전용). iOS 는 iOS AdMob 앱 만든 뒤 채우기.
const REAL_BANNER = Platform.select({
  android: 'ca-app-pub-8578688184080776/3214980957',
  ios: '', // TODO(iOS): iOS 배너 광고 단위 ID
}) ?? '';

// 개발 빌드/시뮬레이터는 항상 테스트 광고(자기 클릭=계정정지 방지).
// 프로덕션에서 실 단위가 있을 때만 실제 광고 송출. (iOS 미설정 시 테스트로 폴백)
const bannerUnitId = __DEV__ || !REAL_BANNER ? TestIds.BANNER : REAL_BANNER;

/**
 * 공용 배너 광고. 콘텐츠 스크롤 "끝자리"에 두는 용도.
 * - Expo Go 에선 BannerAd 가 null 이라 아무것도 렌더링되지 않음.
 * - 개발 중엔 무조건 TestIds.BANNER (자기클릭 = 계정정지 위험).
 *   출시 때 AdMob 콘솔에서 만든 실제 배너 단위 ID 로 교체.
 *   TODO(release): 'ca-app-pub-8578688184080776/<실제 배너 unit ID>'
 */
export function AdBanner({ style }: { style?: StyleProp<ViewStyle> }) {
  if (!BannerAd) return null;
  if (isPro()) return null;   // 쿼카 패스 = 광고 제거
  return (
    <View style={[styles.wrap, style]}>
      <BannerAd unitId={bannerUnitId} size={BannerAdSize.BANNER} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', marginTop: 16, marginBottom: 8 },
});
