import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, Alert, Image, ImageBackground, Dimensions, AppState, Modal,
  TextInput, Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { NavProps } from '../types';
import { MOCK_MODE } from '../services/claude';
import { getFridgeIngredients } from '../services/fridge';
import { getStatus, UsageStatus } from '../services/usage';
import { Colors, shadow } from '../constants/colors';
import { CircleIconButton, SettingsIcon } from '../components/ui';
import { haptic } from '../services/haptics';

const { width, height } = Dimensions.get('window');
// 화면 높이에 비례하는 쿼카 크기 — 작은 폰에선 자동으로 축소돼 사용량 칩/말풍선과 안 겹침
const QUOKKA_HEIGHT = Math.min(360, height * 0.36);

// 타일 아이콘 — FridgeScreen 스타일과 통일
function IconFridge() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M6.5 3.5h11a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Z"
        stroke={Colors.forestDeep} strokeWidth={1.7} strokeLinejoin="round" />
      <Line x1={4.5} y1={10.5} x2={19.5} y2={10.5} stroke={Colors.forestDeep} strokeWidth={1.7} />
      <Line x1={7.5} y1={6.5} x2={7.5} y2={8.5} stroke={Colors.forestDeep} strokeWidth={1.7} strokeLinecap="round" />
      <Line x1={7.5} y1={13} x2={7.5} y2={15} stroke={Colors.forestDeep} strokeWidth={1.7} strokeLinecap="round" />
    </Svg>
  );
}

function IconSearch() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Circle cx={11} cy={11} r={6.5} stroke={Colors.orangeDeep} strokeWidth={1.8} />
      <Path d="m16 16 4 4" stroke={Colors.orangeDeep} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

