import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, ScrollView, Image, StatusBar, Modal, Linking,
  Animated, PanResponder, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle, Line, Rect } from 'react-native-svg';
import { NavProps } from '../types';
import { Colors, shadow } from '../constants/colors';
import { resetOnboarding } from '../services/preferences';
import { resetAllData } from '../services/reset';
import { resetDailyUsage } from '../services/usage';
import {
  getMockMode, setMockMode,
  getModelKey, setModelKey,
  ModelKey,
} from '../services/devSettings';

const APP_VERSION = (require('../../app.json') as { expo: { version: string } }).expo.version;

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
    body: `최종 업데이트: 2026.05.24

[수집하는 정보]
· 식재료 사진, 영수증 사진 (사용 시)
· 직접 입력한 재료 이름
· 식이 선호도 (알레르기, 매운맛 정도, 조리 시간, 식단 유형 등)
· 저장한 레시피, 폴더, 메모, Q&A 기록
· 냉장고 재료 목록
· 앱 사용 통계 (스캔 횟수)

[저장 위치]
위 정보는 사용자 기기 내 보안 저장소(iOS Keychain, Android KeyStore)에만 저장되며, 본 앱 개발자의 서버로 전송·저장되지 않습니다.

[외부 서비스로 전송되는 정보]
일부 기능 제공을 위해 다음 정보가 외부 서비스로 전송됩니다.

· Anthropic Claude API (미국)
  전송 정보: 식재료/영수증 이미지, 입력 텍스트, 식이 선호도, 레시피 정보, 질문 내용
  목적: 재료 인식, 레시피 생성, Q&A 응답, 유튜브 자막 분석

· Google YouTube Data API (미국)
  전송 정보: 재료명 기반 검색어
  목적: 레시피 영상 검색

· 쿠팡 파트너스 (한국)
  전송 정보: 재료명 (구매 링크 클릭 시에만)
  목적: 구매 페이지 연결

[권한]
· 카메라: 식재료/영수증 촬영 (선택)
· 사진 라이브러리: 갤러리에서 사진 선택 (선택)
권한은 기기 설정에서 언제든 변경할 수 있습니다.

[사용자 권리]
앱 내 메뉴에서 저장된 정보를 직접 확인·수정·삭제할 수 있습니다. 앱을 삭제하면 모든 로컬 저장 데이터가 함께 삭제됩니다.

[만 14세 미만 아동]
본 앱은 만 14세 미만 아동의 개인정보를 의도적으로 수집하지 않습니다.

[연락처]
앱 내 "의견 보내기" 기능을 이용해 주세요.

전체 내용 및 최신 버전은 아래 "웹에서 전체 보기" 링크에서 확인할 수 있습니다.`,
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
  onResetAllData?: () => void;
}

const DELETE_CONFIRM_PHRASE = '모든 데이터 삭제';

