import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  StatusBar, Image, ImageBackground, Dimensions, TextInput,
} from 'react-native';
import { NavProps } from '../types';
import { getSavedRecipes } from '../services/savedRecipes';
import { loadPreferences } from '../services/preferences';
import { getNickname, saveNickname, getScanCount } from '../services/stats';
import { UserPreferences, DEFAULT_PREFERENCES } from '../types/preferences';
import { Colors, shadow } from '../constants/colors';

const { width } = Dimensions.get('window');

interface Props extends NavProps {
  onResetPreferences?: () => void;
}

export default function ProfileScreen({ goBack, onResetPreferences }: Props) {
  const [nickname, setNickname]     = useState('쿼카 유저');
  const [editingNick, setEditingNick] = useState(false);
  const [nickInput, setNickInput]   = useState('');
  const [scanCount, setScanCount]   = useState(0);
  const [savedCount, setSavedCount] = useState(0);
  const [prefs, setPrefs]           = useState<UserPreferences>(DEFAULT_PREFERENCES);

  const loadAll = useCallback(async () => {
    const [nick, scan, saved, prefData] = await Promise.all([
      getNickname(),
      getScanCount(),
      getSavedRecipes(),
      loadPreferences(),
    ]);
    setNickname(nick);
    setScanCount(scan);
    setSavedCount(saved.length);
    setPrefs(prefData);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const startEdit = () => { setNickInput(nickname); setEditingNick(true); };
  const saveNick = async () => {
    const trimmed = nickInput.trim() || '쿼카 유저';
    await saveNickname(trimmed);
    setNickname(trimmed);
    setEditingNick(false);
  };

  const PREF_ROWS = [
    { icon: '🥗', label: '식단 유형',   value: prefs.dietType    || '설정 전' },
    { icon: '🌶️', label: '매운 음식',   value: prefs.spiceLevel  || '설정 전' },
    { icon: '⏱️', label: '조리 시간',   value: prefs.cookingTime || '설정 전' },
    { icon: '👨‍🍳', label: '요리 실력',   value: prefs.cookingSkill || '설정 전' },
    { icon: '⚠️', label: '알레르기',    value: prefs.allergies.length > 0 ? prefs.allergies.join(', ') : '없음' },
    { icon: '🍽️', label: '선호 스타일', value: prefs.cuisineStyles.length > 0 ? prefs.cuisineStyles.join(', ') : '설정 전' },
  ];

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <ImageBackground source={require('../../assets/background.png')} style={styles.hero} resizeMode="cover">
        <View style={styles.heroOverlay}>
          <TouchableOpacity onPress={goBack} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← 돌아가기</Text>
          </TouchableOpacity>
          <Image source={require('../../assets/main_logo.png')} style={styles.heroLogo} resizeMode="contain" />
          <Text style={styles.heroSub}>내 정보</Text>
        </View>
      </ImageBackground>

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
                <Text style={styles.nickSaveBtnText}>저장</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.nickRow} onPress={startEdit}>
              <Text style={styles.nickname}>{nickname}</Text>
              <Text style={styles.nickEditIcon}>✏️</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.profileSub}>쿼카레시피 유저 🐾</Text>
        </View>

        {/* 통계 */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: Colors.accentLight }]}>
            <Text style={styles.statValue}>{savedCount}</Text>
            <Text style={styles.statLabel}>저장된 레시피</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: Colors.yellowLight }]}>
            <Text style={styles.statValue}>{scanCount}</Text>
            <Text style={styles.statLabel}>총 스캔 횟수</Text>
          </View>
        </View>

        {/* 내 선호도 */}
        <Text style={styles.sectionHead}>내 선호도</Text>
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
            <Text style={styles.editPrefBtnText}>🔄  선호도 다시 설정하기</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },

  hero: { minHeight: 170 },
  heroOverlay: {
    flex: 1, paddingTop: 52, paddingHorizontal: 24, paddingBottom: 28,
    backgroundColor: 'rgba(255,255,255,0.45)', justifyContent: 'flex-end',
  },
  backBtn: { marginBottom: 10 },
  backBtnText: { color: Colors.primary, fontSize: 14, fontWeight: '700' },
  heroLogo: { width: '100%', height: 52, marginBottom: 6 },
  heroSub: { fontSize: 13, color: Colors.textMid, textAlign: 'center' },

  body: { flex: 1, backgroundColor: Colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -20 },
  bodyContent: { padding: 20, paddingBottom: 48 },

  profileCard: {
    backgroundColor: Colors.card, borderRadius: 24, padding: 24,
    alignItems: 'center', marginBottom: 16, ...shadow.md,
  },
  profileQuokka: { width: width * 0.36, height: 130, marginBottom: 14 },
  nickRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  nickname: { fontSize: 22, fontWeight: '900', color: Colors.primary },
  nickEditIcon: { fontSize: 14 },
  nickEditRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  nickInput: {
    fontSize: 18, fontWeight: '700', color: Colors.primary,
    borderBottomWidth: 2, borderBottomColor: Colors.accent,
    paddingVertical: 4, paddingHorizontal: 8, minWidth: 120,
  },
  nickSaveBtn: { backgroundColor: Colors.accent, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 6 },
  nickSaveBtnText: { color: '#FFF', fontWeight: '800', fontSize: 13 },
  profileSub: { fontSize: 13, color: Colors.textMuted, fontWeight: '600' },

  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statCard: { flex: 1, borderRadius: 20, padding: 20, alignItems: 'center', ...shadow.sm },
  statValue: { fontSize: 36, fontWeight: '900', color: Colors.primary, marginBottom: 4 },
  statLabel: { fontSize: 12, color: Colors.primaryMid, fontWeight: '700' },

  sectionHead: { fontSize: 15, fontWeight: '800', color: Colors.text, marginBottom: 12 },

  prefCard: { backgroundColor: Colors.card, borderRadius: 20, marginBottom: 16, overflow: 'hidden', ...shadow.sm },
  prefRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 14 },
  prefRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  prefIcon: { fontSize: 18, width: 30 },
  prefLabel: { fontSize: 14, fontWeight: '600', color: Colors.textMid, flex: 1 },
  prefValue: { fontSize: 14, fontWeight: '700', color: Colors.text, maxWidth: '55%', textAlign: 'right' },

  editPrefBtn: {
    backgroundColor: Colors.cardGreen, borderRadius: 16,
    paddingVertical: 16, alignItems: 'center', ...shadow.sm,
  },
  editPrefBtnText: { color: Colors.primary, fontWeight: '800', fontSize: 14 },
});
