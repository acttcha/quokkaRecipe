import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
  KeyboardAvoidingView, Platform, StatusBar, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavProps, Recipe } from '../types';
import { Colors, shadow } from '../constants/colors';
import { addManualRecipe } from '../services/savedRecipes';
import { haptic } from '../services/haptics';
import { t } from '../i18n';

// 사용자가 직접 레시피를 작성해 저장하는 화면. (저장 레시피 편집 모달과 동일한 에디터)
const DIFF_LABEL: Record<'Easy' | 'Medium' | 'Hard', string> = {
  Easy: t('savedDetail.diffEasy'),
  Medium: t('savedDetail.diffMedium'),
  Hard: t('savedDetail.diffHard'),
};

export default function ManualRecipeScreen({ goBack }: NavProps) {
  const insets = useSafeAreaInsets();
  const [name, setName]             = useState('');
  const [desc, setDesc]             = useState('');
  const [cookTime, setCookTime]     = useState('');
  const [servings, setServings]     = useState('');
  const [difficulty, setDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Easy');
  const [ingredients, setIngredients] = useState<string[]>(['']);
  const [steps, setSteps]             = useState<string[]>(['']);
  const [saving, setSaving]           = useState(false);

  const handleSave = async () => {
    if (saving) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert(t('manual.nameRequiredTitle'), t('manual.nameRequiredMsg'));
      return;
    }
    setSaving(true);
    const recipe: Recipe = {
      name: trimmedName,
      description: desc.trim(),
      cookTime: cookTime.trim() || '-',
      servings: parseInt(servings) || 2,
      difficulty,
      ingredients: ingredients.map(s => s.trim()).filter(Boolean),
      steps: steps.map(s => s.trim()).filter(Boolean),
    };
    try {
      await addManualRecipe(recipe);
      haptic.success();
      goBack();
    } catch {
      setSaving(false);
      Alert.alert(t('manual.saveFailTitle'), t('manual.saveFailMsg'));
    }
  };

  return (
    <View style={styles.editRoot}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <View style={[styles.editNavBar, { paddingTop: insets.top + 12 }]}>
        <View style={[styles.editNavSide, { alignItems: 'flex-start' }]}>
          <TouchableOpacity style={styles.editNavCancel} onPress={goBack} activeOpacity={0.7}>
            <Text style={styles.editNavCancelText}>{t('savedDetail.cancel')}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.editNavTitle}>{t('manual.title')}</Text>
        <View style={[styles.editNavSide, { alignItems: 'flex-end' }]}>
          <TouchableOpacity onPress={handleSave} style={styles.editNavSave} disabled={saving} activeOpacity={0.85}>
            <Text style={styles.editNavSaveText}>{t('savedDetail.save')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.editContent, { paddingBottom: 40 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* 기본 정보 */}
          <Text style={styles.editSectionLabel}>{t('savedDetail.basicInfo')}</Text>
          <View style={styles.editCard}>
            <Text style={styles.editFieldLabel}>{t('savedDetail.dishName')}</Text>
            <TextInput style={styles.editInput} value={name} onChangeText={setName} placeholder={t('savedDetail.dishName')} placeholderTextColor={Colors.inkMute} />
            <View style={styles.editDivider} />
            <Text style={styles.editFieldLabel}>{t('savedDetail.descLabel')}</Text>
            <TextInput style={[styles.editInput, styles.editInputMulti]} value={desc} onChangeText={setDesc} placeholder={t('savedDetail.descPlaceholder')} placeholderTextColor={Colors.inkMute} multiline />
          </View>

          {/* 조리 정보 */}
          <Text style={styles.editSectionLabel}>{t('savedDetail.cookInfo')}</Text>
          <View style={styles.editCard}>
            <View style={styles.editRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.editFieldLabel}>{t('savedDetail.cookTimeLabel')}</Text>
                <TextInput style={styles.editInput} value={cookTime} onChangeText={setCookTime} placeholder={t('savedDetail.cookTimePlaceholder')} placeholderTextColor={Colors.inkMute} />
              </View>
              <View style={styles.editRowDivider} />
              <View style={{ flex: 1 }}>
                <Text style={styles.editFieldLabel}>{t('savedDetail.servingsLabel')}</Text>
                <TextInput style={styles.editInput} value={servings} onChangeText={setServings} placeholder="2" placeholderTextColor={Colors.inkMute} keyboardType="number-pad" />
              </View>
            </View>
            <View style={styles.editDivider} />
            <Text style={styles.editFieldLabel}>{t('savedDetail.difficultyLabel')}</Text>
            <View style={styles.diffRow}>
              {(['Easy', 'Medium', 'Hard'] as const).map(d => (
                <TouchableOpacity
                  key={d}
                  style={[styles.diffPill, difficulty === d && styles.diffPillActive]}
                  onPress={() => setDifficulty(d)}
                >
                  <Text style={[styles.diffPillText, difficulty === d && styles.diffPillTextActive]}>
                    {DIFF_LABEL[d]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* 재료 */}
          <Text style={styles.editSectionLabel}>{t('savedDetail.ingredientsSection')}</Text>
          <View style={styles.editCard}>
            {ingredients.map((ing, i) => (
              <View key={i} style={styles.editListRow}>
                <TextInput
                  style={[styles.editInput, { flex: 1 }]}
                  value={ing}
                  onChangeText={v => setIngredients(prev => prev.map((x, j) => j === i ? v : x))}
                  placeholder={t('savedDetail.ingredientPlaceholder', { num: i + 1 })}
                  placeholderTextColor={Colors.inkMute}
                />
                <TouchableOpacity
                  style={styles.editListRemove}
                  onPress={() => setIngredients(prev => prev.length > 1 ? prev.filter((_, j) => j !== i) : prev)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.editListRemoveText}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={styles.editAddBtn} onPress={() => setIngredients(prev => [...prev, ''])}>
              <Text style={styles.editAddBtnText}>{t('savedDetail.addIngredient')}</Text>
            </TouchableOpacity>
          </View>

          {/* 만드는 법 */}
          <Text style={styles.editSectionLabel}>{t('savedDetail.stepsSection')}</Text>
          <View style={styles.editCard}>
            {steps.map((step, i) => (
              <View key={i} style={styles.editListRow}>
                <View style={styles.editStepNum}>
                  <Text style={styles.editStepNumText}>{i + 1}</Text>
                </View>
                <TextInput
                  style={[styles.editInput, { flex: 1 }]}
                  value={step}
                  onChangeText={v => setSteps(prev => prev.map((x, j) => j === i ? v : x))}
                  placeholder={t('savedDetail.stepPlaceholder', { num: i + 1 })}
                  placeholderTextColor={Colors.inkMute}
                  multiline
                />
                <TouchableOpacity
                  style={styles.editListRemove}
                  onPress={() => setSteps(prev => prev.length > 1 ? prev.filter((_, j) => j !== i) : prev)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.editListRemoveText}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={styles.editAddBtn} onPress={() => setSteps(prev => [...prev, ''])}>
              <Text style={styles.editAddBtnText}>{t('savedDetail.addStep')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  editRoot: { flex: 1, backgroundColor: Colors.cream },
  editNavBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, paddingBottom: 14,
    backgroundColor: Colors.cream, borderBottomWidth: 1, borderBottomColor: Colors.line,
  },
  editNavSide: { width: 72, justifyContent: 'center' },
  editNavCancel: {
    width: 60, height: 34,
    borderWidth: 1.5, borderColor: Colors.line, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  editNavCancelText: { fontSize: 14, fontWeight: '800', color: Colors.inkSoft },
  editNavTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: Colors.ink, textAlign: 'center' },
  editNavSave: {
    width: 60, height: 34,
    backgroundColor: Colors.forest, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  editNavSaveText: { fontSize: 14, fontWeight: '800', color: '#fff' },

  editContent: { padding: 20, gap: 8 },
  editSectionLabel: { fontSize: 11, fontWeight: '700', color: Colors.inkMute, letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 8, marginBottom: 6, paddingHorizontal: 2 },
  editCard: { backgroundColor: Colors.white, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: Colors.lineSoft, ...shadow.sm },
  editFieldLabel: { fontSize: 11, fontWeight: '700', color: Colors.inkMute, marginBottom: 6 },
  editInput: {
    fontSize: 14, color: Colors.ink, paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: Colors.line,
  },
  editInputMulti: { minHeight: 60, textAlignVertical: 'top', lineHeight: 20 },
  editDivider: { height: 1, backgroundColor: Colors.line, opacity: 0.5, marginVertical: 14 },
  editRow: { flexDirection: 'row', gap: 12 },
  editRowDivider: { width: 1, backgroundColor: Colors.line, opacity: 0.5, marginHorizontal: 4 },

  diffRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  diffPill: {
    flex: 1, paddingVertical: 8, borderRadius: 12,
    backgroundColor: Colors.creamSoft, borderWidth: 1, borderColor: Colors.line,
    alignItems: 'center',
  },
  diffPillActive: { backgroundColor: Colors.forest, borderColor: Colors.forest },
  diffPillText: { fontSize: 13, fontWeight: '700', color: Colors.inkSoft },
  diffPillTextActive: { color: '#fff' },

  editListRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  editListRemove: { padding: 4 },
  editListRemoveText: { fontSize: 22, color: Colors.inkMute, lineHeight: 24 },
  editStepNum: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: Colors.orangeSoft, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  editStepNumText: { fontSize: 12, fontWeight: '900', color: Colors.orangeDeep },
  editAddBtn: { paddingVertical: 10, alignItems: 'center', borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.inkMute, marginTop: 4 },
  editAddBtnText: { fontSize: 13, fontWeight: '700', color: Colors.inkMute },
});
