import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, Alert, Image, ImageBackground, Dimensions,
} from 'react-native';
import { NavProps } from '../types';
import { MOCK_MODE } from '../services/claude';
import { Colors, shadow } from '../constants/colors';
import { CircleIconButton, SettingsIcon } from '../components/ui';

const { width } = Dimensions.get('window');

const HAS_API_KEY = !!process.env.EXPO_PUBLIC_CLAUDE_API_KEY;

export default function HomeScreen({ navigate }: NavProps) {
  const handleScan = () => {
    if (!MOCK_MODE && !HAS_API_KEY) {
      Alert.alert('API 키 필요', '앱에 API 키가 설정되어 있지 않아요.', [{ text: '확인' }]);
      return;
    }
    navigate({ name: 'Camera' });
  };

  return (
    <ImageBackground
      source={require('../../assets/background.png')}
      style={styles.root}
      resizeMode="cover"
    >
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* 로고 + 설정 버튼 */}
      <View style={styles.logoWrap}>
        <Image source={require('../../assets/main_logo.png')} style={styles.logo} resizeMode="contain" />
        <View style={styles.btnSetting}>
          <CircleIconButton onPress={() => navigate({ name: 'Settings' })}>
            <SettingsIcon size={20} />
          </CircleIconButton>
        </View>
      </View>

      {/* 말풍선 */}
      <View style={styles.bubbleOuter}>
        <View style={styles.bubble}>
          <Text style={styles.bubbleText}>오늘 뭐 드실 건가요? 🍽️</Text>
          <Text style={styles.bubbleSub}>재료를 찍으면 레시피 뚝딱!</Text>
        </View>
        <View style={styles.bubbleTail} />
      </View>

      {/* 쿼카 */}
      <View style={styles.charWrap}>
        <Image source={require('../../assets/quokka.png')} style={styles.quokka} resizeMode="contain" />
      </View>

      {/* 하단 패널 */}
      <View style={styles.panel}>
        {MOCK_MODE && (
          <View style={styles.testBadge}>
            <Text style={styles.testBadgeText}>🧪 테스트 모드</Text>
          </View>
        )}
        {!MOCK_MODE && !HAS_API_KEY && (
          <TouchableOpacity style={styles.warnBanner} onPress={() => navigate({ name: 'Settings' })}>
            <Text style={styles.warnText}>⚠️ API 키 설정이 필요해요 →</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.scanBtn} onPress={handleScan} activeOpacity={0.82}>
          <Text style={styles.scanEmoji}>📸</Text>
          <View>
            <Text style={styles.scanTitle}>재료 스캔하기</Text>
            <Text style={styles.scanSub}>카메라로 찍으면 레시피 완성!</Text>
          </View>
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  logoWrap: {
    paddingTop: 62, paddingHorizontal: 32,
    alignItems: 'center', flexDirection: 'row',
  },
  logo:      { flex: 1, height: 72 },
  btnSetting:{ marginLeft: 8 },

  bubbleOuter: { alignItems: 'center', marginTop: 10 },
  bubble: {
    backgroundColor: '#FFFFFF', borderRadius: 22,
    paddingHorizontal: 22, paddingVertical: 14,
    alignItems: 'center', ...shadow.md,
  },
  bubbleText: { fontSize: 17, fontWeight: '900', color: Colors.primary, marginBottom: 3 },
  bubbleSub:  { fontSize: 13, fontWeight: '600', color: Colors.textMid },
  bubbleTail: {
    width: 0, height: 0,
    borderLeftWidth: 10,  borderLeftColor:  'transparent',
    borderRightWidth: 10, borderRightColor: 'transparent',
    borderTopWidth: 12,   borderTopColor:   '#FFFFFF',
  },

  charWrap: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden' },
  quokka:   { width: width * 0.88, height: 300 },

  panel: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 30, borderTopRightRadius: 30,
    paddingHorizontal: 20, paddingTop: 18, paddingBottom: 20, gap: 14, ...shadow.md,
  },
  testBadge:     { alignSelf: 'center', backgroundColor: Colors.yellow, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  testBadgeText: { fontSize: 12, fontWeight: '800', color: Colors.primary },
  warnBanner:    { backgroundColor: 'rgba(255,107,107,0.1)', borderRadius: 14, padding: 13, alignItems: 'center', borderWidth: 1.5, borderColor: Colors.coral },
  warnText:      { fontSize: 13, fontWeight: '700', color: Colors.coral },

  scanBtn: {
    backgroundColor: Colors.accent, borderRadius: 20,
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 22, gap: 12, ...shadow.md,
  },
  scanEmoji: { fontSize: 28 },
  scanTitle: { fontSize: 16, fontWeight: '900', color: '#FFF' },
  scanSub:   { fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: '500', marginTop: 2 },
});
