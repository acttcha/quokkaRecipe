import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, Alert, Image, ImageBackground, Dimensions, AppState, Modal,
  TextInput, Keyboard, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { LeafIcon } from '../components/LeafIcon';
import { NavProps } from '../types';
import { getMockMode } from '../services/devSettings';
import { getFridgeIngredients } from '../services/fridge';
import {
  getBalance, LeafBalance, FREE_DAILY_LEAVES,
  LEAF_COST, ACTION_LABEL, LeafAction, AD_REWARD,
  getAdWatchesLeft, getAdCooldownRemaining, AD_DAILY_LIMIT,
} from '../services/leaves';
import { watchAdForLeaves } from '../services/leafGate';
import { loadPreferences } from '../services/preferences';
import { Colors, shadow } from '../constants/colors';
import { CircleIconButton, SettingsIcon } from '../components/ui';
import { haptic } from '../services/haptics';

const { width } = Dimensions.get('window');

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
  const [balance, setBalance] = useState<LeafBalance | null>(null);
  const [usageModalVisible, setUsageModalVisible] = useState(false);
  const [dishModalVisible, setDishModalVisible] = useState(false);
  const [dishQuery, setDishQuery] = useState('');
  const [mockMode, setMockMode] = useState(getMockMode());
  const [adLoading, setAdLoading] = useState(false);
  const [adLeft, setAdLeft] = useState(AD_DAILY_LIMIT);
  const [adCooldownLeft, setAdCooldownLeft] = useState(0);  // ms
  const [dishServings, setDishServings] = useState(2);  // 요리검색 인분 (기본=선호도값)

  const loadUsage = useCallback(async () => {
    const [b, left, cooldown, prefs] = await Promise.all([
      getBalance(), getAdWatchesLeft(), getAdCooldownRemaining(), loadPreferences(),
    ]);
    setBalance(b);
    setAdLeft(left);
    setAdCooldownLeft(cooldown);
    setDishServings(prefs.servings);
    setMockMode(getMockMode());
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
    if (!mockMode && !HAS_API_KEY) {
      haptic.error();
      Alert.alert('API 키 필요', '앱에 API 키가 설정되어 있지 않아요.', [{ text: '확인' }]);
      return;
    }
    haptic.medium();
    Keyboard.dismiss();
    setDishQuery('');
    setDishModalVisible(false);
    navigate({ name: 'DishRecipe', dishName: q, servings: dishServings });
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

  const handleWatchAd = async () => {
    if (adLoading) return;
    haptic.light();
    setAdLoading(true);
    try {
      const ok = await watchAdForLeaves();
      if (ok) {
        haptic.success();
        await loadUsage();
        Alert.alert('잎사귀 충전 완료 🍃', `잎사귀 ${AD_REWARD}개가 충전됐어요!`);
      }
    } finally {
      setAdLoading(false);
    }
  };

  const handleRecommend = async () => {
    if (!mockMode && !HAS_API_KEY) {
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

      {/* 잎사귀 잔액 칩 */}
      <View style={styles.usageChipWrap}>
        <TouchableOpacity
          style={styles.usageChip}
          onPress={openUsageModal}
          activeOpacity={0.75}
        >
          <LeafIcon size={26} />
          <Text style={styles.usageChipText}>
            남은 잎사귀{' '}
            <Text style={styles.usageChipCount}>
              {balance ? (balance.isUnlimited ? '∞' : balance.total) : '·'}
            </Text>
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
        {mockMode && (
          <View style={styles.testBadge}>
            <Text style={styles.testBadgeText}>🧪 테스트 모드</Text>
          </View>
        )}
        {!mockMode && !HAS_API_KEY && (
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
              <LeafIcon size={28} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.umTitle}>잎사귀 잔액</Text>
                <Text style={styles.umSub}>
                  {balance?.isUnlimited
                    ? 'PRO 구독 중 — 무제한 사용 가능'
                    : `매일 자정에 무료 잎사귀 ${FREE_DAILY_LEAVES}개가 충전돼요`}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setUsageModalVisible(false)} style={styles.umClose}>
                <Text style={styles.umCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* 잔액 큰 표시 */}
            <View style={styles.leafBig}>
              <Text style={styles.leafBigVal}>
                {balance ? (balance.isUnlimited ? '∞' : balance.total) : '·'}
              </Text>
              <View style={styles.leafBigUnitRow}>
                <LeafIcon size={24} />
                <Text style={styles.leafBigUnit}>사용 가능</Text>
              </View>
              {balance && !balance.isUnlimited && (
                <Text style={styles.leafBigBreakdown}>
                  오늘 무료 {balance.daily} · 보너스 {balance.bonus}
                </Text>
              )}
            </View>

            {/* 비용 안내 */}
            <View style={styles.costGrid}>
              {(['scan', 'recipe', 'qa'] as LeafAction[]).map(a => (
                <View key={a} style={styles.costItem}>
                  <Text style={styles.costLabel}>{ACTION_LABEL[a]}</Text>
                  <View style={styles.costValRow}>
                    <LeafIcon size={30} />
                    <Text style={styles.costVal}>{LEAF_COST[a]}</Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.umDivider} />

            {/* 충전하기 (메인 CTA) */}
            <TouchableOpacity
              style={styles.rechargeBtn}
              onPress={() => {
                setUsageModalVisible(false);
                navigate({ name: 'LeafShop' });
              }}
              activeOpacity={0.85}
            >
              <LeafIcon size={22} />
              <Text style={styles.rechargeBtnText}>잎사귀 충전하기</Text>
              <Text style={styles.rechargeBtnArrow}>›</Text>
            </TouchableOpacity>

            {(() => {
              const cooldownMin = Math.ceil(adCooldownLeft / 60000);
              const onCooldown = adCooldownLeft > 0;
              const dailyDone = adLeft <= 0;
              const disabled = adLoading || dailyDone || onCooldown;
              return (
                <TouchableOpacity
                  style={[styles.umAdBtn, disabled && styles.umAdBtnDisabled]}
                  onPress={handleWatchAd}
                  disabled={disabled}
                  activeOpacity={0.82}
                >
                  <Text style={styles.umAdEmoji}>📺</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.umAdTitle}>광고 보고 잎사귀 받기</Text>
                    <Text style={styles.umAdSub}>
                      {adLoading
                        ? '광고를 불러오는 중…'
                        : dailyDone
                          ? '오늘 충전 완료 · 내일 다시 가능해요'
                          : onCooldown
                            ? `약 ${cooldownMin}분 뒤에 다시 가능해요`
                            : `광고 시청 = 잎사귀 ${AD_REWARD}개 · 오늘 ${adLeft}/${AD_DAILY_LIMIT}회`}
                    </Text>
                  </View>
                  {adLoading
                    ? <ActivityIndicator size="small" color={Colors.orangeDeep} />
                    : <Text style={styles.umAdBadge}>
                        {dailyDone ? '내일 만나요' : onCooldown ? '⏳' : `+${AD_REWARD}🍃`}
                      </Text>}
                </TouchableOpacity>
              );
            })()}
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

            {/* 몇 인분 */}
            <Text style={styles.dishServingsLabel}>👥 몇 인분</Text>
            <View style={styles.dishServingsChips}>
              {[1, 2, 3, 4].map(n => {
                const active = dishServings === n;
                return (
                  <TouchableOpacity
                    key={n}
                    style={[styles.dishServingsChip, active && styles.dishServingsChipActive]}
                    onPress={() => { haptic.light(); setDishServings(n); }}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.dishServingsChipText, active && styles.dishServingsChipTextActive]}>{n}인분</Text>
                  </TouchableOpacity>
                );
              })}
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
  usageChipText: { fontSize: 12, fontWeight: '700', color: Colors.inkSoft },
  usageChipCount: { fontSize: 13, fontWeight: '900', color: Colors.forest },
  usageChipArrow: { fontSize: 14, color: Colors.inkMute, fontWeight: '300', marginLeft: 2 },

  // 사용량 모달
  umBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  umCard: {
    width: '100%', maxWidth: 400,
    backgroundColor: Colors.white, borderRadius: 24,
    padding: 20, ...shadow.md,
  },
  umHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  umTitle: { fontSize: 16, fontWeight: '900', color: Colors.ink },
  umSub: { fontSize: 11, color: Colors.inkMute, fontWeight: '600', marginTop: 2 },
  umClose: { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.creamSoft, alignItems: 'center', justifyContent: 'center' },
  umCloseText: { fontSize: 13, fontWeight: '700', color: Colors.inkSoft },
  umDivider: { height: 1, backgroundColor: Colors.line, opacity: 0.5, marginVertical: 14 },

  leafBig: { alignItems: 'center', paddingVertical: 10 },
  leafBigVal: { fontSize: 44, fontWeight: '900', color: Colors.forest, lineHeight: 50 },
  leafBigUnitRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  leafBigUnit: { fontSize: 13, fontWeight: '700', color: Colors.inkSoft },
  leafBigBreakdown: { fontSize: 11, fontWeight: '600', color: Colors.inkMute, marginTop: 6 },

  costGrid: {
    flexDirection: 'row', gap: 8, marginTop: 14,
    paddingHorizontal: 4,
  },
  costItem: {
    flex: 1, alignItems: 'center',
    backgroundColor: Colors.creamSoft, borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 6,
  },
  costLabel: { fontSize: 11, fontWeight: '700', color: Colors.inkSoft, textAlign: 'center' },
  costValRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  costVal: { fontSize: 13, fontWeight: '900', color: Colors.forest },

  rechargeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.forest,
    borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16,
    marginBottom: 10,
    ...shadow.sm,
  },
  rechargeBtnText: { flex: 1, fontSize: 14, fontWeight: '800', color: '#FFF' },
  rechargeBtnArrow: { fontSize: 18, color: '#FFF', fontWeight: '300' },
  umAdBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.creamSoft, borderRadius: 16,
    padding: 14, borderWidth: 1, borderColor: Colors.line,
  },
  umAdBtnDisabled: { opacity: 0.6 },
  umAdEmoji: { fontSize: 24 },
  umAdTitle: { fontSize: 13, fontWeight: '800', color: Colors.ink },
  umAdSub: { fontSize: 11, color: Colors.inkSoft, marginTop: 2, fontWeight: '600' },
  umAdBadge: {
    fontSize: 10, fontWeight: '800', color: Colors.orangeDeep,
    backgroundColor: Colors.orangeSoft, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
  },

  bubbleOuter: { alignItems: 'center', marginTop: 18, marginBottom: 8 },
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
  quokka:   { width: width * 0.90, flex: 1, maxHeight: 380, minHeight: 180 },

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
  dishServingsLabel: { fontSize: 13, fontWeight: '800', color: Colors.ink, marginBottom: 8 },
  dishServingsChips: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  dishServingsChip: {
    flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 10,
    backgroundColor: Colors.creamSoft, borderWidth: 1.5, borderColor: Colors.line,
  },
  dishServingsChipActive: { backgroundColor: Colors.forestSoft, borderColor: Colors.forest },
  dishServingsChipText: { fontSize: 13, fontWeight: '700', color: Colors.inkSoft },
  dishServingsChipTextActive: { color: Colors.forestDeep, fontWeight: '800' },
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
