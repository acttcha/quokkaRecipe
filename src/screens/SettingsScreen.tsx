import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, ScrollView, Image, StatusBar, Modal, Linking,
  Animated, PanResponder,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle, Line, Rect } from 'react-native-svg';
import { NavProps } from '../types';
import { Colors, shadow } from '../constants/colors';
import { resetOnboarding } from '../services/preferences';

type InfoModal = 'guide' | 'update' | 'terms' | 'privacy' | null;

const MODAL_CONTENT: Record<NonNullable<InfoModal>, { title: string; body: string }> = {
  guide: {
    title: '이용 방법',
    body: `1️⃣  재료 스캔
냉장고나 장바구니의 재료를 카메라로 찍어요.

2️⃣  AI 레시피 생성
Claude AI가 재료를 인식하고 맞춤 레시피 3가지를 추천해요.

3️⃣  영양정보 확인
각 레시피의 칼로리, 단백질, 탄수화물, 지방을 확인할 수 있어요.

4️⃣  레시피 저장
마음에 드는 레시피는 ♥ 버튼으로 저장해두세요.

5️⃣  쿼카에게 질문
재료 대체, 칼로리 조절 등 궁금한 것을 쿼카에게 물어보세요.

6️⃣  없는 재료 구매
집에 없는 재료는 쿠팡에서 바로 주문할 수 있어요.`,
  },
  update: {
    title: '업데이트 노트',
    body: `🎉  v1.0.0 — 첫 출시

• AI 재료 인식 기능
• 맞춤 레시피 3종 추천
• 영양정보 (칼로리·단백질·탄수화물·지방)
• 레시피 저장 & 북마크
• 쿼카에게 질문하기
• 없는 재료 쿠팡 연동
• 유튜브 레시피 영상 검색
• 식이 선호도 설정 (알레르기·매운맛·식단 등)`,
  },
  terms: {
    title: '이용약관',
    body: `쿼카레시피 이용약관

본 서비스를 이용함으로써 아래 약관에 동의하는 것으로 간주합니다.

제1조 (목적)
본 약관은 쿼카레시피 앱 서비스의 이용 조건을 정함을 목적으로 합니다.

제2조 (서비스 이용)
· 본 서비스는 AI 기술을 활용한 레시피 추천 서비스입니다.
· 제공된 레시피는 참고용이며 정확성을 보장하지 않습니다.
· 서비스는 개인 비상업적 목적으로만 이용 가능합니다.

제3조 (면책)
AI가 생성한 레시피로 인한 건강 문제에 대해 책임을 지지 않습니다. 알레르기 등 건강 상태를 직접 확인하세요.

제4조 (약관 변경)
본 약관은 사전 공지 없이 변경될 수 있습니다.`,
  },
  privacy: {
    title: '개인정보처리방침',
    body: `개인정보처리방침

수집하는 정보
· 식이 선호도 (알레르기, 식단 유형 등)
· 저장된 레시피 데이터
· 스캔 횟수 (기기 내 저장)

저장 방법
모든 데이터는 기기 내 보안 저장소 및 로컬 파일에만 저장되며, 외부 서버로 전송되지 않습니다.

외부 서비스
· Anthropic Claude API: 재료 인식 및 레시피 생성
· YouTube Data API: 레시피 영상 검색
· 쿠팡 파트너스: 재료 구매 연결

문의
앱 내 의견보내기 기능을 이용해 주세요.`,
  },
};

// ── SVG 아이콘 ──────────────────────────────────────────
function IcBook() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M4 5.5c2.8-1 5.5-1 8 .8v13.5c-2.5-1.8-5.2-1.8-8-.8V5.5Z" stroke={Colors.inkSoft} strokeWidth={1.6} strokeLinejoin="round" />
      <Path d="M20 5.5c-2.8-1-5.5-1-8 .8v13.5c2.5-1.8 5.2-1.8 8-.8V5.5Z" stroke={Colors.inkSoft} strokeWidth={1.6} strokeLinejoin="round" />
    </Svg>
  );
}
function IcChat() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M4.5 5.5h15a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H10l-4 3.5V16.5H4.5A1.5 1.5 0 0 1 3 15V7a1.5 1.5 0 0 1 1.5-1.5Z" stroke={Colors.inkSoft} strokeWidth={1.6} strokeLinejoin="round" />
    </Svg>
  );
}
function IcNoads() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={8.5} stroke={Colors.inkSoft} strokeWidth={1.6} />
      <Path d="m6.5 6.5 11 11" stroke={Colors.inkSoft} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}
