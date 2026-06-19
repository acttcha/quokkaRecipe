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
import { resetDailyLeaves } from '../services/leaves';
import {
  getMockMode, setMockMode,
  getModelKey, setModelKey,
  ModelKey,
  getRecipeModelKey, setRecipeModelKey, RecipeModelKey, RECIPE_MODELS,
} from '../services/devSettings';
import { getLang, setLang, AppLang } from '../services/locale';
import { isPro, setIsPro } from '../services/subscription';
import { t } from '../i18n';

const APP_VERSION = (require('../../app.json') as { expo: { version: string } }).expo.version;

type InfoModal = 'guide' | 'update' | 'terms' | 'privacy' | null;

const getModalContent = (): Record<NonNullable<InfoModal>, { title: string; body: string }> => ({
  guide: {
    title: t('settings.guideTitle'),
    body: t('settings.guideBody'),
  },
  update: {
    title: t('settings.updateTitle'),
    body: t('settings.updateBody'),
  },
  terms: {
    title: t('settings.termsTitle'),
    body: t('settings.termsBody'),
  },
  privacy: {
    title: t('settings.privacyTitle'),
    body: t('settings.privacyBody'),
  },
});

// ── SVG 아이콘 ──────────────────────────────────────────
function IcBook() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M4 5.5c2.8-1 5.5-1 8 .8v13.5c-2.5-1.8-5.2-1.8-8-.8V5.5Z" stroke={Colors.inkSoft} strokeWidth={1.6} strokeLinejoin="round" />
      <Path d="M20 5.5c-2.8-1-5.5-1-8 .8v13.5c2.5-1.8 5.2-1.8 8-.8V5.5Z" stroke={Colors.inkSoft} strokeWidth={1.6} strokeLinejoin="round" />
    </Svg>
  );
}
function IcPhoto() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={5.5} width={18} height={14} rx={3} stroke={Colors.inkSoft} strokeWidth={1.6} />
      <Circle cx={8.5} cy={10} r={1.6} stroke={Colors.inkSoft} strokeWidth={1.4} />
      <Path d="M4 17l4.5-4 3 2.5 3.5-3.5L20 16.5" stroke={Colors.inkSoft} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}
function IcCart() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M3 4h2l2.2 11.2a1.5 1.5 0 0 0 1.5 1.2h7.8a1.5 1.5 0 0 0 1.5-1.2L20.5 8H6" stroke={Colors.inkSoft} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={9.5} cy={20} r={1.3} fill={Colors.inkSoft} />
      <Circle cx={17} cy={20} r={1.3} fill={Colors.inkSoft} />
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

const getDeleteConfirmPhrase = () => t('settings.deleteConfirmPhrase');