const HAS_API_KEY = !!process.env.EXPO_PUBLIC_SUPABASE_URL && !!process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export default function HomeScreen({ navigate }: NavProps) {
  const insets = useSafeAreaInsets();
  const [recipeStatus, setRecipeStatus] = useState<UsageStatus | null>(null);
  const [scanStatus, setScanStatus] = useState<UsageStatus | null>(null);
  const [qaStatus, setQaStatus] = useState<UsageStatus | null>(null);
  const [usageModalVisible, setUsageModalVisible] = useState(false);
  const [dishModalVisible, setDishModalVisible] = useState(false);
  const [dishQuery, setDishQuery] = useState('');

  const loadUsage = useCallback(async () => {
    const [r, s, q] = await Promise.all([
      getStatus('recipe'),
      getStatus('scan'),
      getStatus('qa'),
    ]);
    setRecipeStatus(r);
    setScanStatus(s);
    setQaStatus(q);
  }, []);

  useEffect(() => {
    loadUsage();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') loadUsage();
    });
    return () => sub.remove();
  }, [loadUsage]);

  const handleSearchDish = () => {
    const q = dishQuery.trim();
    if (!q) return;
    if (!MOCK_MODE && !HAS_API_KEY) {
      haptic.error();
      Alert.alert('API 키 필요', '앱에 API 키가 설정되어 있지 않아요.', [{ text: '확인' }]);
      return;
    }
    haptic.medium();
    Keyboard.dismiss();
    setDishQuery('');
    setDishModalVisible(false);
    navigate({ name: 'DishRecipe', dishName: q });
  };

  const closeDishModal = () => {
    Keyboard.dismiss();
    setDishModalVisible(false);
    setDishQuery('');
  };

  const openUsageModal = () => {
    haptic.light();
    loadUsage();
    setUsageModalVisible(true);
  };

  const handleRecommend = async () => {
    if (!MOCK_MODE && !HAS_API_KEY) {
      haptic.error();
      Alert.alert('API 키 필요', '앱에 API 키가 설정되어 있지 않아요.', [{ text: '확인' }]);
      return;
    }
    haptic.medium();
    const ingredients = await getFridgeIngredients();
    navigate({ name: 'FridgeRecipes', ingredients });
  };

  return (
    <ImageBackground
      source={require('../../assets/background.png')}
      style={styles.root}
      resizeMode="cover"
    >
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* 로고 + 설정 버튼 */}
      <View style={[styles.logoWrap, { paddingTop: Math.max(insets.top + 12, 24) }]}>
        <Image source={require('../../assets/main_logo.png')} style={styles.logo} resizeMode="contain" />
        <View style={styles.btnSetting}>
          <CircleIconButton onPress={() => navigate({ name: 'Settings' })}>
            <SettingsIcon size={20} />
          </CircleIconButton>
        </View>
      </View>

      {/* 오늘의 사용량 칩 */}
      <View style={styles.usageChipWrap}>
        <TouchableOpacity
          style={styles.usageChip}
          onPress={openUsageModal}
          activeOpacity={0.75}
        >
          <Text style={styles.usageChipEmoji}>🐾</Text>
          <Text style={styles.usageChipText}>
            오늘 남은 횟수{' '}
            <Text style={styles.usageChipCount}>
              {recipeStatus ? recipeStatus.remaining : '·'}
            </Text>
            <Text style={styles.usageChipSlash}>회</Text>
          </Text>
          <Text style={styles.usageChipArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* 쿼카 + 말풍선 */}
      <View style={styles.charWrap}>
        <View style={styles.bubbleOuter}>
          <View style={styles.bubble}>
            <Text style={styles.bubbleText}>오늘 뭐 드실 건가요? 🍽️</Text>
            <Text style={styles.bubbleSub}>냉장고 재료로 레시피 뚝딱!</Text>
          </View>
          <View style={styles.bubbleTail} />
        </View>
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

        {/* 두 가지 추천 흐름 — 가로 반반 */}
        <View style={styles.tileRow}>
          <TouchableOpacity
            style={styles.tile}
            onPress={handleRecommend}
            activeOpacity={0.82}
          >
            <View style={[styles.tileIcon, styles.tileIconGreen]}>
              <IconFridge />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.tileTitle}>보유 재료 추천</Text>
              <Text style={styles.tileSub}>냉장고에 있는 걸로</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.tile}
            onPress={() => {
              haptic.light();
              setDishModalVisible(true);
            }}
            activeOpacity={0.82}
          >
            <View style={[styles.tileIcon, styles.tileIconOrange]}>
              <IconSearch />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.tileTitle}>만들고 싶은 요리</Text>
              <Text style={styles.tileSub}>이름으로 검색</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* 사용량 상세 모달 */}
      <Modal
        visible={usageModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setUsageModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.umBackdrop}
          activeOpacity={1}
          onPress={() => setUsageModalVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.umCard}>
            <View style={styles.umHeader}>
              <Text style={styles.umEmoji}>🐾</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.umTitle}>오늘의 사용량</Text>
                <Text style={styles.umSub}>매일 자정에 다시 채워져요</Text>
              </View>
              <TouchableOpacity onPress={() => setUsageModalVisible(false)} style={styles.umClose}>
                <Text style={styles.umCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.umRow}>
              <UsageStat icon="🍳" label="AI 추천" status={recipeStatus} />
              <View style={styles.usageDivider} />
              <UsageStat icon="📷" label="스캔" status={scanStatus} />
              <View style={styles.usageDivider} />
              <UsageStat icon="💬" label="Q&A" status={qaStatus} />
            </View>

            <View style={styles.umDivider} />

            <TouchableOpacity
              style={styles.umAdBtn}
              onPress={() => Alert.alert('곧 지원돼요', '광고 보고 횟수 충전 기능은 준비 중이에요 🐾')}
              activeOpacity={0.82}
            >
              <Text style={styles.umAdEmoji}>📺</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.umAdTitle}>광고 보고 횟수 충전</Text>
                <Text style={styles.umAdSub}>30초 광고 1회 시청으로 보너스 적립</Text>
              </View>
              <Text style={styles.umAdBadge}>곧 지원</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* 요리 검색 모달 */}
      <Modal
        visible={dishModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeDishModal}
      >
        <TouchableOpacity
          style={styles.umBackdrop}
          activeOpacity={1}
          onPress={closeDishModal}
        >
          <TouchableOpacity activeOpacity={1} style={styles.dishCard}>
            <View style={styles.dishHeader}>
              <Text style={styles.dishEmoji}>🔍</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.dishTitle}>만들고 싶은 요리 검색</Text>
                <Text style={styles.dishSub}>요리 이름을 입력하면 레시피를 만들어드려요</Text>
              </View>
              <TouchableOpacity onPress={closeDishModal} style={styles.dishClose}>
                <Text style={styles.dishCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.dishInput}
              value={dishQuery}
              onChangeText={setDishQuery}
              placeholder="예: 김치찌개, 파스타, 오므라이스"
              placeholderTextColor={Colors.inkMute}
              returnKeyType="search"
              onSubmitEditing={handleSearchDish}
              autoFocus
            />

            {/* 빠른 선택 칩 */}
            <View style={styles.dishQuickWrap}>
              {['김치찌개', '파스타', '볶음밥', '국밥', '카레', '비빔밥'].map(q => (
                <TouchableOpacity
                  key={q}
                  style={styles.dishQuickChip}
                  onPress={() => setDishQuery(q)}
                >
                  <Text style={styles.dishQuickText}>{q}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.dishSubmit, !dishQuery.trim() && styles.dishSubmitDisabled]}
              onPress={handleSearchDish}
              disabled={!dishQuery.trim()}
              activeOpacity={0.85}
            >
              <Text style={styles.dishSubmitText}>레시피 찾기 🍽️</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </ImageBackground>
  );
}