function IcSpark() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3v3.5M12 17.5V21M3 12h3.5M17.5 12H21M5.6 5.6l2.5 2.5M15.9 15.9l2.5 2.5M5.6 18.4l2.5-2.5M15.9 8.1l2.5-2.5" stroke={Colors.inkSoft} strokeWidth={1.6} strokeLinecap="round" />
      <Circle cx={12} cy={12} r={3} stroke={Colors.inkSoft} strokeWidth={1.6} />
    </Svg>
  );
}
function IcDoc() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M6 3.5h9l4 4V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" stroke={Colors.inkSoft} strokeWidth={1.6} strokeLinejoin="round" />
      <Path d="M15 3.5V8h4" stroke={Colors.inkSoft} strokeWidth={1.6} strokeLinejoin="round" />
      <Line x1={8} y1={13} x2={16} y2={13} stroke={Colors.inkSoft} strokeWidth={1.4} strokeLinecap="round" />
      <Line x1={8} y1={16.5} x2={14} y2={16.5} stroke={Colors.inkSoft} strokeWidth={1.4} strokeLinecap="round" />
    </Svg>
  );
}
function IcShield() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3 4 5.5v6c0 4.7 3.3 8 8 9.5 4.7-1.5 8-4.8 8-9.5v-6L12 3Z" stroke={Colors.inkSoft} strokeWidth={1.6} strokeLinejoin="round" />
    </Svg>
  );
}
function IcRefresh() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M20 7.5A8 8 0 0 0 5.5 9M4 16.5A8 8 0 0 0 18.5 15" stroke={Colors.orangeDeep} strokeWidth={1.6} strokeLinecap="round" />
      <Path d="M20 3v4.5h-4.5M4 21v-4.5h4.5" stroke={Colors.orangeDeep} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IcChevron() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Path d="m7 4 5 5-5 5" stroke={Colors.inkMute} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

interface Props extends NavProps {
  onResetPreferences?: () => void;
}

