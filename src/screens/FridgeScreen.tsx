import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  StatusBar, TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { NavProps } from '../types';
import { Colors, shadow } from '../constants/colors';
import { getFridgeIngredients, addIngredient, removeIngredient, clearFridge } from '../services/fridge';
import { haptic } from '../services/haptics';
import { filterPopularIngredients } from '../constants/ingredients';
import { t } from '../i18n';

function IconCamera() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M4 8.5h3l1.5-2h7L17 8.5h3a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 18v-8A1.5 1.5 0 0 1 4 8.5Z"
        stroke={Colors.forestDeep} strokeWidth={1.7} strokeLinejoin="round" />
      <Circle cx={12} cy={13.5} r={3.2} stroke={Colors.forestDeep} strokeWidth={1.7} />
    </Svg>
  );
}

function IconReceipt() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M6 3.5h12v17l-2-1.2-2 1.2-2-1.2-2 1.2-2-1.2-2 1.2v-17Z"
        stroke={Colors.orangeDeep} strokeWidth={1.7} strokeLinejoin="round" />
      <Line x1={9} y1={8} x2={15} y2={8} stroke={Colors.orangeDeep} strokeWidth={1.5} strokeLinecap="round" />
      <Line x1={9} y1={11.5} x2={15} y2={11.5} stroke={Colors.orangeDeep} strokeWidth={1.5} strokeLinecap="round" />
      <Line x1={9} y1={15} x2={13} y2={15} stroke={Colors.orangeDeep} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

function IconClose() {
  return (
    <Svg width={9} height={9} viewBox="0 0 14 14" fill="none">
      <Path d="M3 3l8 8M11 3l-8 8" stroke={Colors.orangeDeep} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

function IconPan() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Circle cx={11} cy={13} r={6} stroke="#fff" strokeWidth={1.7} />
      <Path d="M17 13h4.5" stroke="#fff" strokeWidth={1.7} strokeLinecap="round" />
      <Circle cx={9} cy={12} r={1.2} fill="#fff" />
      <Circle cx={12} cy={11} r={1} fill="#fff" />
    </Svg>
  );
}

