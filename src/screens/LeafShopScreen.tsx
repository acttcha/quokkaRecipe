import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  StatusBar, Alert, Image, Modal, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { NavProps } from '../types';
import { Colors, shadow } from '../constants/colors';
import { BackButton } from '../components/BackButton';
import { LeafIcon } from '../components/LeafIcon';
import { LEAF_PACKAGES, LeafPackage, formatKrw, pricePerLeaf } from '../services/leafPackages';
import { getBalance, LeafBalance, PRO_MONTHLY_LEAVES, FREE_DAILY_LEAVES } from '../services/leaves';
import { isPurchasesReady, purchaseLeafPackage, purchaseSubscription, restorePurchases } from '../services/purchases';
import { isLoggedIn, isAuthReady, signInWithGoogle } from '../services/auth';
import { haptic } from '../services/haptics';
import { t } from '../i18n';

// 스토어 명 (자동갱신 고지·환불 안내에 사용). iOS=App Store / Android=Google Play.
const STORE_NAME = Platform.select({ ios: 'App Store', android: 'Google Play' }) ?? 'App Store';

export default function LeafShopScreen({ goBack }: NavProps) {
  const [balance, setBalance] = useState<LeafBalance | null>(null);
  // 약관/개인정보 인앱 모달 (구독 화면에 링크 필수 — App Store 가이드라인 3.1.2)
  const [infoModal, setInfoModal] = useState<'terms' | 'privacy' | null>(null);

  const load = useCallback(async () => {
    setBalance(await getBalance());
  }, []);
  useEffect(() => { load(); }, [load]);

  // 게스트면 결제 전 로그인 권유(강제 아님). 이미 로그인했거나 로그인 불가면 바로 진행.
  const withLoginNudge = (proceed: () => void) => {
    if (isLoggedIn() || !isAuthReady()) { proceed(); return; }
    Alert.alert(
      t('leafShop.loginNudgeTitle'),
      t('leafShop.loginNudgeMsg'),
      [
        {
          text: t('leafShop.loginAndBuy'),
          onPress: async () => {
            try { await signInWithGoogle(); await load(); proceed(); }
            catch (e: any) {
              if (!e?.message?.includes('cancel')) {
                Alert.alert(t('profile.loginFailTitle'), e?.message || t('profile.loginFailMsg'));
              }
            }
          },
        },
        { text: t('leafShop.buyAsGuest'), onPress: proceed },
        { text: t('leafShop.cancel'), style: 'cancel' },
      ],
    );
  };

  const doPurchase = async (pkg: LeafPackage) => {
    try {
      const ok = await purchaseLeafPackage(pkg.id);
      if (ok) {
        haptic.success();
        await load();
        Alert.alert(t('leafShop.purchaseDoneTitle'), t('leafShop.purchaseDoneMsg', { count: pkg.leaves }), [{ text: t('leafShop.ok') }]);
      }
    } catch (e: any) {
      Alert.alert(t('leafShop.purchaseFailTitle'), e?.message || t('leafShop.purchaseFailMsg'), [{ text: t('leafShop.ok') }]);
    }
  };

  const handlePurchase = (pkg: LeafPackage) => {
    haptic.light();
    if (!isPurchasesReady()) {
      Alert.alert(
        t('leafShop.comingSoonTitle'),
        t('leafShop.purchaseComingSoon', { name: t(`leafPackage.${pkg.id}`) }),
        [{ text: t('leafShop.ok') }],
      );
      return;
    }
    withLoginNudge(() => doPurchase(pkg));
  };

  const doSubscribe = async () => {
    try {
      const ok = await purchaseSubscription();
      if (ok) {
        haptic.success();
        await load();
        Alert.alert(t('leafShop.subscribeDoneTitle'), t('leafShop.subscribeDoneMsg', { count: PRO_MONTHLY_LEAVES }), [{ text: t('leafShop.ok') }]);
      }
    } catch (e: any) {
      Alert.alert(t('leafShop.purchaseFailTitle'), e?.message || t('leafShop.purchaseFailMsg'), [{ text: t('leafShop.ok') }]);
    }
  };

  const handleSubscribe = () => {
    haptic.light();
    if (!isPurchasesReady()) {
      Alert.alert(t('leafShop.comingSoonTitle'), t('leafShop.subscribeComingSoon'), [{ text: t('leafShop.ok') }]);
      return;
    }
    withLoginNudge(doSubscribe);
  };

  const handleRestore = async () => {
    haptic.light();
    if (!isPurchasesReady()) {
      Alert.alert(t('leafShop.comingSoonTitle'), t('leafShop.subscribeComingSoon'), [{ text: t('leafShop.ok') }]);
      return;
    }
    await restorePurchases();
    await load();
    Alert.alert(t('leafShop.restoreDoneTitle'), t('leafShop.restoreDoneMsg'), [{ text: t('leafShop.ok') }]);
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* Header */}
      <LinearGradient colors={['#F6E0B5', Colors.cream]} locations={[0, 0.7]} style={styles.header}>
        <BackButton onPress={goBack} label={t('leafShop.back')} style={styles.backBtn} />
        <Text style={styles.headerTitle}>{t('leafShop.title')}</Text>
        <Text style={styles.headerSub}>{t('leafShop.subtitle')}</Text>
      </LinearGradient>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>

        {/* 현재 잔액 카드 */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceRow}>
            <LeafIcon size={44} />
            <View style={styles.balanceTexts}>
              <Text style={styles.balanceLabel}>{t('leafShop.currentBalance')}</Text>
              <Text style={styles.balanceValue}>
                {balance ? `${balance.total}🍃` : '·'}
              </Text>
            </View>
          </View>
          {balance && (
            <Text style={styles.balanceBreakdown}>
              {t('leafShop.balanceBreakdown', { daily: balance.daily, bonus: balance.bonus })}
            </Text>
          )}
        </View>

        {/* 쿼카 패스 (구독) — 최상단 강조 */}
        <Text style={styles.sectionLabel}>{t('leafShop.dailyUseSection')}</Text>
        <TouchableOpacity style={styles.subCard} onPress={handleSubscribe} activeOpacity={0.85}>
          <Image
            source={require('../../assets/quokka_pass.webp')}
            style={styles.subBgImage}
            resizeMode="contain"
          />
          <View style={styles.subBadge}>
            <Text style={styles.subBadgeText}>PRO</Text>
          </View>
          <Text style={styles.subTitle}>{t('leafShop.passTitle')}</Text>
          <Text style={styles.subPrice}>₩4,900<Text style={styles.subPricePer}>{t('leafShop.perMonth')}</Text></Text>
          <View style={styles.subBenefits}>
            <Text style={styles.subBenefit}>{t('leafShop.benefitMonthlyLeaves', { n: PRO_MONTHLY_LEAVES })}</Text>
            <Text style={styles.subBenefit}>{t('leafShop.benefitNoAds')}</Text>
            <Text style={styles.subBenefit}>{t('leafShop.benefitAllPersonas')}</Text>
            <Text style={styles.subBenefit}>{t('leafShop.benefitChefStyle')}</Text>
          </View>
          <View style={styles.subHighlight}>
            <Text style={styles.subHighlightText}>
              {t('leafShop.subLeafHighlight', { total: PRO_MONTHLY_LEAVES + FREE_DAILY_LEAVES * 30 })}
            </Text>
          </View>
        </TouchableOpacity>

        {/* 자동 갱신 고지 (App Store 가이드라인 3.1.2 필수) */}
        <Text style={styles.autoRenewNotice}>
          {t('leafShop.autoRenewNotice', { store: STORE_NAME })}
        </Text>

        {/* 잎사귀 개별 충전 패키지 */}
        <Text style={[styles.sectionLabel, { marginTop: 10 }]}>{t('leafShop.packagesSection')}</Text>
        {LEAF_PACKAGES.map(pkg => (
          <TouchableOpacity
            key={pkg.id}
            style={[styles.pkgCard, pkg.featured && styles.pkgCardFeatured]}
            onPress={() => handlePurchase(pkg)}
            activeOpacity={0.85}
          >
            {pkg.featured && (
              <View style={styles.featuredBadge}>
                <Text style={styles.featuredBadgeText}>{t('leafShop.popular')}</Text>
              </View>
            )}
            <View style={styles.pkgLeft}>
              <Image source={pkg.image} style={styles.pkgImage} resizeMode="contain" />
              <View>
                <Text style={styles.pkgName}>{t(`leafPackage.${pkg.id}`)}</Text>
                <View style={styles.pkgLeavesRow}>
                  <LeafIcon size={18} />
                  <Text style={styles.pkgLeavesText}>{t('leafShop.leafCount', { n: pkg.leaves })}</Text>
                  {pkg.bonusPercent && (
                    <View style={styles.bonusChip}>
                      <Text style={styles.bonusChipText}>{t('leafShop.bonusPercent', { percent: pkg.bonusPercent })}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.pkgPerUnit}>{t('leafShop.perUnit', { price: pricePerLeaf(pkg) })}</Text>
              </View>
            </View>
            <View style={styles.pkgRight}>
              <Text style={styles.pkgPrice}>{formatKrw(pkg.price)}</Text>
              <View style={styles.pkgBuyBtn}>
                <Text style={styles.pkgBuyBtnText}>{t('leafShop.buy')}</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}

        {/* 구매 복원 */}
        <TouchableOpacity style={styles.restoreBtn} onPress={handleRestore} activeOpacity={0.7}>
          <Text style={styles.restoreText}>{t('leafShop.restore')}</Text>
        </TouchableOpacity>

        {/* 정책 안내 */}
        <View style={styles.policyBox}>
          <Text style={styles.policyText}>
            {t('leafShop.policy', { store: STORE_NAME })}
          </Text>
        </View>

        {/* 약관·개인정보 링크 (구독 화면 필수 — 가이드라인 3.1.2) */}
        <View style={styles.legalLinks}>
          <TouchableOpacity onPress={() => setInfoModal('terms')} activeOpacity={0.7}>
            <Text style={styles.legalLink}>{t('leafShop.terms')}</Text>
          </TouchableOpacity>
          <Text style={styles.legalDot}>·</Text>
          <TouchableOpacity onPress={() => setInfoModal('privacy')} activeOpacity={0.7}>
            <Text style={styles.legalLink}>{t('leafShop.privacy')}</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* 약관/개인정보 전문 모달 (설정과 동일한 내용 재사용) */}
      <Modal
        visible={!!infoModal}
        animationType="slide"
        onRequestClose={() => setInfoModal(null)}
      >
        <View style={styles.modalRoot}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {infoModal === 'privacy' ? t('settings.privacyTitle') : t('settings.termsTitle')}
            </Text>
            <TouchableOpacity onPress={() => setInfoModal(null)} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent}>
            <Text style={styles.modalText}>
              {infoModal === 'privacy' ? t('settings.privacyBody') : t('settings.termsBody')}
            </Text>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.cream },

  header: { paddingTop: 56, paddingHorizontal: 22, paddingBottom: 22 },
  backBtn: { marginBottom: 12 },
  headerTitle: { fontSize: 24, fontWeight: '900', color: Colors.ink, letterSpacing: -0.6 },
  headerSub: { fontSize: 13, color: Colors.inkSoft, fontWeight: '500', marginTop: 4 },

  body: { flex: 1 },
  bodyContent: { padding: 18, paddingBottom: 48, gap: 12 },

  balanceCard: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1, borderColor: Colors.lineSoft,
    ...shadow.sm,
  },
  balanceRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  balanceTexts: { flex: 1 },
  balanceLabel: { fontSize: 12, color: Colors.inkSoft, fontWeight: '600' },
  balanceValue: { fontSize: 24, fontWeight: '900', color: Colors.forest, marginTop: 2 },
  balanceBreakdown: { fontSize: 11, color: Colors.inkMute, fontWeight: '600', marginTop: 10, paddingLeft: 58 },

  sectionLabel: {
    fontSize: 12, fontWeight: '800', color: Colors.inkSoft,
    letterSpacing: 0.4, textTransform: 'uppercase',
    paddingLeft: 4, marginTop: 6, marginBottom: 2,
  },

  pkgCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.white,
    borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: Colors.lineSoft,
    ...shadow.sm,
    position: 'relative',
  },
  pkgCardFeatured: {
    borderColor: Colors.forest, borderWidth: 2,
    backgroundColor: '#F6FBF8',
  },
  featuredBadge: {
    position: 'absolute', top: -8, right: 14,
    backgroundColor: Colors.forest,
    borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  featuredBadgeText: { fontSize: 10, fontWeight: '900', color: '#FFF', letterSpacing: 0.4 },

  pkgLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  pkgImage: { width: 56, height: 56 },
  pkgName: { fontSize: 15, fontWeight: '800', color: Colors.ink },
  pkgLeavesRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  pkgLeavesText: { fontSize: 13, fontWeight: '700', color: Colors.forest },
  bonusChip: {
    backgroundColor: '#FFF8E1',
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
    marginLeft: 4,
    borderWidth: 1, borderColor: '#FCD34D',
  },
  bonusChipText: { fontSize: 10, fontWeight: '800', color: '#92400E' },
  pkgPerUnit: { fontSize: 11, color: Colors.inkMute, fontWeight: '600', marginTop: 3 },

  pkgRight: { alignItems: 'flex-end', gap: 6 },
  pkgPrice: { fontSize: 16, fontWeight: '900', color: Colors.ink },
  pkgBuyBtn: {
    backgroundColor: Colors.forest,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 6,
  },
  pkgBuyBtnText: { fontSize: 12, fontWeight: '800', color: '#FFF' },

  subCard: {
    backgroundColor: Colors.white,
    borderRadius: 20, padding: 18,
    borderWidth: 2, borderColor: '#D4A574',
    ...shadow.md,
    position: 'relative',
    overflow: 'hidden',
  },
  subBgImage: {
    position: 'absolute',
    right: -10, bottom: -10,
    width: 140, height: 140,
    opacity: 0.85,
  },
  subBadge: {
    position: 'absolute', top: 14, right: 14,
    backgroundColor: '#92400E', borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  subBadgeText: { fontSize: 10, fontWeight: '900', color: '#FEF3C7', letterSpacing: 0.5 },
  subTitle: { fontSize: 16, fontWeight: '800', color: Colors.ink },
  subPrice: { fontSize: 28, fontWeight: '900', color: Colors.ink, marginTop: 6 },
  subPricePer: { fontSize: 14, fontWeight: '700', color: Colors.inkSoft },
  subBenefits: { gap: 4, marginTop: 12 },
  subBenefit: { fontSize: 13, fontWeight: '600', color: Colors.inkSoft },
  subHighlight: {
    marginTop: 14, backgroundColor: Colors.forestSoft, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10, alignSelf: 'flex-start',
  },
  subHighlightText: { fontSize: 12.5, fontWeight: '800', color: Colors.forestDeep, lineHeight: 18 },

  autoRenewNotice: {
    fontSize: 11, color: Colors.inkMute, fontWeight: '500',
    lineHeight: 17, paddingHorizontal: 6, marginTop: 2, marginBottom: 4,
  },

  policyBox: {
    backgroundColor: Colors.creamSoft, borderRadius: 12,
    padding: 14, marginTop: 8,
  },
  policyText: { fontSize: 11, color: Colors.inkSoft, fontWeight: '500', lineHeight: 18 },
  restoreBtn: { alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 16 },
  restoreText: { fontSize: 13, fontWeight: '700', color: Colors.inkSoft, textDecorationLine: 'underline' },

  legalLinks: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginTop: 4, marginBottom: 8,
  },
  legalLink: { fontSize: 12, fontWeight: '700', color: Colors.inkSoft, textDecorationLine: 'underline' },
  legalDot: { fontSize: 12, color: Colors.inkMute },

  modalRoot: { flex: 1, backgroundColor: Colors.cream, paddingTop: 56 },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.lineSoft,
  },
  modalTitle: { fontSize: 18, fontWeight: '900', color: Colors.ink, letterSpacing: -0.4 },
  modalClose: { fontSize: 18, fontWeight: '700', color: Colors.inkSoft },
  modalBody: { flex: 1 },
  modalBodyContent: { padding: 20, paddingBottom: 48 },
  modalText: { fontSize: 13, color: Colors.inkSoft, fontWeight: '500', lineHeight: 21 },
});