export default function SettingsScreen({ navigate, onResetPreferences }: Props) {
  const [openModal, setOpenModal] = useState<InfoModal>(null);

  const handleFeedback = () => {
    Linking.openURL('mailto:acttcha@gmail.com?subject=쿼카레시피 의견').catch(() =>
      Alert.alert('오류', '이메일 앱을 열 수 없어요.')
    );
  };

  const handleRemoveAds = () => {
    Alert.alert('배너 광고 제거', '광고 제거 기능은 곧 지원될 예정이에요! 조금만 기다려주세요 🐾', [
      { text: '확인' },
    ]);
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* Header */}
      <LinearGradient colors={['#F6E0B5', Colors.cream]} locations={[0, 0.7]} style={styles.header}>
        <View style={styles.headerSpacer} />
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>설정</Text>
          <Text style={styles.headerSub}>앱 환경과 내 정보를 관리해요</Text>
        </View>
        <View style={styles.headerHairline} />
      </LinearGradient>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>

        {/* 프로필 카드 */}
        <TouchableOpacity style={styles.profileCard} onPress={() => navigate({ name: 'Profile' })} activeOpacity={0.85}>
          <View style={styles.profileAvatar}>
            <Image source={require('../../assets/quokka.png')} style={styles.profileImg} resizeMode="contain" />
          </View>
          <View style={styles.profileTexts}>
            <Text style={styles.profileName}>요리 초보 쿼카</Text>
            <Text style={styles.profileSub}>내 정보 · 통계 · 선호도 확인</Text>
          </View>
          <IcChevron />
        </TouchableOpacity>

        {/* 선호도 리셋 */}
        <TouchableOpacity
          style={styles.resetCard}
          onPress={async () => { await resetOnboarding(); onResetPreferences?.(); }}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={[Colors.orangeSoft, '#FFE9D0']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.resetGradient}
          >
            <View style={styles.resetIconWrap}>
              <IcRefresh />
            </View>
            <View style={styles.resetTexts}>
              <Text style={styles.resetTitle}>선호도 다시 설정</Text>
              <Text style={styles.resetSub}>알레르기·매운맛·조리 시간을 새로 설정해요</Text>
            </View>
            <IcChevron />
          </LinearGradient>
        </TouchableOpacity>

        {/* 앱 안내 */}
        <Text style={styles.sectionLabel}>앱 안내</Text>
        <View style={styles.listCard}>
          <ListRow icon={<IcBook />}   label="이용 방법"     onPress={() => setOpenModal('guide')} />
          <ListRow icon={<IcChat />}   label="의견 보내기"   onPress={handleFeedback}               divider />
          <ListRow icon={<IcNoads />}  label="배너 광고 제거" onPress={handleRemoveAds}             divider meta="PRO" />
          <ListRow icon={<IcSpark />}  label="업데이트 노트" onPress={() => setOpenModal('update')} divider meta="NEW" />
        </View>

        {/* 법적 고지 */}
        <Text style={styles.sectionLabel}>법적 고지</Text>
        <View style={styles.listCard}>
          <ListRow icon={<IcDoc />}    label="이용약관"          onPress={() => setOpenModal('terms')}   />
          <ListRow icon={<IcShield />} label="개인정보처리방침"   onPress={() => setOpenModal('privacy')} divider />
          <View style={styles.versionRow}>
            <View style={styles.listIconWrap}><Text style={{ fontSize: 14 }}>ℹ️</Text></View>
            <Text style={styles.listLabel}>앱 버전</Text>
            <Text style={styles.versionValue}>1.0.0</Text>
          </View>
        </View>

      </ScrollView>

      {/* 정보 모달 */}
      <Modal visible={!!openModal} transparent animationType="none" onRequestClose={() => setOpenModal(null)}>
        <View style={styles.modalOverlay}>
          {openModal && (
            <DraggableSheet
              key={openModal}
              onClose={() => setOpenModal(null)}
              title={MODAL_CONTENT[openModal].title}
              body={MODAL_CONTENT[openModal].body}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

function DraggableSheet({ onClose, title, body }: {
  onClose: () => void; title: string; body: string;
}) {
  const translateY     = useRef(new Animated.Value(600)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  // 열릴 때 시트 + 오버레이 동시 진입
  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY,     { toValue: 0,    useNativeDriver: true, tension: 80, friction: 18 }),
      Animated.timing(overlayOpacity, { toValue: 0.45, useNativeDriver: true, duration: 280 }),
    ]).start();
  }, []);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(translateY,     { toValue: 800, useNativeDriver: true, duration: 220 }),
      Animated.timing(overlayOpacity, { toValue: 0,   useNativeDriver: true, duration: 220 }),
    ]).start(onClose);
  };

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gs) => gs.dy > 5,
    onPanResponderMove: (_, gs) => {
      if (gs.dy > 0) {
        translateY.setValue(gs.dy);
        // 드래그 거리에 비례해 오버레이도 함께 흐려짐
        overlayOpacity.setValue(Math.max(0, 0.45 * (1 - gs.dy / 350)));
      }
    },
    onPanResponderRelease: (_, gs) => {
      if (gs.dy > 120 || gs.vy > 0.8) {
        dismiss();
      } else {
        Animated.parallel([
          Animated.spring(translateY,     { toValue: 0,    useNativeDriver: true, tension: 120, friction: 20 }),
          Animated.timing(overlayOpacity, { toValue: 0.45, useNativeDriver: true, duration: 150 }),
        ]).start();
      }
    },
  })).current;

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* 오버레이 — 시트와 opacity 동기화 */}
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'black', opacity: overlayOpacity }]} />

      <View style={styles.modalOverlay}>
        <Animated.View style={[styles.modalSheet, { transform: [{ translateY }] }]}>
          {/* 드래그 핸들 영역만 pan 적용 — 스크롤과 충돌 방지 */}
          <View style={styles.modalDragZone} {...pan.panHandlers}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{title}</Text>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
            <Text style={styles.modalBody}>{body}</Text>
          </ScrollView>
          <TouchableOpacity style={styles.modalCloseBtn} onPress={dismiss}>
            <Text style={styles.modalCloseBtnText}>닫기</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

