import React, { useState, useRef, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions,
  Animated, PanResponder, BackHandler, Alert, Platform,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets, initialWindowMetrics } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Rect, Line, Circle } from 'react-native-svg';
import { Asset } from 'expo-asset';
import { CurrentScreen } from './src/types';
import { isOnboardingDone } from './src/services/preferences';
import { isFridgeSetupDone } from './src/services/fridge';
import { loadDevSettings } from './src/services/devSettings';
import { loadSubscription } from './src/services/subscription';
import { loadLeaves } from './src/services/leaves';
import { loadLocale, useLang } from './src/services/locale';
import { t } from './src/i18n';
import { initAds } from './src/services/ads';
import { initPurchases } from './src/services/purchases';
import { loadAuth, syncRcIdentity } from './src/services/auth';
import { getNickname } from './src/services/stats';
import { LeafToast } from './src/components/LeafToast';

// AdMob SDK 초기화 — Expo Go 에선 no-op, 빌드된 앱에서만 실제 초기화
initAds().catch(() => { /* 무시 — 광고 실패가 앱을 막진 않음 */ });
import OnboardingScreen from './src/screens/OnboardingScreen';
import FridgeSetupScreen from './src/screens/FridgeSetupScreen';
import HomeScreen from './src/screens/HomeScreen';
import CameraScreen from './src/screens/CameraScreen';
import RecipeScreen from './src/screens/RecipeScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import ManualRecipeScreen from './src/screens/ManualRecipeScreen';
import SavedScreen from './src/screens/SavedScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import FridgeScreen from './src/screens/FridgeScreen';
import FridgeScanScreen from './src/screens/FridgeScanScreen';
import ReceiptScanScreen from './src/screens/ReceiptScanScreen';
import SavedRecipeDetailScreen from './src/screens/SavedRecipeDetailScreen';
import YoutubeRecipeScreen from './src/screens/YoutubeRecipeScreen';
import LeafShopScreen from './src/screens/LeafShopScreen';
import CookModeScreen from './src/screens/CookModeScreen';
import CookingLogScreen from './src/screens/CookingLogScreen';
import ShoppingListScreen from './src/screens/ShoppingListScreen';

const { width } = Dimensions.get('window');

const TAB_SCREENS = ['Home', 'Fridge', 'Saved', 'Settings'] as const;
type TabScreenName = typeof TAB_SCREENS[number];
const TAB_LABEL_KEY: Record<TabScreenName, string> = {
  Home: 'nav.tabHome', Fridge: 'nav.tabFridge', Saved: 'nav.tabSaved', Settings: 'nav.tabSettings',
};

const C = {
  cream:     '#FBEFD8',
  creamLine: '#EAD5AC',
  orange:    '#F2994A',
  orangeDeep:'#E07B2B',
  iconOff:   '#B79572',
  textOff:   '#8B7558',
};

