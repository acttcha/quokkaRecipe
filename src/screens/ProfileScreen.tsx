import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  StatusBar, Image, Dimensions, TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { NavProps } from '../types';
import { getSavedRecipes } from '../services/savedRecipes';
import { loadPreferences } from '../services/preferences';
import { getNickname, saveNickname, getScanCount } from '../services/stats';
import { getCookLogCount } from '../services/cookingLog';
import { UserPreferences, DEFAULT_PREFERENCES } from '../types/preferences';
import { Colors, shadow } from '../constants/colors';
import { haptic } from '../services/haptics';
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
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

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
        <TouchableOpacity onPress={goBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>{t('profile.back')}</Text>
        </TouchableOpacity>
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.cream },

  hero: { minHeight: 170, paddingTop: 52, paddingHorizontal: 24, paddingBottom: 28, justifyContent: 'flex-end' },
  backBtn: { marginBottom: 10 },
  backBtnText: { color: Colors.forest, fontSize: 14, fontWeight: '700' },
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
});
