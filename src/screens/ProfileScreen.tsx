import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  StatusBar, Image, Dimensions, TextInput, Alert, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { NavProps } from '../types';
import { getSavedRecipes } from '../services/savedRecipes';
import { loadPreferences } from '../services/preferences';
import { getNickname, saveNickname, getScanCount } from '../services/stats';
import { getCookLogCount } from '../services/cookingLog';
import { UserPreferences, DEFAULT_PREFERENCES } from '../types/preferences';
import { Colors, shadow } from '../constants/colors';
import { BackButton } from '../components/BackButton';
import { haptic } from '../services/haptics';
import { isLoggedIn, getUserEmail, signInWithGoogle, signOut, deleteAccount, isAuthReady } from '../services/auth';
import { t } from '../i18n';

const { width } = Dimensions.get('window');

interface Props extends NavProps {
  onResetPreferences?: () => void;
}

export default function ProfileScreen({ navigate, goBack, onResetPreferences }: Props) {
  const [nickname, setNickname]     = useState(t('profile.defaultNickname'));
  const [editingNick, setEditingNick] = useState(false);
  const [nickInput, setNickInput]   = useState('');
  const [scanCount, setScanCount]   = useState(0);
  const [savedCount, setSavedCount] = useState(0);
  const [cookCount, setCookCount]   = useState(0);
  const [prefs, setPrefs]           = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [loggedIn, setLoggedIn]     = useState(isLoggedIn());
  const [email, setEmail]           = useState<string | null>(getUserEmail());
  const [authBusy, setAuthBusy]     = useState(false);
  const [delAcctModal, setDelAcctModal] = useState(false);
  const [delAcctInput, setDelAcctInput] = useState('');
  const [delAcctBusy, setDelAcctBusy]   = useState(false);

  const loadAll = useCallback(async () => {
    const [nick, scan, saved, cooked, prefData] = await Promise.all([
      getNickname(),
      getScanCount(),
      getSavedRecipes(),
      getCookLogCount(),
      loadPreferences(),
    ]);
    setNickname(nick);
    setScanCount(scan);
    setSavedCount(saved.length);
    setCookCount(cooked);
    setPrefs(prefData);
    setLoggedIn(isLoggedIn());
    setEmail(getUserEmail());
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleLogin = async () => {
    if (authBusy) return;
    setAuthBusy(true);
    try {
      await signInWithGoogle();
      setLoggedIn(isLoggedIn());
      setEmail(getUserEmail());
      haptic.success();
    } catch (e: any) {
      if (!e?.message?.includes('cancel')) {
        Alert.alert(t('profile.loginFailTitle'), e?.message || t('profile.loginFailMsg'));
      }
    } finally {
      setAuthBusy(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(t('profile.logoutConfirmTitle'), t('profile.logoutConfirmMsg'), [
      { text: t('profile.cancel'), style: 'cancel' },
      {
        text: t('profile.logout'),
        style: 'destructive',
        onPress: async () => { await signOut(); setLoggedIn(false); setEmail(null); },
      },
    ]);
  };

  const delAcctPhrase = t('profile.deleteAccountPhrase');
  const canDelAcct = delAcctInput.trim() === delAcctPhrase && !delAcctBusy;

  const openDeleteAccount = () => { setDelAcctInput(''); setDelAcctModal(true); };
  const closeDeleteAccount = () => { if (delAcctBusy) return; setDelAcctModal(false); setDelAcctInput(''); };
  const confirmDeleteAccount = async () => {
    if (!canDelAcct) return;
    setDelAcctBusy(true);
    try {
      await deleteAccount();
      setDelAcctModal(false);
      setDelAcctInput('');
      setLoggedIn(false);
      setEmail(null);
      Alert.alert(t('profile.deleteAccountDoneTitle'), t('profile.deleteAccountDoneMsg'));
    } catch (e: any) {
      Alert.alert(t('profile.deleteAccountFailTitle'), e?.message || t('profile.deleteAccountFailMsg'));
    } finally {
      setDelAcctBusy(false);
    }
  };

  const startEdit = () => { setNickInput(nickname); setEditingNick(true); };
  const saveNick = async () => {
    const trimmed = nickInput.trim() || t('profile.defaultNickname');
    await saveNickname(trimmed);
    setNickname(trimmed);
    setEditingNick(false);
    haptic.success();
  };

  const PREF_ROWS = [
    { icon: '🥗', label: t('profile.dietType'),   value: prefs.dietType    || t('profile.notSet') },
    { icon: '🌶️', label: t('profile.spiceLevel'),   value: prefs.spiceLevel  || t('profile.notSet') },
    { icon: '⏱️', label: t('profile.cookingTime'),   value: prefs.cookingTime || t('profile.notSet') },
    { icon: '👨‍🍳', label: t('profile.cookingSkill'),   value: prefs.cookingSkill || t('profile.notSet') },
    { icon: '⚠️', label: t('profile.allergies'),    value: prefs.allergies.length > 0 ? prefs.allergies.join(', ') : t('profile.none') },
    { icon: '🍽️', label: t('profile.cuisineStyles'), value: prefs.cuisineStyles.length > 0 ? prefs.cuisineStyles.join(', ') : t('profile.notSet') },
    { icon: '👥', label: t('profile.servingsLabel'),   value: prefs.servings ? t('profile.servings', { n: prefs.servings }) : t('profile.notSet') },
  ];

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <LinearGradient colors={['#F6E0B5', Colors.cream]} locations={[0, 0.7]} style={styles.hero}>
        <BackButton onPress={goBack} label={t('profile.back')} style={styles.backBtn} />
        <Image source={require('../../assets/main_logo.png')} style={styles.heroLogo} resizeMode="contain" />
        <Text style={styles.heroSub}>{t('profile.heroSub')}</Text>
      </LinearGradient>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>

        {/* 프로필 카드 */}
        <View style={styles.profileCard}>
          <Image source={require('../../assets/quokka.png')} style={styles.profileQuokka} resizeMode="contain" />
          {editingNick ? (
            <View style={styles.nickEditRow}>
              <TextInput
                style={styles.nickInput}
                value={nickInput}
                onChangeText={setNickInput}
                autoFocus
                maxLength={12}
                onSubmitEditing={saveNick}
                returnKeyType="done"
              />
              <TouchableOpacity style={styles.nickSaveBtn} onPress={saveNick}>
                <Text style={styles.nickSaveBtnText}>{t('profile.save')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.nickRow} onPress={startEdit}>
              <Text style={styles.nickname}>{nickname}</Text>
              <Text style={styles.nickEditIcon}>✏️</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.profileSub}>{t('profile.profileSub')}</Text>
        </View>

        {/* 계정 (선택적 로그인 — 폰 변경 대비 지갑 유지) */}
        {isAuthReady() && (
          <View style={styles.accountCard}>
            {loggedIn ? (
              <>
                <Text style={styles.accountEmail} numberOfLines={1}>
                  {t('profile.loggedInAs', { email: email ?? '' })}
                </Text>
                <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
                  <Text style={styles.logoutBtnText}>{t('profile.logout')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteAccountBtn} onPress={openDeleteAccount} activeOpacity={0.7}>
                  <Text style={styles.deleteAccountText}>{t('profile.deleteAccount')}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.accountHint}>{t('profile.loginHint')}</Text>
                <TouchableOpacity
                  style={styles.loginBtn}
                  onPress={handleLogin}
                  activeOpacity={0.85}
                  disabled={authBusy}
                >
                  <Text style={styles.loginBtnText}>
                    {authBusy ? t('profile.loginBusy') : t('profile.loginGoogle')}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* 통계 */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: Colors.forestSoft }]}>
            <Text style={styles.statValue}>{savedCount}</Text>
            <Text style={styles.statLabel}>{t('profile.savedRecipes')}</Text>
          </View>
          <TouchableOpacity
            style={[styles.statCard, { backgroundColor: Colors.orangeSoft }]}
            activeOpacity={0.85}
            onPress={() => { haptic.light(); navigate({ name: 'CookingLog' }); }}
          >
            <Text style={styles.statValue}>{cookCount}</Text>
            <Text style={styles.statLabel}>{t('profile.cookedDishes')}</Text>
            <Text style={styles.statArrow}>›</Text>
          </TouchableOpacity>
          <View style={[styles.statCard, { backgroundColor: Colors.skyLight }]}>
            <Text style={styles.statValue}>{scanCount}</Text>
            <Text style={styles.statLabel}>{t('profile.totalScans')}</Text>
          </View>
        </View>

        {/* 내 선호도 */}
        <Text style={styles.sectionHead}>{t('profile.preferencesHead')}</Text>
        <View style={styles.prefCard}>
          {PREF_ROWS.map((row, i) => (
            <View key={row.label} style={[styles.prefRow, i < PREF_ROWS.length - 1 && styles.prefRowBorder]}>
              <Text style={styles.prefIcon}>{row.icon}</Text>
              <Text style={styles.prefLabel}>{row.label}</Text>
              <Text style={styles.prefValue} numberOfLines={1}>{row.value}</Text>
            </View>
          ))}
        </View>

        {onResetPreferences && (
          <TouchableOpacity style={styles.editPrefBtn} onPress={onResetPreferences} activeOpacity={0.85}>
            <Text style={styles.editPrefBtnText}>{t('profile.resetPreferences')}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* 계정 삭제 확인 모달 (문구 타이핑) */}
      <Modal visible={delAcctModal} transparent animationType="fade" onRequestClose={closeDeleteAccount}>
        <KeyboardAvoidingView style={styles.delModalWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.delModalBackdrop} />
          <View style={styles.delModalCard}>
            <Text style={styles.delModalIcon}>⚠️</Text>
            <Text style={styles.delModalTitle}>{t('profile.deleteAccountConfirmTitle')}</Text>
            <Text style={styles.delModalBody}>{t('profile.deleteAccountConfirmMsg')}</Text>
            <View style={styles.delModalHintBox}>
              <Text style={styles.delModalHintLabel}>{t('settings.deleteModalHint')}</Text>
              <Text style={styles.delModalKeyword}>{delAcctPhrase}</Text>
            </View>
            <TextInput
              style={[styles.delModalInput, canDelAcct && styles.delModalInputMatch]}
              value={delAcctInput}
              onChangeText={setDelAcctInput}
              placeholder={delAcctPhrase}
              placeholderTextColor={Colors.inkMute}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!delAcctBusy}
            />
            <View style={styles.delModalActions}>
              <TouchableOpacity style={styles.delCancelBtn} onPress={closeDeleteAccount} disabled={delAcctBusy}>
                <Text style={styles.delCancelText}>{t('profile.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.delConfirmBtn, !canDelAcct && styles.delConfirmBtnDisabled]}
                onPress={confirmDeleteAccount}
                disabled={!canDelAcct}
                activeOpacity={0.85}
              >
                <Text style={[styles.delConfirmText, !canDelAcct && styles.delConfirmTextDisabled]}>
                  {delAcctBusy ? t('settings.deleting') : t('profile.deleteAccount')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.cream },

  hero: { minHeight: 170, paddingTop: 52, paddingHorizontal: 24, paddingBottom: 28, justifyContent: 'flex-end' },
  backBtn: { marginBottom: 10 },
  heroLogo: { width: '100%', height: 52, marginBottom: 6 },
  heroSub: { fontSize: 13, color: Colors.inkSoft, textAlign: 'center' },

  body: { flex: 1, backgroundColor: Colors.cream, borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -20 },
  bodyContent: { padding: 20, paddingBottom: 48 },

  profileCard: {
    backgroundColor: Colors.white, borderRadius: 24, padding: 24,
    alignItems: 'center', marginBottom: 16,
    borderWidth: 1, borderColor: Colors.lineSoft, ...shadow.sm,
  },
  profileQuokka: { width: width * 0.36, height: 130, marginBottom: 14 },
  nickRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  nickname: { fontSize: 22, fontWeight: '900', color: Colors.ink },
  nickEditIcon: { fontSize: 14 },
  nickEditRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  nickInput: {
    fontSize: 18, fontWeight: '700', color: Colors.ink,
    borderBottomWidth: 2, borderBottomColor: Colors.forest,
    paddingVertical: 4, paddingHorizontal: 8, minWidth: 120,
  },
  nickSaveBtn: { backgroundColor: Colors.forest, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 6 },
  nickSaveBtnText: { color: '#FFF', fontWeight: '800', fontSize: 13 },
  profileSub: { fontSize: 13, color: Colors.inkMute, fontWeight: '600' },

  accountCard: {
    backgroundColor: Colors.white, borderRadius: 20, padding: 18,
    marginBottom: 16, borderWidth: 1, borderColor: Colors.lineSoft, ...shadow.sm,
  },
  accountHint: { fontSize: 13, color: Colors.inkSoft, fontWeight: '600', marginBottom: 12, textAlign: 'center' },
  accountEmail: { fontSize: 14, fontWeight: '700', color: Colors.ink, marginBottom: 12, textAlign: 'center' },
  loginBtn: {
    backgroundColor: Colors.ink, borderRadius: 14, paddingVertical: 14,
    alignItems: 'center', ...shadow.sm,
  },
  loginBtnText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
  logoutBtn: {
    backgroundColor: Colors.cream, borderRadius: 14, paddingVertical: 12,
    alignItems: 'center', borderWidth: 1, borderColor: Colors.line,
  },
  logoutBtnText: { color: Colors.inkSoft, fontWeight: '700', fontSize: 13 },
  deleteAccountBtn: { paddingVertical: 10, alignItems: 'center', marginTop: 2 },
  deleteAccountText: { color: Colors.inkMute, fontWeight: '600', fontSize: 12, textDecorationLine: 'underline' },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  statCard: { flex: 1, borderRadius: 20, paddingVertical: 18, paddingHorizontal: 10, alignItems: 'center', borderWidth: 1, borderColor: Colors.lineSoft, ...shadow.sm },
  statValue: { fontSize: 30, fontWeight: '900', color: Colors.ink, marginBottom: 4 },
  statLabel: { fontSize: 12, color: Colors.inkSoft, fontWeight: '700', textAlign: 'center' },
  statArrow: { position: 'absolute', top: 8, right: 10, fontSize: 16, fontWeight: '900', color: Colors.orangeDeep },

  sectionHead: { fontSize: 15, fontWeight: '800', color: Colors.ink, marginBottom: 12 },

  prefCard: { backgroundColor: Colors.white, borderRadius: 20, marginBottom: 16, overflow: 'hidden', borderWidth: 1, borderColor: Colors.lineSoft, ...shadow.sm },
  prefRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 14 },
  prefRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.line },
  prefIcon: { fontSize: 18, width: 30 },
  prefLabel: { fontSize: 14, fontWeight: '600', color: Colors.inkSoft, flex: 1 },
  prefValue: { fontSize: 14, fontWeight: '700', color: Colors.ink, maxWidth: '55%', textAlign: 'right' },

  editPrefBtn: {
    backgroundColor: Colors.forestSoft, borderRadius: 16,
    paddingVertical: 16, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.forest, ...shadow.sm,
  },
  editPrefBtnText: { color: Colors.forestDeep, fontWeight: '800', fontSize: 14 },

  delModalWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  delModalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  delModalCard: { width: '100%', maxWidth: 380, backgroundColor: Colors.white, borderRadius: 24, padding: 24, alignItems: 'center', ...shadow.md },
  delModalIcon: { fontSize: 36, marginBottom: 10 },
  delModalTitle: { fontSize: 18, fontWeight: '900', color: '#B91C1C', marginBottom: 12, textAlign: 'center' },
  delModalBody: { fontSize: 13, color: Colors.inkSoft, lineHeight: 20, textAlign: 'center', marginBottom: 16 },
  delModalHintBox: { width: '100%', backgroundColor: '#FEF2F2', borderRadius: 12, borderWidth: 1, borderColor: '#FCA5A5', paddingVertical: 12, paddingHorizontal: 14, alignItems: 'center', marginBottom: 12 },
  delModalHintLabel: { fontSize: 11, color: '#991B1B', fontWeight: '600', marginBottom: 6 },
  delModalKeyword: { fontSize: 15, fontWeight: '800', color: '#B91C1C', letterSpacing: 0.5, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  delModalInput: { width: '100%', backgroundColor: Colors.creamSoft, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.line, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: Colors.ink, marginBottom: 16 },
  delModalInputMatch: { borderColor: '#B91C1C', backgroundColor: '#FEF2F2' },
  delModalActions: { flexDirection: 'row', gap: 10, width: '100%' },
  delCancelBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.line, alignItems: 'center', backgroundColor: Colors.white },
  delCancelText: { fontSize: 14, fontWeight: '700', color: Colors.inkSoft },
  delConfirmBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, backgroundColor: '#DC2626', alignItems: 'center' },
  delConfirmBtnDisabled: { backgroundColor: '#FCA5A5' },
  delConfirmText: { fontSize: 14, fontWeight: '800', color: '#FFF' },
  delConfirmTextDisabled: { color: '#FEF2F2' },
});
