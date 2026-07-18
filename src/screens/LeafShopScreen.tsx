import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  StatusBar, Alert, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { NavProps } from '../types';
import { Colors, shadow } from '../constants/colors';
import { BackButton } from '../components/BackButton';
import { LeafIcon } from '../components/LeafIcon';
import { LEAF_PACKAGES, LeafPackage, formatKrw, pricePerLeaf } from '../services/leafPackages';
import { getBalance, LeafBalance, PRO_MONTHLY_LEAVES } from '../services/leaves';
import { isPurchasesReady, purchaseLeafPackage, purchaseSubscription, restorePurchases } from '../services/purchases';
import { haptic } from '../services/haptics';
import { t } from '../i18n';

export default function LeafShopScreen({ goBack }: NavProps) {
  const [balance, setBalance] = useState<LeafBalance | null>(null);

  const load = useCallback(async () => {
    setBalance(await getBalance());
  }, []);
  useEffect(() => { load(); }, [load]);

  const handlePurchase = async (pkg: LeafPackage) => {
    haptic.light();
    if (!isPurchasesReady()) {
      Alert.alert(
        t('leafShop.comingSoonTitle'),
        t('leafShop.purchaseComingSoon', { name: t(`leafPackage.${pkg.id}`) }),
        [{ text: t('leafShop.ok') }],
      );
      return;
    }
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

  const handleSubscribe = async () => {
    haptic.light();
    if (!isPurchasesReady()) {
      Alert.alert(t('leafShop.comingSoonTitle'), t('leafShop.subscribeComingSoon'), [{ text: t('leafShop.ok') }]);
      return;
    }
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

        {/* 패키지 리스트 */}
        <Text style={styles.sectionLabel}>{t('leafShop.packagesSection')}</Text>
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

        {/* 구독 안내 */}
        <Text style={[styles.sectionLabel, { marginTop: 10 }]}>{t('leafShop.dailyUseSection')}</Text>
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
          </View>
          <Text style={styles.subHint}>{t('leafShop.subHint')}</Text>
        </TouchableOpacity>

        {/* 구매 복원 */}
        <TouchableOpacity style={styles.restoreBtn} onPress={handleRestore} activeOpacity={0.7}>
          <Text style={styles.restoreText}>{t('leafShop.restore')}</Text>
        </TouchableOpacity>

        {/* 정책 안내 */}
        <View style={styles.policyBox}>
          <Text style={styles.policyText}>
            {t('leafShop.policy')}
          </Text>
        </View>

      </ScrollView>
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
  subHint: { fontSize: 11, color: Colors.inkMute, fontWeight: '600', marginTop: 10, fontStyle: 'italic' },

  policyBox: {
    backgroundColor: Colors.creamSoft, borderRadius: 12,
    padding: 14, marginTop: 8,
  },
  policyText: { fontSize: 11, color: Colors.inkSoft, fontWeight: '500', lineHeight: 18 },
  restoreBtn: { alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 16 },
  restoreText: { fontSize: 13, fontWeight: '700', color: Colors.inkSoft, textDecorationLine: 'underline' },
});
