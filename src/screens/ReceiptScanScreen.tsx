import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  StatusBar, Image, ImageBackground, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavProps } from '../types';
import { Colors, shadow } from '../constants/colors';
import { BackButton } from '../components/BackButton';
import { identifyReceiptItems } from '../services/claude';
import { addIngredients } from '../services/fridge';
import { checkLeafOrAlert } from '../services/leafGate';
import { t } from '../i18n';

interface Props extends NavProps {
  imageBase64: string;
  mimeType: string;
}

export default function ReceiptScanScreen({ navigate, goBack, imageBase64, mimeType }: Props) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading]   = useState(true);
  const [items, setItems]       = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  const scan = useCallback(async () => {
    if (!await checkLeafOrAlert('scan')) {
      goBack();
      return;
    }
    setLoading(true);
    setError('');
    try {
      const found = await identifyReceiptItems(imageBase64, mimeType);
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
      Alert.alert(t('scan.receiptScan.alertOopsTitle'), t('scan.receiptScan.alertSelectMsg'));
      return;
    }
    setSaving(true);
    try {
      await addIngredients(Array.from(selected));
      navigate({ name: 'Fridge' });
    } catch (e) {
      Alert.alert(t('scan.receiptScan.alertErrorTitle'), String(e));
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <ImageBackground source={require('../../assets/background.png')} style={styles.hero} resizeMode="cover">
        <View style={styles.heroOverlay}>
          <BackButton onPress={goBack} label={t('scan.receiptScan.backRetake')} style={styles.backBtn} />
          <Image source={require('../../assets/main_logo.png')} style={styles.heroLogo} resizeMode="contain" />
          <Text style={styles.heroSub}>{t('scan.receiptScan.heroSub')}</Text>
        </View>
      </ImageBackground>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>

        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={Colors.accent} style={{ marginBottom: 16 }} />
            <Text style={styles.centerTitle}>{t('scan.receiptScan.loadingTitle')}</Text>
            <Text style={styles.centerSub}>{t('scan.receiptScan.loadingSub')}</Text>
          </View>

        ) : error ? (
          <View style={styles.centerBox}>
            <Text style={styles.centerEmoji}>😵</Text>
            <Text style={styles.centerTitle}>{t('scan.receiptScan.failTitle')}</Text>
            <Text style={styles.centerSub}>{error}</Text>
            <TouchableOpacity style={styles.actionBtn} onPress={scan}>
              <Text style={styles.actionBtnText}>{t('scan.receiptScan.retry')}</Text>
            </TouchableOpacity>
          </View>

        ) : items.length === 0 ? (
          <View style={styles.centerBox}>
            <Text style={styles.centerEmoji}>🔍</Text>
            <Text style={styles.centerTitle}>{t('scan.receiptScan.notFoundTitle')}</Text>
            <Text style={styles.centerSub}>{t('scan.receiptScan.notFoundSub')}</Text>
            <TouchableOpacity style={styles.actionBtn} onPress={goBack}>
              <Text style={styles.actionBtnText}>{t('scan.receiptScan.retake')}</Text>
            </TouchableOpacity>
          </View>

        ) : (
          <>
            <View style={styles.headerRow}>
              <View>
                <Text style={styles.sectionHead}>{t('scan.receiptScan.foundCount', { count: items.length })}</Text>
                <Text style={styles.sectionSub}>{t('scan.receiptScan.selectPrompt')}</Text>
              </View>
              <TouchableOpacity style={styles.toggleAllBtn} onPress={toggleAll}>
                <Text style={styles.toggleAllText}>
                  {selected.size === items.length ? t('scan.receiptScan.deselectAll') : t('scan.receiptScan.selectAll')}
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
        <View style={[styles.footer, { paddingBottom: 16 + Math.max(insets.bottom, 12) }]}>
          <TouchableOpacity style={styles.cancelBtn} onPress={goBack}>
            <Text style={styles.cancelBtnText}>{t('scan.receiptScan.cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.confirmBtn, (saving || selected.size === 0) && styles.confirmBtnDisabled]}
            onPress={handleConfirm}
            disabled={saving || selected.size === 0}
          >
            <Text style={styles.confirmBtnText}>
              {saving ? t('scan.receiptScan.adding') : t('scan.receiptScan.addToFridge', { count: selected.size })}
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

  // paddingBottom 은 insets.bottom 으로 동적
  footer: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 20, paddingTop: 16, backgroundColor: Colors.bg,
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