export default function SettingsScreen({ navigate, onResetPreferences, onResetAllData }: Props) {
  const [openModal, setOpenModal] = useState<InfoModal>(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [mockMode, setMockModeState] = useState(getMockMode());
  const [modelKey, setModelKeyState] = useState<ModelKey>(getModelKey());
  const canDelete = deleteInput.trim() === DELETE_CONFIRM_PHRASE && !deleting;

  const handleToggleMock = async () => {
    const next = !mockMode;
    setMockModeState(next);
    await setMockMode(next);
  };

  const handlePickModel = async (k: ModelKey) => {
    if (k === modelKey) return;
    setModelKeyState(k);
    await setModelKey(k);
  };

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

  const handleResetUsage = async () => {
    await resetDailyUsage();
    Alert.alert('초기화 완료', '오늘 사용량이 0으로 리셋됐어요.');
  };

  const handleResetAllData = () => {
    setDeleteInput('');
    setDeleteModalVisible(true);
  };

  const closeDeleteModal = () => {
    if (deleting) return;
    setDeleteModalVisible(false);
    setDeleteInput('');
  };

  const confirmDelete = async () => {
    if (!canDelete) return;
    setDeleting(true);
    try {
      await resetAllData();
      setDeleteModalVisible(false);
      setDeleteInput('');
      onResetAllData?.();
    } catch {
      Alert.alert('오류', '데이터 삭제 중 문제가 생겼어요. 다시 시도해주세요.');
    } finally {
      setDeleting(false);
    }
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
            <Text style={styles.versionValue}>{APP_VERSION}</Text>
          </View>
        </View>

        {/* 테스트용 (출시 전 제거) */}
        <Text style={styles.sectionLabel}>🧪 테스트용</Text>
        <TouchableOpacity
          style={styles.testCard}
          onPress={handleResetUsage}
          activeOpacity={0.85}
        >
          <Text style={styles.testIcon}>♻️</Text>
          <View style={styles.testTexts}>
            <Text style={styles.testTitle}>오늘 사용량 초기화</Text>
            <Text style={styles.testSub}>일일 카운트를 0으로 (보너스는 유지)</Text>
          </View>
          <IcChevron />
        </TouchableOpacity>

        {/* 임시 모드 — API 호출 없이 목 데이터로 화면 이동만 */}
        <TouchableOpacity
          style={styles.testCard}
          onPress={handleToggleMock}
          activeOpacity={0.85}
        >
          <Text style={styles.testIcon}>{mockMode ? '🟢' : '⚪'}</Text>
          <View style={styles.testTexts}>
            <Text style={styles.testTitle}>임시 모드 (API 호출 X)</Text>
            <Text style={styles.testSub}>
              {mockMode
                ? 'ON — 목 데이터로 화면 이동만 (Claude/YouTube 호출 안 함)'
                : 'OFF — 실제 API 호출'}
            </Text>
          </View>
          <View style={[styles.mockSwitch, mockMode && styles.mockSwitchOn]}>
            <Text style={[styles.mockSwitchText, mockMode && styles.mockSwitchTextOn]}>
              {mockMode ? 'ON' : 'OFF'}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Claude 모델 변경 */}
        <View style={styles.testCard}>
          <Text style={styles.testIcon}>🤖</Text>
          <View style={styles.testTexts}>
            <Text style={styles.testTitle}>Claude API 모델 변경</Text>
            <Text style={styles.testSub}>
              현재: {modelKey} · 모든 호출에 적용됨
            </Text>
            <View style={styles.modelRow}>
              {(['haiku', 'sonnet', 'opus'] as ModelKey[]).map(k => {
                const active = k === modelKey;
                return (
                  <TouchableOpacity
                    key={k}
                    style={[styles.modelChip, active && styles.modelChipActive]}
                    onPress={() => handlePickModel(k)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.modelChipText, active && styles.modelChipTextActive]}>
                      {k}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* 데이터 관리 */}
        <Text style={styles.sectionLabel}>데이터 관리</Text>
        <TouchableOpacity
          style={styles.dangerCard}
          onPress={handleResetAllData}
          activeOpacity={0.85}
        >
          <View style={styles.dangerIconWrap}>
            <Text style={styles.dangerIcon}>🗑️</Text>
          </View>
          <View style={styles.dangerTexts}>
            <Text style={styles.dangerTitle}>모든 데이터 삭제</Text>
            <Text style={styles.dangerSub}>냉장고·레시피·메모·선호도 모두 영구 삭제</Text>
          </View>
          <IcChevron />
        </TouchableOpacity>

      </ScrollView>

      {/* 데이터 삭제 확인 모달 */}
      <Modal visible={deleteModalVisible} transparent animationType="fade" onRequestClose={closeDeleteModal}>
        <KeyboardAvoidingView
          style={styles.deleteModalWrap}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.deleteModalBackdrop} />
          <View style={styles.deleteModalCard}>
            <Text style={styles.deleteModalIcon}>⚠️</Text>
            <Text style={styles.deleteModalTitle}>모든 데이터를 삭제할까요?</Text>
            <Text style={styles.deleteModalBody}>
              냉장고, 저장된 레시피, 폴더, 메모, 선호도 등{'\n'}
              모든 데이터가 <Text style={styles.deleteModalBodyStrong}>영구 삭제</Text>되며{'\n'}
              되돌릴 수 없어요.
            </Text>
            <View style={styles.deleteModalHintBox}>
              <Text style={styles.deleteModalHintLabel}>계속하려면 아래 문구를 정확히 입력해주세요</Text>
              <Text style={styles.deleteModalKeyword}>{DELETE_CONFIRM_PHRASE}</Text>
            </View>
            <TextInput
              style={[styles.deleteModalInput, canDelete && styles.deleteModalInputMatch]}
              value={deleteInput}
              onChangeText={setDeleteInput}
              placeholder={DELETE_CONFIRM_PHRASE}
              placeholderTextColor={Colors.inkMute}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!deleting}
            />
            <View style={styles.deleteModalActions}>
              <TouchableOpacity
                style={styles.deleteCancelBtn}
                onPress={closeDeleteModal}
                disabled={deleting}
              >
                <Text style={styles.deleteCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteConfirmBtn, !canDelete && styles.deleteConfirmBtnDisabled]}
                onPress={confirmDelete}
                disabled={!canDelete}
                activeOpacity={0.85}
              >
                <Text style={[styles.deleteConfirmText, !canDelete && styles.deleteConfirmTextDisabled]}>
                  {deleting ? '삭제 중...' : '삭제'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 정보 모달 */}
      <Modal visible={!!openModal} transparent animationType="none" onRequestClose={() => setOpenModal(null)}>
        <View style={styles.modalOverlay}>
          {openModal && (
            <DraggableSheet
              key={openModal}
              onClose={() => setOpenModal(null)}
              title={MODAL_CONTENT[openModal].title}
              body={MODAL_CONTENT[openModal].body}
              footerLink={openModal === 'privacy' ? {
                label: '웹에서 전체 보기',
                url: 'https://nettle-satellite-63f.notion.site/36a8ac0e8b1c80bb85ded0cab2cdeca1',
              } : undefined}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

function DraggableSheet({ onClose, title, body, footerLink }: {
  onClose: () => void;
  title: string;
  body: string;
  footerLink?: { label: string; url: string };
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
            {footerLink && (
              <TouchableOpacity
                onPress={() => Linking.openURL(footerLink.url)}
                style={styles.modalFooterLinkRow}
              >
                <Text style={styles.modalFooterLinkText}>{footerLink.label} →</Text>
              </TouchableOpacity>
            )}
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

  dangerCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
    backgroundColor: '#FEF2F2', borderRadius: 22,
    borderWidth: 1, borderColor: '#FCA5A5',
    ...shadow.sm,
  },
  dangerIconWrap: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: Colors.white,
    borderWidth: 1, borderColor: '#FCA5A5',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  dangerIcon: { fontSize: 18 },
  dangerTexts: { flex: 1 },
  dangerTitle: { fontSize: 14, fontWeight: '800', color: '#B91C1C' },
  dangerSub: { fontSize: 12, color: '#991B1B', marginTop: 2 },

  // 테스트용 (출시 전 제거)
  testCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
    backgroundColor: '#FFFBEB', borderRadius: 18,
    borderWidth: 1, borderColor: '#FCD34D',
    borderStyle: 'dashed',
  },
  testIcon: { fontSize: 22, width: 38, textAlign: 'center' },
  testTexts: { flex: 1 },
  testTitle: { fontSize: 14, fontWeight: '800', color: '#92400E' },
  testSub: { fontSize: 12, color: '#A16207', marginTop: 2 },

  mockSwitch: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1.5, borderColor: '#FCD34D',
    backgroundColor: Colors.white,
  },
  mockSwitchOn: { backgroundColor: '#16A34A', borderColor: '#15803D' },
  mockSwitchText: { fontSize: 11, fontWeight: '900', color: '#92400E', letterSpacing: 0.5 },
  mockSwitchTextOn: { color: '#FFF' },

  modelRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  modelChip: {
    flex: 1, paddingVertical: 7, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#FCD34D',
    backgroundColor: Colors.white, alignItems: 'center',
  },
  modelChipActive: { backgroundColor: '#92400E', borderColor: '#92400E' },
  modelChipText: { fontSize: 12, fontWeight: '800', color: '#92400E' },
  modelChipTextActive: { color: '#FEF3C7' },

  // 데이터 삭제 확인 모달
  deleteModalWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  deleteModalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  deleteModalCard: {
    width: '100%', maxWidth: 380,
    backgroundColor: Colors.white, borderRadius: 24,
    padding: 24, alignItems: 'center',
    ...shadow.md,
  },
  deleteModalIcon: { fontSize: 36, marginBottom: 10 },
  deleteModalTitle: { fontSize: 18, fontWeight: '900', color: '#B91C1C', marginBottom: 12, textAlign: 'center' },
  deleteModalBody: { fontSize: 13, color: Colors.inkSoft, lineHeight: 20, textAlign: 'center', marginBottom: 16 },
  deleteModalBodyStrong: { fontWeight: '800', color: '#B91C1C' },
  deleteModalHintBox: {
    width: '100%',
    backgroundColor: '#FEF2F2', borderRadius: 12,
    borderWidth: 1, borderColor: '#FCA5A5',
    paddingVertical: 12, paddingHorizontal: 14, alignItems: 'center',
    marginBottom: 12,
  },
  deleteModalHintLabel: { fontSize: 11, color: '#991B1B', fontWeight: '600', marginBottom: 6 },
  deleteModalKeyword: {
    fontSize: 15, fontWeight: '800', color: '#B91C1C', letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  deleteModalInput: {
    width: '100%',
    backgroundColor: Colors.creamSoft,
    borderRadius: 12, borderWidth: 1.5, borderColor: Colors.line,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: Colors.ink,
    marginBottom: 16,
  },
  deleteModalInputMatch: { borderColor: '#B91C1C', backgroundColor: '#FEF2F2' },
  deleteModalActions: { flexDirection: 'row', gap: 10, width: '100%' },
  deleteCancelBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.line,
    alignItems: 'center', backgroundColor: Colors.white,
  },
  deleteCancelText: { fontSize: 14, fontWeight: '700', color: Colors.inkSoft },
  deleteConfirmBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 12,
    backgroundColor: '#DC2626', alignItems: 'center',
  },
  deleteConfirmBtnDisabled: { backgroundColor: '#FCA5A5' },
  deleteConfirmText: { fontSize: 14, fontWeight: '800', color: '#FFF' },
  deleteConfirmTextDisabled: { color: '#FEF2F2' },
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
  modalFooterLinkRow: {
    marginTop: 16, paddingVertical: 12, paddingHorizontal: 14,
    backgroundColor: Colors.creamSoft, borderRadius: 12,
    alignItems: 'center',
  },
  modalFooterLinkText: {
    fontSize: 13, fontWeight: '700', color: Colors.forestDeep,
  },
  modalCloseBtn: {
    backgroundColor: Colors.forest, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center',
  },
  modalCloseBtnText: { color: '#FFF', fontWeight: '800', fontSize: 15 },
});
