import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, ScrollView, Image, ImageBackground, StatusBar, Modal, Linking,
} from 'react-native';
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

      <ImageBackground source={require('../../assets/background.png')} style={styles.hero} resizeMode="cover">
        <View style={styles.heroOverlay}>
          <Image source={require('../../assets/main_logo.png')} style={styles.heroLogo} resizeMode="contain" />
          <Text style={styles.heroSub}>설정 및 앱 정보</Text>
        </View>
      </ImageBackground>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>

        {/* 내 정보 */}
        <TouchableOpacity style={styles.profileRow} onPress={() => navigate({ name: 'Profile' })} activeOpacity={0.85}>
          <Image source={require('../../assets/quokka.png')} style={styles.profileRowQuokka} resizeMode="contain" />
          <View style={styles.profileRowTexts}>
            <Text style={styles.profileRowTitle}>내 정보</Text>
            <Text style={styles.profileRowSub}>닉네임, 통계, 선호도 확인</Text>
          </View>
          <Text style={styles.rowArrow}>›</Text>
        </TouchableOpacity>

        {/* 선호도 리셋 */}
        <TouchableOpacity
          style={styles.menuRow}
          onPress={async () => { await resetOnboarding(); onResetPreferences?.(); }}
          activeOpacity={0.8}
        >
          <Text style={styles.menuRowIcon}>🔄</Text>
          <View style={styles.menuRowTexts}>
            <Text style={styles.menuRowTitle}>선호도 다시 설정</Text>
            <Text style={styles.menuRowSub}>알레르기, 맵기, 조리 시간 등 다시 설정해요</Text>
          </View>
          <Text style={styles.rowArrow}>›</Text>
        </TouchableOpacity>

        {/* 앱 안내 */}
        <Text style={styles.sectionHead}>앱 안내</Text>
        <View style={styles.menuCard}>
          <MenuRow icon="📖" label="이용 방법"    onPress={() => setOpenModal('guide')} />
          <MenuRow icon="💬" label="의견 보내기"  onPress={handleFeedback}             divider />
          <MenuRow icon="🚫" label="배너 광고 제거" onPress={handleRemoveAds}           divider />
          <MenuRow icon="🆕" label="업데이트 노트" onPress={() => setOpenModal('update')} divider />
        </View>

        {/* 법적 고지 */}
        <Text style={styles.sectionHead}>법적 고지</Text>
        <View style={styles.menuCard}>
          <MenuRow icon="📋" label="이용약관"         onPress={() => setOpenModal('terms')}   />
          <MenuRow icon="🔐" label="개인정보처리방침"  onPress={() => setOpenModal('privacy')} divider />
          <View style={styles.versionRow}>
            <Text style={styles.versionIcon}>ℹ️</Text>
            <Text style={styles.versionLabel}>앱 버전</Text>
            <Text style={styles.versionValue}>1.0.0</Text>
          </View>
        </View>

      </ScrollView>

      {/* 정보 모달 */}
      <Modal visible={!!openModal} transparent animationType="slide" onRequestClose={() => setOpenModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>
              {openModal ? MODAL_CONTENT[openModal].title : ''}
            </Text>
            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
              <Text style={styles.modalBody}>
                {openModal ? MODAL_CONTENT[openModal].body : ''}
              </Text>
            </ScrollView>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setOpenModal(null)}>
              <Text style={styles.modalCloseBtnText}>닫기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function MenuRow({ icon, label, onPress, divider }: {
  icon: string; label: string; onPress: () => void; divider?: boolean;
}) {
  return (
    <>
      {divider && <View style={menuRowStyles.divider} />}
      <TouchableOpacity style={menuRowStyles.row} onPress={onPress} activeOpacity={0.7}>
        <Text style={menuRowStyles.icon}>{icon}</Text>
        <Text style={menuRowStyles.label}>{label}</Text>
        <Text style={menuRowStyles.arrow}>›</Text>
      </TouchableOpacity>
    </>
  );
}

const menuRowStyles = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 15 },
  divider: { height: 1, backgroundColor: Colors.border, marginHorizontal: 18 },
  icon:    { fontSize: 18, width: 30 },
  label:   { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.text },
  arrow:   { fontSize: 20, color: Colors.textMuted },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },

  hero: { minHeight: 180 },
  heroOverlay: {
    flex: 1, paddingTop: 56, paddingHorizontal: 24, paddingBottom: 28,
    backgroundColor: 'rgba(255,255,255,0.45)', justifyContent: 'flex-end',
  },

  heroLogo: { width: '100%', height: 56, marginBottom: 6 },
  heroSub: { fontSize: 13, color: Colors.textMid, fontWeight: '500', textAlign: 'center' },

  body: { flex: 1, backgroundColor: Colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -20 },
  bodyContent: { padding: 20, paddingBottom: 48 },

  profileRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.card, borderRadius: 20, padding: 16,
    marginBottom: 14, ...shadow.sm,
  },
  profileRowQuokka: { width: 52, height: 52 },
  profileRowTexts: { flex: 1 },
  profileRowTitle: { fontSize: 16, fontWeight: '800', color: Colors.text },
  profileRowSub: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },

  menuRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.card, borderRadius: 20, padding: 18,
    marginBottom: 14, ...shadow.sm,
  },
  menuRowIcon: { fontSize: 22, marginRight: 14 },
  menuRowTexts: { flex: 1 },
  menuRowTitle: { fontSize: 15, fontWeight: '800', color: Colors.text },
  menuRowSub: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  rowArrow: { fontSize: 22, color: Colors.textMuted, fontWeight: '300' },

  sectionHead: { fontSize: 13, fontWeight: '700', color: Colors.textMuted, marginBottom: 8, marginTop: 4, letterSpacing: 0.5 },
  menuCard: { backgroundColor: Colors.card, borderRadius: 20, marginBottom: 14, overflow: 'hidden', ...shadow.sm },

  versionRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 15 },
  versionIcon: { fontSize: 18, width: 30 },
  versionLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.text },
  versionValue: { fontSize: 14, fontWeight: '700', color: Colors.textMuted },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet: {
    backgroundColor: '#FFF', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 24, paddingTop: 20, paddingBottom: 36, maxHeight: '80%',
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '900', color: Colors.primary, marginBottom: 14 },
  modalScroll: { marginBottom: 16 },
  modalBody: { fontSize: 14, color: Colors.text, lineHeight: 24 },
  modalCloseBtn: {
    backgroundColor: Colors.accent, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center',
  },
  modalCloseBtnText: { color: '#FFF', fontWeight: '800', fontSize: 15 },
});