export default function SettingsScreen({ navigate, onResetPreferences, onResetAllData }: Props) {
  const [openModal, setOpenModal] = useState<InfoModal>(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [mockMode, setMockModeState] = useState(getMockMode());
  const [modelKey, setModelKeyState] = useState<ModelKey>(getModelKey());
  const [recipeModelKey, setRecipeModelKeyState] = useState<RecipeModelKey>(getRecipeModelKey());
  const [lang, setLangState] = useState<AppLang>(getLang());
  const [proMode, setProModeState] = useState(isPro());
  const deleteConfirmPhrase = getDeleteConfirmPhrase();
  const canDelete = deleteInput.trim() === deleteConfirmPhrase && !deleting;
  const modalContent = getModalContent();

  const handleToggleMock = async () => {
    const next = !mockMode;
    setMockModeState(next);
    await setMockMode(next);
  };

  const handleTogglePro = async () => {
    const next = !proMode;
    setProModeState(next);
    await setIsPro(next);
  };

  const handlePickModel = async (k: ModelKey) => {
    if (k === modelKey) return;
    setModelKeyState(k);
    await setModelKey(k);
  };

  const handlePickLang = async (l: AppLang) => {
    if (l === lang) return;
    setLangState(l);
    await setLang(l);
  };

  const handlePickRecipeModel = async (k: RecipeModelKey) => {
    if (k === recipeModelKey) return;
    setRecipeModelKeyState(k);
    await setRecipeModelKey(k);
  };

  const handleFeedback = () => {
    Linking.openURL(`mailto:acttcha@gmail.com?subject=${encodeURIComponent(t('settings.feedbackSubject'))}`).catch(() =>
      Alert.alert(t('settings.errorTitle'), t('settings.mailOpenError'))
    );
  };

  const handleRemoveAds = () => {
    Alert.alert(t('settings.removeAdsTitle'), t('settings.removeAdsMessage'), [
      { text: t('settings.confirm') },
    ]);
  };

  const handleResetUsage = async () => {
    await resetDailyLeaves();
    Alert.alert(t('settings.rechargeDoneTitle'), t('settings.rechargeDoneMessage'));
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
      Alert.alert(t('settings.errorTitle'), t('settings.deleteError'));
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
          <Text style={styles.headerTitle}>{t('settings.headerTitle')}</Text>
          <Text style={styles.headerSub}>{t('settings.headerSub')}</Text>
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
            <Text style={styles.profileName}>{t('settings.profileName')}</Text>
            <Text style={styles.profileSub}>{t('settings.profileSub')}</Text>
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
              <Text style={styles.resetTitle}>{t('settings.resetPrefsTitle')}</Text>
              <Text style={styles.resetSub}>{t('settings.resetPrefsSub')}</Text>
            </View>
            <IcChevron />
          </LinearGradient>
        </TouchableOpacity>

        {/* 요리 일기 */}
        <Text style={styles.sectionLabel}>{t('settings.sectionCookingLog')}</Text>
        <View style={styles.listCard}>
          <ListRow icon={<IcPhoto />} label={t('settings.rowCookingLog')} onPress={() => navigate({ name: 'CookingLog' })} />
        </View>

        {/* 장보기 */}
        <Text style={styles.sectionLabel}>{t('settings.sectionShopping')}</Text>
        <View style={styles.listCard}>
          <ListRow icon={<IcCart />} label={t('settings.rowShopping')} onPress={() => navigate({ name: 'ShoppingList' })} />
        </View>

        {/* 앱 안내 */}
        <Text style={styles.sectionLabel}>{t('settings.sectionGuide')}</Text>
        <View style={styles.listCard}>
          <ListRow icon={<IcBook />}   label={t('settings.rowGuide')}     onPress={() => setOpenModal('guide')} />
          <ListRow icon={<IcChat />}   label={t('settings.rowFeedback')}   onPress={handleFeedback}               divider />
          <ListRow icon={<IcNoads />}  label={t('settings.rowRemoveAds')} onPress={handleRemoveAds}             divider meta="PRO" />
          <ListRow icon={<IcSpark />}  label={t('settings.rowUpdate')} onPress={() => setOpenModal('update')} divider meta="NEW" />
        </View>

        {/* 법적 고지 */}
        <Text style={styles.sectionLabel}>{t('settings.sectionLegal')}</Text>
        <View style={styles.listCard}>
          <ListRow icon={<IcDoc />}    label={t('settings.rowTerms')}          onPress={() => setOpenModal('terms')}   />
          <ListRow icon={<IcShield />} label={t('settings.rowPrivacy')}   onPress={() => setOpenModal('privacy')} divider />
          <View style={styles.versionRow}>
            <View style={styles.listIconWrap}><Text style={{ fontSize: 14 }}>ℹ️</Text></View>
            <Text style={styles.listLabel}>{t('settings.rowVersion')}</Text>
            <Text style={styles.versionValue}>{APP_VERSION}</Text>
          </View>
        </View>

        {/* 데이터 관리 */}
        <Text style={styles.sectionLabel}>{t('settings.sectionData')}</Text>
        <TouchableOpacity
          style={styles.dangerCard}
          onPress={handleResetAllData}
          activeOpacity={0.85}
        >
          <View style={styles.dangerIconWrap}>
            <Text style={styles.dangerIcon}>🗑️</Text>
          </View>
          <View style={styles.dangerTexts}>
            <Text style={styles.dangerTitle}>{t('settings.deleteAllTitle')}</Text>
            <Text style={styles.dangerSub}>{t('settings.deleteAllSub')}</Text>
          </View>
          <IcChevron />
        </TouchableOpacity>

        {/* 개발자모드 (출시 전 제거) */}
        <Text style={styles.sectionLabel}>{t('settings.sectionDev')}</Text>
        <TouchableOpacity
          style={styles.testCard}
          onPress={handleResetUsage}
          activeOpacity={0.85}
        >
          <Text style={styles.testIcon}>🍃</Text>
          <View style={styles.testTexts}>
            <Text style={styles.testTitle}>{t('settings.devRechargeTitle')}</Text>
            <Text style={styles.testSub}>{t('settings.devRechargeSub')}</Text>
          </View>
          <IcChevron />
        </TouchableOpacity>

        {/* PRO 구독 토글 — 진짜 IAP 붙기 전까지 수동 강제 */}
        <TouchableOpacity
          style={styles.testCard}
          onPress={handleTogglePro}
          activeOpacity={0.85}
        >
          <Text style={styles.testIcon}>{proMode ? '💎' : '🆓'}</Text>
          <View style={styles.testTexts}>
            <Text style={styles.testTitle}>{t('settings.devProTitle')}</Text>
            <Text style={styles.testSub}>
              {proMode
                ? t('settings.devProOn')
                : t('settings.devProOff')}
            </Text>
          </View>
          <View style={[styles.mockSwitch, proMode && styles.mockSwitchOn]}>
            <Text style={[styles.mockSwitchText, proMode && styles.mockSwitchTextOn]}>
              {proMode ? 'PRO' : 'FREE'}
            </Text>
          </View>
        </TouchableOpacity>

        {/* 임시 모드 — API 호출 없이 목 데이터로 화면 이동만 */}
        <TouchableOpacity
          style={styles.testCard}
          onPress={handleToggleMock}
          activeOpacity={0.85}
        >
          <Text style={styles.testIcon}>{mockMode ? '🟢' : '⚪'}</Text>
          <View style={styles.testTexts}>
            <Text style={styles.testTitle}>{t('settings.devMockTitle')}</Text>
            <Text style={styles.testSub}>
              {mockMode
                ? t('settings.devMockOn')
                : t('settings.devMockOff')}
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
            <Text style={styles.testTitle}>{t('settings.devClaudeModelTitle')}</Text>
            <Text style={styles.testSub}>
              {modelKey === 'auto'
                ? t('settings.devClaudeModelAuto')
                : t('settings.devClaudeModelOverride', { model: modelKey })}
            </Text>
            <View style={styles.modelRow}>
              {(['auto', 'haiku', 'sonnet', 'opus'] as ModelKey[]).map(k => {
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

        {/* 레시피 생성 모델 변경 */}
        <View style={styles.testCard}>
          <Text style={styles.testIcon}>🍳</Text>
          <View style={styles.testTexts}>
            <Text style={styles.testTitle}>{t('settings.devRecipeModelTitle')}</Text>
            <Text style={styles.testSub}>
              {t('settings.devRecipeModelSub', { model: RECIPE_MODELS[recipeModelKey].label })}
            </Text>
            <View style={styles.modelRow}>
              {(Object.keys(RECIPE_MODELS) as RecipeModelKey[]).map(k => {
                const active = k === recipeModelKey;
                const short = RECIPE_MODELS[k].label.replace('Gemini ', 'G·').replace('Claude ', 'C·');
                return (
                  <TouchableOpacity
                    key={k}
                    style={[styles.modelChip, active && styles.modelChipActive]}
                    onPress={() => handlePickRecipeModel(k)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.modelChipText, active && styles.modelChipTextActive]}>
                      {short}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* 언어 (AI 응답 언어 — UI 전체 번역은 추후) */}
        <View style={styles.testCard}>
          <Text style={styles.testIcon}>🌐</Text>
          <View style={styles.testTexts}>
            <Text style={styles.testTitle}>{t('settings.langTitle')}</Text>
            <Text style={styles.testSub}>
              {t('settings.langSub', { lang: lang === 'ko' ? t('settings.langKorean') : t('settings.langEnglish') })}
            </Text>
            <View style={styles.modelRow}>
              {(['ko', 'en'] as AppLang[]).map(l => {
                const active = l === lang;
                return (
                  <TouchableOpacity
                    key={l}
                    style={[styles.modelChip, active && styles.modelChipActive]}
                    onPress={() => handlePickLang(l)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.modelChipText, active && styles.modelChipTextActive]}>
                      {l === 'ko' ? t('settings.langKorean') : t('settings.langEnglish')}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

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
            <Text style={styles.deleteModalTitle}>{t('settings.deleteModalTitle')}</Text>
            <Text style={styles.deleteModalBody}>
              {t('settings.deleteModalBodyL1')}{'\n'}
              {t('settings.deleteModalBodyL2a')}<Text style={styles.deleteModalBodyStrong}>{t('settings.deleteModalBodyStrong')}</Text>{t('settings.deleteModalBodyL2b')}{'\n'}
              {t('settings.deleteModalBodyL3')}
            </Text>
            <View style={styles.deleteModalHintBox}>
              <Text style={styles.deleteModalHintLabel}>{t('settings.deleteModalHint')}</Text>
              <Text style={styles.deleteModalKeyword}>{deleteConfirmPhrase}</Text>
            </View>
            <TextInput
              style={[styles.deleteModalInput, canDelete && styles.deleteModalInputMatch]}
              value={deleteInput}
              onChangeText={setDeleteInput}
              placeholder={deleteConfirmPhrase}
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
                <Text style={styles.deleteCancelText}>{t('settings.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteConfirmBtn, !canDelete && styles.deleteConfirmBtnDisabled]}
                onPress={confirmDelete}
                disabled={!canDelete}
                activeOpacity={0.85}
              >
                <Text style={[styles.deleteConfirmText, !canDelete && styles.deleteConfirmTextDisabled]}>
                  {deleting ? t('settings.deleting') : t('settings.delete')}
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
              title={modalContent[openModal].title}
              body={modalContent[openModal].body}
              footerLink={
                openModal === 'privacy'
                  ? { label: t('settings.viewFullOnWeb'), url: 'https://fuschia-evergreen-84d.notion.site/379fdf7f452480f9a973ee3e4e2cca05' }
                  : openModal === 'terms'
                    ? { label: t('settings.viewFullOnWeb'), url: 'https://fuschia-evergreen-84d.notion.site/379fdf7f452480b0b096ce3220b7fbf3' }
                    : undefined
              }
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
            <Text style={styles.modalCloseBtnText}>{t('settings.close')}</Text>
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