// ─── 탭 아이콘 ─────────────────────────────────────────────
function IconHome({ active }: { active: boolean }) {
  const c = active ? C.orange : C.iconOff;
  return (
    <Svg width={26} height={26} viewBox="0 0 26 26">
      <Path d="M4 12.2 13 4.5l9 7.7v9a1.5 1.5 0 0 1-1.5 1.5h-4V16h-7v6.7h-4A1.5 1.5 0 0 1 4 21.2v-9Z"
        fill={active ? C.orange : 'none'} stroke={active ? '#C8631F' : c} strokeWidth={1.5} strokeLinejoin="round" />
      {active && <Path d="M11 16h4v6.7h-4z" fill="#FFE2C2" stroke="#C8631F" strokeWidth={1.3} />}
    </Svg>
  );
}
function IconFridge({ active }: { active: boolean }) {
  const c = active ? C.orange : C.iconOff;
  return (
    <Svg width={26} height={26} viewBox="0 0 26 26">
      <Rect x={6.5} y={3.5} width={13} height={19} rx={2.5} stroke={c} strokeWidth={1.6} fill={active ? '#FDE2C5' : 'none'} />
      <Line x1={6.5} y1={11} x2={19.5} y2={11} stroke={c} strokeWidth={1.6} />
      <Line x1={9} y1={7} x2={9} y2={9} stroke={c} strokeWidth={1.6} strokeLinecap="round" />
      <Line x1={9} y1={14} x2={9} y2={16} stroke={c} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}
function IconRecipe({ active }: { active: boolean }) {
  const c = active ? C.orange : C.iconOff;
  return (
    <Svg width={26} height={26} viewBox="0 0 26 26">
      <Path d="M3.5 6.5c2.7-1 5.7-1 8 .8v13c-2.3-1.8-5.3-1.8-8-.8v-13Z"
        stroke={c} strokeWidth={1.6} fill={active ? '#FDE2C5' : 'none'} strokeLinejoin="round" />
      <Path d="M22.5 6.5c-2.7-1-5.7-1-8 .8v13c2.3-1.8 5.3-1.8 8-.8v-13Z"
        stroke={c} strokeWidth={1.6} fill={active ? '#FDE2C5' : 'none'} strokeLinejoin="round" />
      <Path d="M11.5 7.3v13" stroke={c} strokeWidth={1.6} strokeLinecap="round" />
      <Line x1={6} y1={10} x2={9.5} y2={10} stroke={c} strokeWidth={1.3} strokeLinecap="round" />
      <Line x1={6} y1={13} x2={9.5} y2={13} stroke={c} strokeWidth={1.3} strokeLinecap="round" />
      <Line x1={16.5} y1={10} x2={20} y2={10} stroke={c} strokeWidth={1.3} strokeLinecap="round" />
      <Line x1={16.5} y1={13} x2={20} y2={13} stroke={c} strokeWidth={1.3} strokeLinecap="round" />
    </Svg>
  );
}
function IconMy({ active }: { active: boolean }) {
  const c = active ? C.orange : C.iconOff;
  return (
    <Svg width={26} height={26} viewBox="0 0 26 26">
      <Circle cx={13} cy={9.5} r={4} stroke={c} strokeWidth={1.6} fill={active ? '#FDE2C5' : 'none'} />
      <Path d="M5 22c.8-4.3 4-6.5 8-6.5s7.2 2.2 8 6.5" stroke={c} strokeWidth={1.6} strokeLinecap="round" fill="none" />
    </Svg>
  );
}
function IconPaw() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Circle cx={7}    cy={9}    r={2}   fill={C.orangeDeep} />
      <Circle cx={12}   cy={6.5}  r={2}   fill={C.orangeDeep} />
      <Circle cx={17}   cy={9}    r={2}   fill={C.orangeDeep} />
      <Circle cx={19.5} cy={14}   r={1.6} fill={C.orangeDeep} />
      <Path d="M12 11c-3 0-5.5 2.4-5.5 4.8 0 1.8 1.4 2.7 3 2.7 1 0 1.7-.4 2.5-.4s1.5.4 2.5.4c1.6 0 3-.9 3-2.7C17.5 13.4 15 11 12 11Z"
        fill={C.orangeDeep} />
    </Svg>
  );
}

const TAB_ICON_MAP: Record<TabScreenName, React.ComponentType<{ active: boolean }>> = {
  Home: IconHome, Fridge: IconFridge, Saved: IconRecipe, Settings: IconMy,
};

// ─── App ───────────────────────────────────────────────────
type AppState = 'loading' | 'onboarding' | 'fridge_setup' | 'app';

export default function App() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <AppInner />
      <LeafToast />
    </SafeAreaProvider>
  );
}