function ListRow({
  icon, label, onPress, divider, meta,
}: {
  icon: React.ReactNode; label: string; onPress: () => void;
  divider?: boolean; meta?: string;
}) {
  return (
    <>
      {divider && <View style={listStyles.divider} />}
      <TouchableOpacity style={listStyles.row} onPress={onPress} activeOpacity={0.7}>
        <View style={listStyles.iconWrap}>{icon}</View>
        <Text style={listStyles.label}>{label}</Text>
        {meta && (
          <View style={[listStyles.metaBadge, meta === 'PRO' && listStyles.metaBadgePro]}>
            <Text style={[listStyles.metaText, meta === 'PRO' && listStyles.metaTextPro]}>{meta}</Text>
          </View>
        )}
        <IcChevron />
      </TouchableOpacity>
    </>
  );
}

const listStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  divider: { height: 1, backgroundColor: Colors.creamSoft, marginHorizontal: 0 },
  iconWrap: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: Colors.creamSoft,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  label: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.ink },
  metaBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
    backgroundColor: Colors.orangeSoft,
  },
  metaBadgePro: { backgroundColor: Colors.ink },
  metaText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, color: Colors.orangeDeep },
  metaTextPro: { color: Colors.cream },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.cream },

  header: { height: 170 },
  headerSpacer: { flex: 1 },
  headerContent: { paddingHorizontal: 22, paddingBottom: 14 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: Colors.ink, letterSpacing: -0.6 },
  headerSub: { fontSize: 13, color: Colors.inkSoft, fontWeight: '500', marginTop: 4 },
  headerHairline: { height: 1, backgroundColor: Colors.line, opacity: 0.5 },

  body: { flex: 1 },
  bodyContent: { padding: 22, paddingBottom: 120, gap: 12 },

  profileCard: {
    backgroundColor: Colors.white, borderRadius: 22,
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 16,
    borderWidth: 1, borderColor: Colors.lineSoft, ...shadow.sm,
  },
  profileAvatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.creamDark,
    borderWidth: 2, borderColor: Colors.line,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    overflow: 'hidden',
  },
  profileImg: { width: 52, height: 52 },
  profileTexts: { flex: 1, minWidth: 0 },
  profileName: { fontSize: 15, fontWeight: '800', color: Colors.ink, letterSpacing: -0.3 },
  profileSub: { fontSize: 12, color: Colors.inkSoft, marginTop: 3 },

  resetCard: { borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: '#F2994A40', ...shadow.sm },
  resetGradient: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  resetIconWrap: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: Colors.white,
    borderWidth: 1, borderColor: '#F2994A40',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  resetTexts: { flex: 1, minWidth: 0 },
  resetTitle: { fontSize: 14, fontWeight: '800', color: Colors.ink },
  resetSub: { fontSize: 11, color: Colors.inkSoft, marginTop: 2 },

  sectionLabel: {
    fontSize: 12, fontWeight: '700', color: Colors.inkSoft,
    letterSpacing: 0.4, textTransform: 'uppercase', paddingLeft: 4,
  },
  listCard: {
    backgroundColor: Colors.white, borderRadius: 22,
    borderWidth: 1, borderColor: Colors.lineSoft, ...shadow.sm,
    overflow: 'hidden',
  },
  listIconWrap: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: Colors.creamSoft,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  listLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.ink },
  versionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderTopWidth: 1, borderTopColor: Colors.creamSoft,
  },
  versionValue: { fontSize: 13, fontWeight: '700', color: Colors.inkSoft },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet: {
    backgroundColor: Colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 24, paddingTop: 12, paddingBottom: 36, maxHeight: '80%',
  },
  modalDragZone: { alignItems: 'center', paddingBottom: 14 },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.line, marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '900', color: Colors.ink, marginBottom: 14, alignSelf: 'flex-start' },
  modalScroll: { marginBottom: 16 },
  modalBody: { fontSize: 14, color: Colors.ink, lineHeight: 24 },
  modalCloseBtn: {
    backgroundColor: Colors.forest, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center',
  },
  modalCloseBtnText: { color: '#FFF', fontWeight: '800', fontSize: 15 },
});
