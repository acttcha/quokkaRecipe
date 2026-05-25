import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  StatusBar, Image, ImageBackground, ActivityIndicator, Alert,
} from 'react-native';
import { NavProps } from '../types';
import { Colors, shadow } from '../constants/colors';
import { identifyReceiptItems } from '../services/claude';
import { addIngredients } from '../services/fridge';
import { recordUsage } from '../services/usage';
import { checkUsageOrAlert } from '../services/usageGate';

interface Props extends NavProps {
  imageBase64: string;
  mimeType: string;
}

export default function ReceiptScanScreen({ navigate, goBack, imageBase64, mimeType }: Props) {
  const [loading, setLoading]   = useState(true);
  const [items, setItems]       = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  const scan = useCallback(async () => {
    if (!await checkUsageOrAlert('scan')) {
      goBack();
      return;
    }
    setLoading(true);
    setError('');
    try {
      const found = await identifyReceiptItems(imageBase64, mimeType);
      await recordUsage('scan');
      setItems(found);
      setSelected(new Set(found));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [imageBase64, mimeType, goBack]);

  useEffect(() => { scan(); }, [scan]);

  const toggle = (item: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(item)) next.delete(item); else next.add(item);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(selected.size === items.length ? new Set() : new Set(items));
  };

  const handleConfirm = async () => {
    if (selected.size === 0) {
      Alert.alert('앗!', '추가할 재료를 선택해주세요');
      return;
    }
    setSaving(true);
    try {
      await addIngredients(Array.from(selected));
      navigate({ name: 'Fridge' });
    } catch (e) {
      Alert.alert('오류', String(e));
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <ImageBackground source={require('../../assets/background.png')} style={styles.hero} resizeMode="cover">
        <View style={styles.heroOverlay}>
          <TouchableOpacity style={styles.backBtn} onPress={goBack}>
            <Text style={styles.backBtnText}>← 다시 찍기</Text>
          </TouchableOpacity>
          <Image source={require('../../assets/main_logo.png')} style={styles.heroLogo} resizeMode="contain" />
          <Text style={styles.heroSub}>🧾 영수증 스캔 결과</Text>
        </View>
      </ImageBackground>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>

        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={Colors.accent} style={{ marginBottom: 16 }} />
            <Text style={styles.centerTitle}>영수증 분석 중...</Text>
            <Text style={styles.centerSub}>AI가 식재료를 추출하고 있어요 🤖</Text>
          </View>

        ) : error ? (
          <View style={styles.centerBox}>
            <Text style={styles.centerEmoji}>😵</Text>
            <Text style={styles.centerTitle}>분석에 실패했어요</Text>
            <Text style={styles.centerSub}>{error}</Text>
            <TouchableOpacity style={styles.actionBtn} onPress={scan}>
              <Text style={styles.actionBtnText}>다시 시도</Text>
            </TouchableOpacity>
          </View>

        ) : items.length === 0 ? (
          <View style={styles.centerBox}>
            <Text style={styles.centerEmoji}>🔍</Text>
            <Text style={styles.centerTitle}>식재료를 찾지 못했어요</Text>
            <Text style={styles.centerSub}>영수증 전체가 잘 보이도록{'\n'}다시 촬영해보세요</Text>
            <TouchableOpacity style={styles.actionBtn} onPress={goBack}>
              <Text style={styles.actionBtnText}>다시 찍기</Text>
            </TouchableOpacity>
          </View>

        ) : (
          <>
            <View style={styles.headerRow}>
              <View>
                <Text style={styles.sectionHead}>{items.length}개 식재료 발견</Text>
                <Text style={styles.sectionSub}>추가할 재료를 선택하세요</Text>
              </View>
              <TouchableOpacity style={styles.toggleAllBtn} onPress={toggleAll}>
                <Text style={styles.toggleAllText}>
                  {selected.size === items.length ? '전체 해제' : '전체 선택'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.chipGrid}>
              {items.map(item => {
                const active = selected.has(item);
                return (
                  <TouchableOpacity
                    key={item}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => toggle(item)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{item}</Text>
                    <Text style={[styles.chipIcon, active && styles.chipIconActive]}>
                      {active ? '✓' : '+'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      {!loading && !error && items.length > 0 && (
        <View style={styles.footer}>
          <TouchableOpacity style={styles.cancelBtn} onPress={goBack}>
            <Text style={styles.cancelBtnText}>취소</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.confirmBtn, (saving || selected.size === 0) && styles.confirmBtnDisabled]}
            onPress={handleConfirm}
            disabled={saving || selected.size === 0}
          >
            <Text style={styles.confirmBtnText}>
              {saving ? '추가 중...' : `냉장고에 추가  (${selected.size}개)`}
            </Text>
          </TouchableOpacity>
        </View>
      )}
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
  backBtn:     { marginBottom: 10 },
  backBtnText: { color: Colors.primary, fontSize: 14, fontWeight: '700' },
  heroLogo:    { width: '100%', height: 52, marginBottom: 6 },
  heroSub:     { fontSize: 13, color: Colors.textMid, textAlign: 'center' },

  body:        { flex: 1 },
  bodyContent: { padding: 20, paddingBottom: 32 },

  centerBox: {
    alignItems: 'center', paddingVertical: 52,
    backgroundColor: Colors.card, borderRadius: 24, ...shadow.sm,
  },
  centerEmoji: { fontSize: 48, marginBottom: 12 },
  centerTitle: { fontSize: 17, fontWeight: '800', color: Colors.text, marginBottom: 8 },
  centerSub:   { fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  actionBtn: {
    backgroundColor: Colors.accent, borderRadius: 14,
    paddingHorizontal: 28, paddingVertical: 12,
  },
  actionBtnText: { color: '#FFF', fontWeight: '800', fontSize: 14 },

  headerRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sectionHead:  { fontSize: 16, fontWeight: '800', color: Colors.text },
  sectionSub:   { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  toggleAllBtn: { backgroundColor: Colors.cardGreen, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 7 },
  toggleAllText:{ fontSize: 12, fontWeight: '700', color: Colors.primary },

  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.card, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1.5, borderColor: Colors.border,
    ...shadow.sm,
  },
  chipActive:     { backgroundColor: Colors.cardGreen, borderColor: Colors.accent },
  chipText:       { fontSize: 14, fontWeight: '600', color: Colors.textMuted },
  chipTextActive: { color: Colors.primary, fontWeight: '700' },
  chipIcon:       { fontSize: 13, color: Colors.textMuted },
  chipIconActive: { color: Colors.accent, fontWeight: '800' },

  footer: {
    flexDirection: 'row', gap: 10,
    padding: 20, paddingBottom: 36, backgroundColor: Colors.bg,
  },
  cancelBtn: {
    paddingVertical: 16, paddingHorizontal: 20, borderRadius: 18,
    backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  cancelBtnText:        { fontSize: 15, fontWeight: '700', color: Colors.textMid },
  confirmBtn:           { flex: 1, backgroundColor: Colors.accent, borderRadius: 18, paddingVertical: 16, alignItems: 'center', ...shadow.md },
  confirmBtnDisabled:   { backgroundColor: Colors.textMuted },
  confirmBtnText:       { color: '#FFF', fontWeight: '900', fontSize: 15 },
});
