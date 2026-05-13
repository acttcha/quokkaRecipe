import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, Alert, Image, ImageBackground, Dimensions, Animated, Easing,
} from 'react-native';
import { NavProps } from '../types';
import { MOCK_MODE } from '../services/claude';
import { getSavedRecipes } from '../services/savedRecipes';
import { Colors, shadow } from '../constants/colors';

const { width, height } = Dimensions.get('window');

const FRIDGE_IMGS = [
  require('../../assets/refrigerator1.png'),
  require('../../assets/refrigerator2.png'),
  require('../../assets/refrigerator3.png'),
  require('../../assets/refrigerator4.png'),
];

const HAS_API_KEY = !!process.env.EXPO_PUBLIC_CLAUDE_API_KEY;

export default function HomeScreen({ navigate }: NavProps) {
  const [savedCount, setSavedCount] = useState(0);
  const [fridgeFrame, setFridgeFrame] = useState(0);
  const [fridgeTapping, setFridgeTapping] = useState(false);

  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const overlayScale   = useRef(new Animated.Value(0.08)).current;

  const loadData = useCallback(async () => {
    const saved = await getSavedRecipes();
    setSavedCount(saved.length);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleScan = () => {
    if (!MOCK_MODE && !HAS_API_KEY) {
      Alert.alert('API 키 필요', '앱에 API 키가 설정되어 있지 않아요.', [{ text: '확인' }]);
      return;
    }
    navigate({ name: 'Camera' });
  };

  const handleFridgeTap = () => {
    if (fridgeTapping) return;
    setFridgeTapping(true);

    setFridgeFrame(1);
    setTimeout(() => setFridgeFrame(2), 140);
    setTimeout(() => setFridgeFrame(3), 280);

    Animated.sequence([
      Animated.delay(280),
      Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 420,
          useNativeDriver: true,
          easing: Easing.out(Easing.quad),
        }),
        Animated.timing(overlayScale, {
          toValue: 1,
          duration: 420,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
      ]),
    ]).start(() => {
      navigate({ name: 'Fridge' });
      setTimeout(() => {
        setFridgeFrame(0);
        setFridgeTapping(false);
        overlayOpacity.setValue(0);
        overlayScale.setValue(0.08);
      }, 120);
    });
  };

  const fridgeCenterX = width - 52;
  const fridgeCenterY = height - 260;
  const tx = fridgeCenterX - width / 2;
  const ty = fridgeCenterY - height / 2;

  return (
    <ImageBackground
      source={require('../../assets/background.png')}
      style={styles.root}
      resizeMode="cover"
    >
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* 설정 버튼 */}
      <TouchableOpacity style={styles.settingsBtn} onPress={() => navigate({ name: 'Settings' })}>
        <Text style={styles.settingsIcon}>⚙️</Text>
      </TouchableOpacity>

      {/* 로고 */}
      <View style={styles.logoWrap}>
        <Image source={require('../../assets/main_logo.png')} style={styles.logo} resizeMode="contain" />
      </View>

      {/* 말풍선 */}
      <View style={styles.bubbleOuter}>
        <View style={styles.bubble}>
          <Text style={styles.bubbleText}>오늘 뭐 드실 건가요? 🍽️</Text>
          <Text style={styles.bubbleSub}>재료를 찍으면 레시피 뚝딱!</Text>
        </View>
        <View style={styles.bubbleTail} />
      </View>

      {/* 쿼카 + 냉장고 */}
      <View style={styles.charWrap}>
        <View style={styles.charArea}>
          <Image source={require('../../assets/quokka.png')} style={styles.quokka} resizeMode="contain" />
        </View>

        <TouchableOpacity
          style={styles.fridgeBtn}
          onPress={handleFridgeTap}
          activeOpacity={0.9}
          disabled={fridgeTapping}
        >
          <Image source={FRIDGE_IMGS[fridgeFrame]} style={styles.fridgeImg} resizeMode="contain" />
          <Text style={styles.fridgeLabel}>냉장고</Text>
        </TouchableOpacity>
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
          <Text style={styles.scanTitle}>재료 스캔하기</Text>
          <Text style={styles.scanSub}>카메라로 찍으면 레시피 완성!</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.savedBtn} onPress={() => navigate({ name: 'Saved' })} activeOpacity={0.82}>
          <Text style={styles.savedBtnIcon}>♥</Text>
          <View style={styles.savedBtnTexts}>
            <Text style={styles.savedBtnTitle}>저장된 레시피</Text>
            <Text style={styles.savedBtnSub}>
              {savedCount > 0 ? `${savedCount}개의 레시피가 저장되어 있어요` : '아직 저장된 레시피가 없어요'}
            </Text>
          </View>
          <Text style={styles.savedBtnArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* 냉장고 진입 오버레이 */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          {
            zIndex: 200,
            opacity: overlayOpacity,
            transform: [
              { translateX: tx },
              { translateY: ty },
              { scale: overlayScale },
              { translateX: -tx },
              { translateY: -ty },
            ],
          },
        ]}
      >
        <Image
          source={require('../../assets/refrigerator4.png')}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />
      </Animated.View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  settingsBtn: {
    position: 'absolute', top: 62, right: 22, zIndex: 10,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(27,58,45,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  settingsIcon: { fontSize: 20 },

  logoWrap: { paddingTop: 62, paddingHorizontal: 32 },
  logo: { width: '100%', height: 72, alignSelf: 'center' },

  bubbleOuter: { alignItems: 'center', marginTop: 10 },
  bubble: {
    backgroundColor: '#FFFFFF', borderRadius: 22,
    paddingHorizontal: 22, paddingVertical: 14,
    alignItems: 'center', ...shadow.md,
  },
  bubbleText: { fontSize: 17, fontWeight: '900', color: Colors.primary, marginBottom: 3 },
  bubbleSub: { fontSize: 13, fontWeight: '600', color: Colors.textMid },
  bubbleTail: {
    width: 0, height: 0,
    borderLeftWidth: 10, borderLeftColor: 'transparent',
    borderRightWidth: 10, borderRightColor: 'transparent',
    borderTopWidth: 12, borderTopColor: '#FFFFFF',
  },

  charWrap: { flex: 1 },
  charArea: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden' },
  quokka: { width: width * 0.88, height: 300 },

  fridgeBtn: { position: 'absolute', right: 16, bottom: 16, alignItems: 'center' },
  fridgeImg: { width: 72, height: 112 },
  fridgeLabel: { fontSize: 10, fontWeight: '800', color: Colors.primary, marginTop: 4 },

  panel: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 30, borderTopRightRadius: 30,
    paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40, gap: 14, ...shadow.md,
  },
  testBadge: {
    alignSelf: 'center', backgroundColor: Colors.yellow,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6,
  },
  testBadgeText: { fontSize: 12, fontWeight: '800', color: Colors.primary },
  warnBanner: {
    backgroundColor: 'rgba(255,107,107,0.1)', borderRadius: 14, padding: 13,
    alignItems: 'center', borderWidth: 1.5, borderColor: Colors.coral,
  },
  warnText: { fontSize: 13, fontWeight: '700', color: Colors.coral },

  scanBtn: {
    backgroundColor: Colors.accent, borderRadius: 26,
    alignItems: 'center', paddingVertical: 22, ...shadow.md,
  },
  scanEmoji: { fontSize: 38, marginBottom: 6 },
  scanTitle: { fontSize: 20, fontWeight: '900', color: '#FFF', marginBottom: 4 },
  scanSub: { fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },

  savedBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.cardGreen,
    borderRadius: 20, paddingVertical: 14, paddingHorizontal: 18, gap: 12, ...shadow.sm,
  },
  savedBtnIcon: { fontSize: 22, color: Colors.coral },
  savedBtnTexts: { flex: 1 },
  savedBtnTitle: { fontSize: 15, fontWeight: '800', color: Colors.primary, marginBottom: 2 },
  savedBtnSub: { fontSize: 12, color: Colors.primaryMid, fontWeight: '500' },
  savedBtnArrow: { fontSize: 22, color: Colors.primaryMid, fontWeight: '300' },
});
