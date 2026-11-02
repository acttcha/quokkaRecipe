import React, { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Image, StyleSheet, Platform, Alert } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { Recipe } from '../types';
import { Colors } from '../constants/colors';
import { t } from '../i18n';

// 레시피 공유 이미지 카드.
// 텍스트 공유는 받는 사람에게 앱이 드러나지 않아서, 공유될 때마다 앱 이름이 보이는 이미지를 추가했다(글 공유도 선택 가능).
// 화면 밖에 그린 카드를 찍어(view-shot) 이미지 파일로 공유한다.

const DIFF_KEY: Record<string, string> = { Easy: 'recipe.diffEasy', Medium: 'recipe.diffMedium', Hard: 'recipe.diffHard' };

const RecipeShareCard = forwardRef<View, { recipe: Recipe; onLogoLoad: () => void }>(({ recipe: r, onLogoLoad }, ref) => (
  <View ref={ref} collapsable={false} style={styles.card}>
    <View style={styles.brandRow}>
      <Image source={require('../../assets/applogo-512.png')} style={styles.logo} onLoad={onLogoLoad} />
      <Text style={styles.brand}>{t('shareCard.brand')}</Text>
    </View>

    <Text style={styles.name}>{r.name}</Text>
    {!!r.description && <Text style={styles.desc}>{r.description}</Text>}
    <View style={styles.chips}>
      <Text style={styles.chip}>⏱ {r.cookTime}</Text>
      <Text style={styles.chip}>👥 {t('recipe.servings', { n: r.servings })}</Text>
      <Text style={styles.chip}>{t(DIFF_KEY[r.difficulty] ?? 'recipe.diffMedium')}</Text>
    </View>

    <Text style={styles.section}>{t('recipe.shareIngredients')}</Text>
    <View style={styles.ingWrap}>
      {r.ingredients.map((x, i) => <Text key={i} style={styles.ing}>{x}</Text>)}
    </View>

    <Text style={styles.section}>{t('recipe.shareSteps')}</Text>
    {r.steps.map((s, i) => (
      <View key={i} style={styles.stepRow}>
        <Text style={styles.stepNum}>{i + 1}</Text>
        <Text style={styles.stepText}>{s}</Text>
      </View>
    ))}

    <View style={styles.footer}>
      <Text style={styles.footerTitle}>{t('shareCard.tagline')}</Text>
      <Text style={styles.footerSub}>{t('shareCard.storeHint')}</Text>
    </View>
  </View>
));

/**
 * 공유 훅. share(recipe) 를 부르면 이미지/글 중 고르게 하고, 이미지면 카드를 화면 밖에 그려 찍어 공유 시트를 연다.
 * 반환한 card 를 화면 루트 View 안에 넣는다. fallback 은 글 공유이자 이미지 실패 시 대체 경로다.
 * 화면 밖 뷰도 찍히게 iOS 는 renderInContext(창 합성과 무관하게 레이어를 직접 그림)를 쓰고,
 * 안드로이드는 원래 뷰를 직접 그리므로 위치와 상관없다.
 * 이미지 공유가 안 되는 환경이면 fallback(기존 텍스트 공유)으로 넘어간다.
 */
export function useRecipeShare(fallback: (r: Recipe) => Promise<void> | void) {
  const [target, setTarget] = useState<Recipe | null>(null);
  const cardRef = useRef<View>(null);
  const started = useRef(false);
  // 부모가 다시 그려질 때마다 fallback 이 바뀌어 타이머가 밀리지 않게 ref 로 둔다
  const fallbackRef = useRef(fallback);
  fallbackRef.current = fallback;

  const capture = useCallback(async () => {
    if (started.current || !target) return;
    started.current = true;
    try {
      if (!(await Sharing.isAvailableAsync())) throw new Error('sharing unavailable');
      const uri = await captureRef(cardRef, {
        format: 'png', quality: 1, result: 'tmpfile', useRenderInContext: Platform.OS === 'ios',
      });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: target.name });
    } catch {
      await fallbackRef.current(target);
    } finally {
      setTarget(null);
    }
  }, [target]);

  // 로고 이미지가 그려진 뒤 찍는다. onLoad 가 안 오는 경우를 대비해 잠시 뒤 그냥 찍는다.
  useEffect(() => {
    if (!target) return;
    const id = setTimeout(capture, 1200);
    return () => clearTimeout(id);
  }, [target, capture]);

  const onLogoLoad = useCallback(() => { setTimeout(capture, 100); }, [capture]);

  const shareImage = useCallback((r: Recipe) => {
    if (target) return;  // 공유 중 중복 탭 무시
    started.current = false;
    setTarget(r);
  }, [target]);

  // 이미지(카톡·인스타에 보여주기, 앱 이름이 같이 퍼짐) / 글(복사해서 메모·장보기에 쓰기) 중 고르게 한다.
  // 이미지를 먼저 보여준다. 안드로이드 Alert 은 버튼이 가로로 [중립][부정][긍정] 순이라 순서를 따로 둔다.
  const share = useCallback((r: Recipe) => {
    const image = { text: t('shareCard.asImage'), onPress: () => shareImage(r) };
    const text = { text: t('shareCard.asText'), onPress: () => { fallbackRef.current(r); } };
    const cancel = { text: t('common.cancel'), style: 'cancel' as const };
    Alert.alert(t('shareCard.chooseTitle'), undefined,
      Platform.OS === 'android' ? [cancel, text, image] : [image, text, cancel],
      { cancelable: true });
  }, [shareImage]);

  const card = target ? (
    <View style={styles.hidden} pointerEvents="none">
      <RecipeShareCard ref={cardRef} recipe={target} onLogoLoad={onLogoLoad} />
    </View>
  ) : null;

  return { share, card, sharing: !!target };
}

const styles = StyleSheet.create({
  hidden: { position: 'absolute', top: 0, left: -10000 },
  card: { width: 360, backgroundColor: Colors.cream, padding: 24, paddingBottom: 0 },

  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 18 },
  logo: { width: 32, height: 32, borderRadius: 8 },
  brand: { fontSize: 15, fontWeight: '900', color: Colors.forestDeep, letterSpacing: -0.3 },

  name: { fontSize: 24, fontWeight: '900', color: Colors.ink, letterSpacing: -0.6, lineHeight: 31 },
  desc: { fontSize: 13.5, color: Colors.inkSoft, fontWeight: '500', lineHeight: 20, marginTop: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  chip: {
    fontSize: 12, fontWeight: '700', color: Colors.ink, backgroundColor: Colors.creamSoft,
    borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4, overflow: 'hidden',
  },

  section: { fontSize: 15, fontWeight: '800', color: Colors.ink, marginTop: 22, marginBottom: 10 },
  ingWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  ing: {
    fontSize: 12.5, fontWeight: '600', color: Colors.ink, backgroundColor: Colors.white,
    borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5, overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.line,
  },
  stepRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  stepNum: {
    width: 22, height: 22, borderRadius: 11, overflow: 'hidden',
    backgroundColor: Colors.forest, color: '#FFF', fontSize: 12, fontWeight: '800',
    textAlign: 'center', lineHeight: 22,
  },
  stepText: { flex: 1, fontSize: 13.5, color: Colors.ink, fontWeight: '500', lineHeight: 20 },

  footer: { backgroundColor: Colors.forest, marginHorizontal: -24, marginTop: 14, paddingVertical: 16, paddingHorizontal: 24 },
  footerTitle: { fontSize: 14, fontWeight: '800', color: '#FFF' },
  footerSub: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.85)', marginTop: 3 },
});