function IconPlus() {
  return (
    <Svg width={14} height={14} viewBox="0 0 18 18" fill="none">
      <Path d="M9 3v12M3 9h12" stroke="#fff" strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export default function FridgeScreen({ navigate }: NavProps) {
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [input, setInput] = useState('');

  const load = useCallback(async () => {
    setIngredients(await getFridgeIngredients());
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    haptic.light();
    await addIngredient(trimmed);
    setInput('');
    await load();
  };

  const handleAddDirect = async (item: string) => {
    haptic.light();
    setInput('');
    await addIngredient(item);
    await load();
  };

  const suggestions = filterPopularIngredients(input, ingredients);

  const handleRemove = async (item: string) => {
    await removeIngredient(item);
    await load();
  };

  const handleClear = () => {
    Alert.alert(t('fridge.clearTitle'), t('fridge.clearMessage'), [
      { text: t('fridge.cancel'), style: 'cancel' },
      {
        text: t('fridge.clearConfirm'), style: 'destructive',
        onPress: async () => { await clearFridge(); await load(); },
      },
    ]);
  };

  const handleMakeRecipe = () => {
    if (ingredients.length === 0) {
      Alert.alert(t('fridge.noIngredientsTitle'), t('fridge.noIngredientsMessage'));
      return;
    }
    navigate({ name: 'FridgeRecipes', ingredients });
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* Header */}
      <LinearGradient colors={['#F6E0B5', Colors.cream]} locations={[0, 0.7]} style={styles.header}>
        <View style={styles.headerSpacer} />
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>{t('fridge.headerTitle')}</Text>
          <Text style={styles.headerSub}>
            {ingredients.length > 0 ? t('fridge.headerCount', { count: ingredients.length }) : t('fridge.headerEmpty')}
          </Text>
        </View>
        <View style={styles.headerHairline} />
      </LinearGradient>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* 스캔 타일 (상단으로 이동 — 빈 냉장고에서도 잘 보이게) */}
        <View style={styles.tileRow}>
          <TouchableOpacity
            style={styles.tile}
            onPress={() => navigate({ name: 'Camera', fridgeMode: true })}
            activeOpacity={0.85}
          >
            <View style={[styles.tileIcon, styles.tileIconGreen]}>
              <IconCamera />
            </View>
            <View>
              <Text style={styles.tileTitle}>{t('fridge.scanIngredients')}</Text>
              <Text style={styles.tileSub}>{t('fridge.scanIngredientsSub')}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.tile}
            onPress={() => navigate({ name: 'Camera', receiptMode: true })}
            activeOpacity={0.85}
          >
            <View style={[styles.tileIcon, styles.tileIconOrange]}>
              <IconReceipt />
            </View>
            <View>
              <Text style={styles.tileTitle}>{t('fridge.scanReceipt')}</Text>
              <Text style={styles.tileSub}>{t('fridge.scanReceiptSub')}</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* 직접 추가 */}
        <Text style={styles.addLabel}>{t('fridge.addLabel')}</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder={t('fridge.inputPlaceholder')}
            placeholderTextColor={Colors.inkMute}
            returnKeyType="done"
            onSubmitEditing={handleAdd}
          />
          <TouchableOpacity style={styles.addBtn} onPress={handleAdd} activeOpacity={0.85}>
            <IconPlus />
            <Text style={styles.addBtnText}>{t('fridge.addBtn')}</Text>
          </TouchableOpacity>
        </View>
        {suggestions.length > 0 && (
          <View style={styles.suggestWrap}>
            {suggestions.map(item => (
              <TouchableOpacity
                key={item}
                style={styles.suggestChip}
                onPress={() => handleAddDirect(item)}
              >
                <Text style={styles.suggestChipText}>+ {item}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* 재료 카드 */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>
              {t('fridge.listTitle')}{'  '}
              {ingredients.length > 0 && (
                <Text style={styles.cardCount}>{ingredients.length}</Text>
              )}
            </Text>
            {ingredients.length > 0 && (
              <TouchableOpacity onPress={handleClear}>
                <Text style={styles.clearText}>{t('fridge.clearAll')}</Text>
              </TouchableOpacity>
            )}
          </View>

          {ingredients.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>🧊</Text>
              <Text style={styles.emptyText}>{t('fridge.emptyTitle')}</Text>
              <Text style={styles.emptySub}>{t('fridge.emptySub')}</Text>
            </View>
          ) : (
            <View style={styles.chipGrid}>
              {ingredients.map(item => (
                <View key={item} style={styles.chip}>
                  <Text style={styles.chipText}>{item}</Text>
                  <TouchableOpacity
                    style={styles.chipClose}
                    onPress={() => handleRemove(item)}
                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
                  >
                    <IconClose />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

      </ScrollView>

      {/* CTA */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.ctaBtn, ingredients.length === 0 && styles.ctaBtnDisabled]}
          onPress={handleMakeRecipe}
          activeOpacity={0.85}
        >
          <IconPan />
          <Text style={styles.ctaBtnText}>{t('fridge.cta')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.cream },

  header: { height: 170 },
  headerSpacer: { flex: 1 },
  headerContent: { paddingHorizontal: 22, paddingBottom: 14 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: Colors.ink, letterSpacing: -0.6 },
  headerSub: { fontSize: 13, color: Colors.inkSoft, fontWeight: '500', marginTop: 4 },
  headerHairline: { height: 1, backgroundColor: Colors.line, opacity: 0.5 },

  body: { flex: 1 },
  bodyContent: { padding: 22, paddingBottom: 16, gap: 14 },

  card: {
    backgroundColor: Colors.white,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1, borderColor: Colors.lineSoft,
    ...shadow.sm,
  },
  cardHeaderRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 12,
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: Colors.ink },
  cardCount: { color: Colors.orangeDeep, fontWeight: '700' },
  clearText: { fontSize: 12, fontWeight: '600', color: Colors.danger },

  emptyBox: { alignItems: 'center', paddingVertical: 28 },
  emptyIcon: { fontSize: 40, marginBottom: 10 },
  emptyText: { fontSize: 15, fontWeight: '800', color: Colors.ink, marginBottom: 4 },
  emptySub: { fontSize: 12, color: Colors.inkMute, textAlign: 'center' },

  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.orangeSoft,
    borderRadius: 999,
    borderWidth: 1, borderColor: '#F2994A40',
    paddingLeft: 11, paddingRight: 6, paddingVertical: 7,
  },
  chipText: { fontSize: 13, fontWeight: '600', color: Colors.orangeDeep },
  chipClose: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: 'rgba(224,123,43,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },

  tileRow: { flexDirection: 'row', gap: 10 },
  tile: {
    flex: 1, backgroundColor: Colors.white, borderRadius: 18,
    padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: Colors.lineSoft, ...shadow.sm,
  },
  tileIcon: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  tileIconGreen: { backgroundColor: Colors.forestSoft, borderWidth: 1, borderColor: '#CFE5D6' },
  tileIconOrange: { backgroundColor: Colors.orangeSoft, borderWidth: 1, borderColor: '#F2994A40' },
  tileTitle: { fontSize: 13, fontWeight: '700', color: Colors.ink },
  tileSub: { fontSize: 11, color: Colors.inkSoft, fontWeight: '500', marginTop: 1 },

  addLabel: { fontSize: 13, fontWeight: '700', color: Colors.ink, marginBottom: 8 },
  inputRow: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1, height: 42, backgroundColor: Colors.white,
    borderRadius: 14, borderWidth: 1.5, borderColor: Colors.line,
    paddingHorizontal: 14, fontSize: 13, color: Colors.ink,
  },
  addBtn: {
    height: 42, backgroundColor: Colors.forest, borderRadius: 14,
    paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 5,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  suggestWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8, marginBottom: 4 },
  suggestChip: {
    backgroundColor: Colors.forestSoft,
    borderRadius: 999,
    borderWidth: 1, borderColor: '#3D8B5E40',
    paddingHorizontal: 12, paddingVertical: 7,
  },
  suggestChipText: { fontSize: 12, fontWeight: '700', color: Colors.forestDeep },

  footer: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 16, backgroundColor: Colors.cream },
  ctaBtn: {
    height: 56, backgroundColor: Colors.forest, borderRadius: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    shadowColor: Colors.forest, shadowOpacity: 0.32, shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 }, elevation: 6,
  },
  ctaBtnDisabled: { backgroundColor: Colors.inkMute, shadowOpacity: 0 },
  ctaBtnText: { color: '#fff', fontWeight: '800', fontSize: 16, letterSpacing: -0.4 },
});
