import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  StatusBar, Image, ImageBackground, ActivityIndicator, TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavProps } from '../types';
import { Colors, shadow } from '../constants/colors';
import { BackButton } from '../components/BackButton';
import { identifyIngredients } from '../services/claude';
import { addIngredients } from '../services/fridge';
import { spend } from '../services/leaves';
import { checkLeafOrAlert } from '../services/leafGate';
import { t } from '../i18n';

type Props = NavProps & { imageBase64: string; mimeType: string };
type Step = 'scanning' | 'review' | 'error';

export default function FridgeScanScreen({ navigate, goBack, imageBase64, mimeType }: Props) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('scanning');
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [newIng, setNewIng] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const scan = useCallback(async () => {
    if (!await checkLeafOrAlert('scan')) {
      goBack();
      return;
    }
    try {
      const found = await identifyIngredients(imageBase64, mimeType);
      await spend('scan');
      setIngredients(found);
      setStep('review');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setStep('error');
    }
  }, [imageBase64, mimeType, goBack]);

  useEffect(() => { scan(); }, [scan]);

  const handleAddIng = () => {
    const trimmed = newIng.trim();
    if (!trimmed || ingredients.includes(trimmed)) return;
    setIngredients(prev => [...prev, trimmed]);
    setNewIng('');
  };

  const handleRemove = (item: string) => {
    setIngredients(prev => prev.filter(i => i !== item));
  };

  const handleSave = async () => {
    await addIngredients(ingredients);
    navigate({ name: 'Fridge' });
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <ImageBackground source={require('../../assets/background.png')} style={styles.hero} resizeMode="cover">
        <View style={styles.heroOverlay}>
          <BackButton onPress={() => navigate({ name: 'Fridge' })} label={t('scan.fridgeScan.back')} style={styles.backBtn} />
          <Image source={require('../../assets/main_logo.png')} style={styles.heroLogo} resizeMode="contain" />
          <Text style={styles.heroSub}>{t('scan.fridgeScan.heroSub')}</Text>
        </View>
      </ImageBackground>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>

        {step === 'scanning' && (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={Colors.accent} />
            <Text style={styles.loadingText}>{t('scan.fridgeScan.loading')}</Text>
          </View>
        )}

        {step === 'error' && (
          <View style={styles.errorBox}>
            <Text style={styles.errorIcon}>😢</Text>
            <Text style={styles.errorText}>{errorMsg}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={scan}>
              <Text style={styles.retryBtnText}>{t('scan.fridgeScan.retry')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 'review' && (
          <>
            <Text style={styles.sectionHead}>{t('scan.fridgeScan.recognizedHead')}</Text>
            <Text style={styles.sectionSub}>{t('scan.fridgeScan.recognizedSub')}</Text>

            {ingredients.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>{t('scan.fridgeScan.emptyTitle')}</Text>
                <Text style={styles.emptyTextSub}>{t('scan.fridgeScan.emptySub')}</Text>
              </View>
            ) : (
              <View style={styles.chipGrid}>
                {ingredients.map(item => (
                  <View key={item} style={styles.chip}>
                    <Text style={styles.chipText}>{item}</Text>
                    <TouchableOpacity
                      onPress={() => handleRemove(item)}
                      hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
                    >
                      <Text style={styles.chipX}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <Text style={[styles.sectionHead, { marginTop: 28 }]}>{t('scan.fridgeScan.addHead')}</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={newIng}
                onChangeText={setNewIng}
                placeholder={t('scan.fridgeScan.inputPlaceholder')}
                placeholderTextColor={Colors.textMuted}
                returnKeyType="done"
                onSubmitEditing={handleAddIng}
              />
              <TouchableOpacity style={styles.addBtn} onPress={handleAddIng}>
                <Text style={styles.addBtnText}>{t('scan.fridgeScan.add')}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>

      {step === 'review' && (
        <View style={[styles.footer, { paddingBottom: 16 + Math.max(insets.bottom, 12) }]}>
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.85}>
            <Text style={styles.saveBtnText}>{t('scan.fridgeScan.saveToFridge')}</Text>
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
  backBtn: { marginBottom: 10 },
  heroLogo: { width: '100%', height: 52, marginBottom: 6 },
  heroSub: { fontSize: 13, color: Colors.textMid, textAlign: 'center' },

  body: { flex: 1 },
  bodyContent: { padding: 20, paddingBottom: 20 },

  loadingBox: { alignItems: 'center', paddingVertical: 60, gap: 16 },
  loadingText: { fontSize: 15, fontWeight: '600', color: Colors.textMid },

  errorBox: { alignItems: 'center', paddingVertical: 40, gap: 14 },
  errorIcon: { fontSize: 48 },
  errorText: { fontSize: 14, color: Colors.coral, textAlign: 'center' },
  retryBtn: { backgroundColor: Colors.accent, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12 },
  retryBtnText: { color: '#FFF', fontWeight: '800', fontSize: 14 },

  sectionHead: { fontSize: 15, fontWeight: '800', color: Colors.text, marginBottom: 6 },
  sectionSub: { fontSize: 12, color: Colors.textMuted, marginBottom: 16 },

  emptyBox: { backgroundColor: Colors.card, borderRadius: 16, padding: 28, alignItems: 'center', ...shadow.sm },
  emptyText: { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  emptyTextSub: { fontSize: 13, color: Colors.textMuted },

  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.cardGreen, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 9,
  },
  chipText: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  chipX: { fontSize: 18, color: Colors.primaryMid, fontWeight: '800', lineHeight: 20 },

  inputRow: { flexDirection: 'row', gap: 10 },
  input: {
    flex: 1, backgroundColor: Colors.card, borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 13,
    fontSize: 15, color: Colors.text, ...shadow.sm,
  },
  addBtn: {
    backgroundColor: Colors.accent, borderRadius: 14,
    paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center',
  },
  addBtnText: { color: '#FFF', fontWeight: '800', fontSize: 14 },

  // paddingBottom 은 insets.bottom 으로 동적
  footer: { paddingHorizontal: 20, paddingTop: 16, backgroundColor: Colors.bg },
  saveBtn: {
    backgroundColor: Colors.primary, borderRadius: 20,
    paddingVertical: 18, alignItems: 'center', ...shadow.md,
  },
  saveBtnText: { color: '#FFF', fontWeight: '900', fontSize: 16 },
});