function UsageStat({
  icon, label, status, unlimited,
}: {
  icon: string;
  label: string;
  status?: UsageStatus | null;
  unlimited?: boolean;
}) {
  if (unlimited) {
    return (
      <View style={statStyles.item}>
        <Text style={statStyles.icon}>{icon}</Text>
        <Text style={statStyles.label}>{label}</Text>
        <Text style={statStyles.valueUnlimited}>∞</Text>
        <Text style={statStyles.subtle}>무제한</Text>
      </View>
    );
  }
  if (!status) {
    return (
      <View style={statStyles.item}>
        <Text style={statStyles.icon}>{icon}</Text>
        <Text style={statStyles.label}>{label}</Text>
        <Text style={statStyles.value}>...</Text>
      </View>
    );
  }
  const out = status.remaining === 0;
  const low = status.remaining === 1;
  const color = out ? Colors.coral : low ? '#D97706' : Colors.forest;
  return (
    <View style={statStyles.item}>
      <Text style={statStyles.icon}>{icon}</Text>
      <Text style={statStyles.label}>{label}</Text>
      <Text style={[statStyles.value, { color }]}>
        {status.remaining}
        <Text style={statStyles.valueSlash}>/{status.limit}</Text>
      </Text>
      {status.bonus > 0 ? (
        <Text style={statStyles.bonus}>+보너스 {status.bonus}</Text>
      ) : (
        <Text style={statStyles.subtle}>{out ? '한도 끝' : '남음'}</Text>
      )}
    </View>
  );
}

const statStyles = StyleSheet.create({
  item: { flex: 1, alignItems: 'center', gap: 2 },
  icon: { fontSize: 20, marginBottom: 2 },
  label: { fontSize: 11, fontWeight: '700', color: Colors.inkMute, letterSpacing: 0.2 },
  value: { fontSize: 18, fontWeight: '900', color: Colors.forest, marginTop: 2 },
  valueSlash: { fontSize: 12, fontWeight: '700', color: Colors.inkMute },
  valueUnlimited: { fontSize: 20, fontWeight: '900', color: Colors.forest, marginTop: 2 },
  bonus: { fontSize: 10, fontWeight: '800', color: Colors.forest, marginTop: 1 },
  subtle: { fontSize: 10, fontWeight: '600', color: Colors.inkMute, marginTop: 1 },
});