function AppInner() {
  useLang();  // 언어 변경 시 전체 리렌더 (i18n 즉시 반영)
  const insets = useSafeAreaInsets();
  const [appState, setAppState]       = useState<AppState>('loading');
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [tabIndex, setTabIndex]       = useState(0);
  const [subScreen, setSubScreen] = useState<CurrentScreen | null>(null);

  const slideAnim       = useRef(new Animated.Value(0)).current;
  const tabIndexRef     = useRef(0);
  const subScreenRef    = useRef<CurrentScreen | null>(null);
  const swipeBlockedRef = useRef(false);

  useEffect(() => {
    // 로그인 세션을 먼저 복원해야 loadLeaves 가 올바른 신원(계정/게스트)으로 잔액을 읽는다.
    loadAuth().finally(() => {
      Promise.all([
        isOnboardingDone(),
        isFridgeSetupDone(),
        loadDevSettings(),
        loadSubscription(),
        loadLeaves(),
        loadLocale(),
        getNickname(),   // 동기 캐시 워밍 — 마이/프로필 닉네임 플래시 방지
        Asset.loadAsync([
          require('./assets/background.png'),
          require('./assets/main_logo.png'),
          require('./assets/quokka.png'),
          require('./assets/refrigerator1.png'),
          require('./assets/refrigerator2.png'),
          require('./assets/refrigerator3.png'),
          require('./assets/refrigerator4.png'),
        ]),
      ]).then(([onboarded, fridgeDone]) => {
        console.log('[App] onboarded:', onboarded, 'fridgeDone:', fridgeDone);
        // 결제 초기화 후 RC 신원을 현재 신원(계정/기기)으로 맞춤
        initPurchases().then(syncRcIdentity).catch(() => { /* 키 미설정/Expo Go 면 무시 */ });
        setOnboardingDone(onboarded);
        if (!fridgeDone) setAppState('fridge_setup');
        else if (!onboarded) setAppState('onboarding');
        else setAppState('app');
      });
    });
  }, []);

  const springTo = (index: number) =>
    Animated.spring(slideAnim, { toValue: -index * width, useNativeDriver: true, tension: 120, friction: 20 }).start();

  const goToTab = (index: number) => {
    tabIndexRef.current = index;
    subScreenRef.current = null;
    setTabIndex(index);
    setSubScreen(null);
    springTo(index);
  };

  const navigate = (screen: CurrentScreen) => {
    const tabIdx = TAB_SCREENS.indexOf(screen.name as TabScreenName);
    if (tabIdx >= 0) { goToTab(tabIdx); }
    else { subScreenRef.current = screen; setSubScreen(screen); }
  };

  const goBack = () => { subScreenRef.current = null; setSubScreen(null); };

  // ── Android 하드웨어 뒤로가기 처리 ─────────────────────────
  // 1) 서브 화면 열려있으면 → 닫기
  // 2) 홈 탭 외 다른 탭이면 → 홈 탭으로 이동
  // 3) 홈 탭이면 → 종료 확인 Alert
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    if (appState !== 'app') return;

    const onBackPress = () => {
      if (subScreenRef.current) {
        goBack();
        return true;
      }
      if (tabIndexRef.current !== 0) {
        goToTab(0);
        return true;
      }
      Alert.alert(
        t('nav.exitTitle'),
        '',
        [
          { text: t('nav.exitCancel'), style: 'cancel' },
          { text: t('nav.exitConfirm'), style: 'destructive', onPress: () => BackHandler.exitApp() },
        ],
      );
      return true;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [appState]);

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gs) =>
      !subScreenRef.current &&
      !swipeBlockedRef.current &&
      Math.abs(gs.dx) > 12 &&
      Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5,
    onPanResponderRelease: (_, gs) => {
      const cur = tabIndexRef.current;
      if (gs.dx < -50 && cur < TAB_SCREENS.length - 1) {
        const next = cur + 1; tabIndexRef.current = next; setTabIndex(next); springTo(next);
      } else if (gs.dx > 50 && cur > 0) {
        const prev = cur - 1; tabIndexRef.current = prev; setTabIndex(prev); springTo(prev);
      }
    },
  })).current;

  if (appState === 'loading') return null;
  if (appState === 'fridge_setup') return <FridgeSetupScreen onDone={() => setAppState(onboardingDone ? 'app' : 'onboarding')} />;
  if (appState === 'onboarding') return <OnboardingScreen onDone={() => setAppState('app')} />;

  if (subScreen) {
    if (subScreen.name === 'Camera')
      return <CameraScreen navigate={navigate} goBack={goBack} fridgeMode={subScreen.fridgeMode} receiptMode={subScreen.receiptMode} />;
    if (subScreen.name === 'FridgeScan')
      return <FridgeScanScreen navigate={navigate} goBack={goBack} imageBase64={subScreen.imageBase64} mimeType={subScreen.mimeType} />;
    if (subScreen.name === 'ReceiptScan')
      return <ReceiptScanScreen navigate={navigate} goBack={goBack} imageBase64={subScreen.imageBase64} mimeType={subScreen.mimeType} />;
    if (subScreen.name === 'Recipes')
      return <RecipeScreen navigate={navigate} goBack={goBack} imageBase64={subScreen.imageBase64} mimeType={subScreen.mimeType} />;
    if (subScreen.name === 'FridgeRecipes')
      return <RecipeScreen navigate={navigate} goBack={goBack} prefillIngredients={subScreen.ingredients} />;
    if (subScreen.name === 'DishRecipe')
      return <RecipeScreen navigate={navigate} goBack={goBack} dishName={subScreen.dishName} servings={subScreen.servings} />;
    if (subScreen.name === 'Profile')
      return <ProfileScreen navigate={navigate} goBack={goBack} onResetPreferences={() => setAppState('onboarding')} />;
    if (subScreen.name === 'SavedRecipeDetail')
      return <SavedRecipeDetailScreen navigate={navigate} goBack={goBack} recipe={subScreen.recipe} />;
    if (subScreen.name === 'YoutubeRecipe')
      return <YoutubeRecipeScreen navigate={navigate} goBack={goBack} recipeName={subScreen.recipeName} directVideo={subScreen.directVideo} />;
    if (subScreen.name === 'LeafShop')
      return <LeafShopScreen navigate={navigate} goBack={goBack} />;
    if (subScreen.name === 'CookMode')
      return <CookModeScreen navigate={navigate} goBack={goBack} recipeName={subScreen.recipeName} steps={subScreen.steps} />;
    if (subScreen.name === 'CookingLog')
      return <CookingLogScreen navigate={navigate} goBack={goBack} />;
    if (subScreen.name === 'ShoppingList')
      return <ShoppingListScreen navigate={navigate} goBack={goBack} />;
    if (subScreen.name === 'ManualRecipe')
      return <ManualRecipeScreen navigate={navigate} goBack={goBack} />;
  }

  return (
    <View style={styles.root} {...panResponder.panHandlers}>
      <StatusBar style="dark" />

      <Animated.View style={[styles.tabContainer, { transform: [{ translateX: slideAnim }] }]}>
        <View style={styles.screen}><HomeScreen navigate={navigate} goBack={goBack} /></View>
        <View style={styles.screen}><FridgeScreen navigate={navigate} goBack={goBack} /></View>
        <View style={styles.screen}>
          <SavedScreen
            navigate={navigate}
            goBack={goBack}
            onFolderBarScroll={(scrolling) => { swipeBlockedRef.current = scrolling; }}
          />
        </View>
        <View style={styles.screen}>
          <SettingsScreen
            navigate={navigate}
            goBack={goBack}
            onResetPreferences={() => setAppState('onboarding')}
            onResetAllData={() => setAppState('fridge_setup')}
          />
        </View>
      </Animated.View>

      {/* ── 탭바 영역 ── */}
      <View style={styles.tabbarArea}>
        {/* 위쪽 그라디언트 페이드 */}
        <LinearGradient
          colors={['rgba(251,239,216,0)', C.cream]}
          style={styles.tabbarGradient}
          pointerEvents="none"
        />

        <View style={[styles.tabbarWrap, { paddingBottom: 14 + Math.max(insets.bottom, 12) }]}>
          {/* 발바닥 노치 */}
          <View style={styles.pawNotchWrap} pointerEvents="none">
            <View style={styles.pawNotch}>
              <IconPaw />
            </View>
          </View>

          {/* 탭 pill */}
          <View style={styles.tabbar}>
            {TAB_SCREENS.map((name, i) => {
              const active = tabIndex === i;
              const Icon = TAB_ICON_MAP[name];
              return (
                <TouchableOpacity key={name} style={styles.tabItem} onPress={() => goToTab(i)} activeOpacity={0.75}>
                  <View style={styles.tabIconWrap}>
                    <Icon active={active} />
                  </View>
                  <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                    {t(TAB_LABEL_KEY[name])}
                  </Text>
                  <View style={[styles.tabDot, active && styles.tabDotActive]} />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:         { flex: 1, backgroundColor: C.cream },
  tabContainer: { flex: 1, flexDirection: 'row', width: width * 4 },
  screen:       { width, flex: 1 },

  // 탭바 전체 영역
  tabbarArea: { backgroundColor: C.cream },

  // 콘텐츠 위쪽 그라디언트 페이드
  tabbarGradient: { position: 'absolute', left: 0, right: 0, top: -28, height: 28 },

  // 패딩 컨테이너 (노치 overflow 허용)
  // paddingBottom 은 insets.bottom 으로 동적 설정 (App 본체 인라인 스타일 참고)
  tabbarWrap: { paddingHorizontal: 14, paddingTop: 14 },

  // 발바닥 노치
  pawNotchWrap: {
    position: 'absolute', top: -4, left: 0, right: 0,
    alignItems: 'center', zIndex: 10,
  },
  pawNotch: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: C.cream,
    borderWidth: 1.5, borderColor: C.creamLine,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#BE8232', shadowOpacity: 0.15, shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },

  // 탭 pill
  tabbar: {
    flexDirection: 'row',
    backgroundColor: C.cream,
    borderWidth: 1.5, borderColor: C.creamLine,
    borderRadius: 28,
    paddingVertical: 8, paddingHorizontal: 6,
    shadowColor: '#BE8232', shadowOpacity: 0.18, shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },

  // 개별 탭
  tabItem:     { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 4 },
  tabIconWrap: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  tabLabel:    { fontSize: 11, fontWeight: '600', color: C.textOff },
  tabLabelActive: { color: C.orangeDeep, fontWeight: '700' },
  tabDot:      { width: 4, height: 4, borderRadius: 2, backgroundColor: 'transparent', marginTop: 1 },
  tabDotActive:{ backgroundColor: C.orange },
});
