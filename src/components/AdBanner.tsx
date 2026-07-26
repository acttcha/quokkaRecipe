import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp, Platform } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from '../services/ads';
import { isPro } from '../services/subscription';
import { Colors } from '../constants/colors';

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
  if (isPro()) return null;   // 쿼카 패스 = 광고 제거

  // Expo Go 등 네이티브 모듈이 없을 땐 실제 광고 대신 자리 표시용 박스를 렌더.
  // (개발 중에도 배너가 어디에 뜨는지 확인 가능. 실제 빌드에선 진짜 배너가 뜸)
  if (!BannerAd) {
    return (
      <View style={[styles.wrap, style]}>
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>광고 영역 (개발 중 미표시)</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, style]}>
      <BannerAd unitId={bannerUnitId} size={BannerAdSize.BANNER} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', marginTop: 16, marginBottom: 8 },
  placeholder: {
    width: 320, height: 50, borderRadius: 6,
    borderWidth: 1, borderColor: Colors.line, borderStyle: 'dashed',
    backgroundColor: 'rgba(0,0,0,0.03)',
    alignItems: 'center', justifyContent: 'center',
  },
  placeholderText: { fontSize: 12, color: Colors.inkMute, fontWeight: '700' },
});