const styles = StyleSheet.create({
  root: { flex: 1 },

  logoWrap: {
    paddingHorizontal: 32,
    alignItems: 'center', flexDirection: 'row',
    // paddingTop은 insets.top 으로 동적 설정
  },
  logo:      { flex: 1, height: 72 },
  btnSetting:{ marginLeft: 8 },

  // 사용량 칩 (홈 상단 작게)
  usageChipWrap: {
    paddingHorizontal: 20, paddingTop: 6, alignItems: 'center',
  },
  usageChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 999,
    borderWidth: 1, borderColor: Colors.line,
    paddingHorizontal: 12, paddingVertical: 6,
    ...shadow.sm,
  },
  usageChipEmoji: { fontSize: 13 },
  usageChipText: { fontSize: 12, fontWeight: '700', color: Colors.inkSoft },
  usageChipCount: { fontSize: 13, fontWeight: '900', color: Colors.forest },
  usageChipSlash: { fontSize: 11, fontWeight: '700', color: Colors.inkSoft },
  usageChipArrow: { fontSize: 14, color: Colors.inkMute, fontWeight: '300', marginLeft: 2 },

  // 사용량 모달
  umBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  umCard: {
    width: '100%', maxWidth: 400,
    backgroundColor: Colors.white, borderRadius: 24,
    padding: 20, ...shadow.md,
  },
  umHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  umEmoji: { fontSize: 22 },
  umTitle: { fontSize: 16, fontWeight: '900', color: Colors.ink },
  umSub: { fontSize: 11, color: Colors.inkMute, fontWeight: '600', marginTop: 2 },
  umClose: { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.creamSoft, alignItems: 'center', justifyContent: 'center' },
  umCloseText: { fontSize: 13, fontWeight: '700', color: Colors.inkSoft },
  umRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  umDivider: { height: 1, backgroundColor: Colors.line, opacity: 0.5, marginVertical: 14 },
  umAdBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.creamSoft, borderRadius: 16,
    padding: 14, borderWidth: 1, borderColor: Colors.line,
  },
  umAdEmoji: { fontSize: 24 },
  umAdTitle: { fontSize: 13, fontWeight: '800', color: Colors.ink },
  umAdSub: { fontSize: 11, color: Colors.inkSoft, marginTop: 2, fontWeight: '600' },
  umAdBadge: {
    fontSize: 10, fontWeight: '800', color: Colors.orangeDeep,
    backgroundColor: Colors.orangeSoft, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
  },

  usageDivider: { width: 1, height: 36, backgroundColor: Colors.line, opacity: 0.6 },

  bubbleOuter: { alignItems: 'center', marginBottom: 8 },
  bubble: {
    backgroundColor: Colors.creamSoft, borderRadius: 22,
    paddingHorizontal: 22, paddingVertical: 14,
    alignItems: 'center', borderWidth: 1, borderColor: Colors.line, ...shadow.md,
  },
  bubbleText: { fontSize: 17, fontWeight: '900', color: Colors.ink, marginBottom: 3 },
  bubbleSub:  { fontSize: 13, fontWeight: '600', color: Colors.inkSoft },
  bubbleTail: {
    width: 0, height: 0,
    borderLeftWidth: 10,  borderLeftColor:  'transparent',
    borderRightWidth: 10, borderRightColor: 'transparent',
    borderTopWidth: 12,   borderTopColor:   Colors.creamSoft,
  },

  charWrap: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden' },
  quokka:   { width: width * 0.90, height: QUOKKA_HEIGHT },

  panel: {
    backgroundColor: Colors.cream, borderTopLeftRadius: 30, borderTopRightRadius: 30,
    borderTopWidth: 1, borderColor: Colors.line,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, gap: 10, ...shadow.md,
  },
  testBadge:     { alignSelf: 'center', backgroundColor: Colors.orangeSoft, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  testBadgeText: { fontSize: 12, fontWeight: '800', color: Colors.orangeDeep },
  warnBanner:    { backgroundColor: 'rgba(255,107,107,0.08)', borderRadius: 14, padding: 13, alignItems: 'center', borderWidth: 1.5, borderColor: Colors.coral },
  warnText:      { fontSize: 13, fontWeight: '700', color: Colors.coral },

  // 홈 하단 2칸 타일 (보유 재료 추천 / 만들고 싶은 요리)
  tileRow: { flexDirection: 'row', gap: 8 },
  tile: {
    flex: 1, backgroundColor: Colors.white, borderRadius: 16,
    padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: Colors.lineSoft, ...shadow.sm,
  },
  tileIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  tileIconGreen: { backgroundColor: Colors.forestSoft, borderWidth: 1, borderColor: '#CFE5D6' },
  tileIconOrange: { backgroundColor: Colors.orangeSoft, borderWidth: 1, borderColor: '#F2994A40' },
  tileTitle: { fontSize: 13, fontWeight: '700', color: Colors.ink },
  tileSub: { fontSize: 11, color: Colors.inkSoft, fontWeight: '500', marginTop: 1 },

  // 요리 검색 모달
  dishCard: {
    width: '100%', maxWidth: 420,
    backgroundColor: Colors.white, borderRadius: 24,
    padding: 20, ...shadow.md,
  },
  dishHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  dishEmoji: { fontSize: 24 },
  dishTitle: { fontSize: 16, fontWeight: '900', color: Colors.ink },
  dishSub: { fontSize: 11, color: Colors.inkMute, marginTop: 2 },
  dishClose: { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.creamSoft, alignItems: 'center', justifyContent: 'center' },
  dishCloseText: { fontSize: 13, fontWeight: '700', color: Colors.inkSoft },
  dishInput: {
    backgroundColor: Colors.creamSoft,
    borderRadius: 14, borderWidth: 1.5, borderColor: Colors.line,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: Colors.ink,
    marginBottom: 12,
  },
  dishQuickWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 },
  dishQuickChip: {
    backgroundColor: Colors.creamDark, borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  dishQuickText: { fontSize: 12, fontWeight: '700', color: Colors.ink },
  dishSubmit: {
    backgroundColor: Colors.forest, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center', ...shadow.sm,
  },
  dishSubmitDisabled: { backgroundColor: Colors.inkMute, opacity: 0.5 },
  dishSubmitText: { fontSize: 14, fontWeight: '800', color: '#FFF' },
});
