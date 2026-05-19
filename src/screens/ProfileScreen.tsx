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
import { UserPreferences, DEFAULT_PREFERENCES } from '../types/preferences';
import { Colors, shadow } from '../constants/colors';
import { haptic } from '../services/haptics';

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
    haptic.success();
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

      <LinearGradient colors={['#F6E0B5', Colors.cream]} locations={[0, 0.7]} style={styles.hero}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← 돌아가기</Text>
        </TouchableOpacity>
        <Image source={require('../../assets/main_logo.png')} style={styles.heroLogo} resizeMode="contain" />
        <Text style={styles.heroSub}>내 정보</Text>
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
          <View style={[styles.statCard, { backgroundColor: Colors.forestSoft }]}>
            <Text style={styles.statValue}>{savedCount}</Text>
            <Text style={styles.statLabel}>저장된 레시피</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: Colors.orangeSoft }]}>
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

  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statCard: { flex: 1, borderRadius: 20, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: Colors.lineSoft, ...shadow.sm },
  statValue: { fontSize: 36, fontWeight: '900', color: Colors.ink, marginBottom: 4 },
  statLabel: { fontSize: 12, color: Colors.inkSoft, fontWeight: '700' },

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
