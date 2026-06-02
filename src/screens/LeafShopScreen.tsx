import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  StatusBar, Alert, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { NavProps } from '../types';
import { Colors, shadow } from '../constants/colors';
import { LeafIcon } from '../components/LeafIcon';
import { LEAF_PACKAGES, LeafPackage, formatKrw, pricePerLeaf } from '../services/leafPackages';
import { getBalance, LeafBalance, PRO_MONTHLY_LEAVES } from '../services/leaves';
import { haptic } from '../services/haptics';

export default function LeafShopScreen({ goBack }: NavProps) {
  const [balance, setBalance] = useState<LeafBalance | null>(null);

  const load = useCallback(async () => {
    setBalance(await getBalance());
  }, []);
  useEffect(() => { load(); }, [load]);

  const handlePurchase = (pkg: LeafPackage) => {
    haptic.light();
    Alert.alert(
      '곧 지원돼요',
      `"${pkg.name}" 결제 기능은 준비 중이에요.\n사업자등록 후 결제 시스템 연동되면 바로 구매 가능합니다 🐾`,
      [{ text: '확인' }],
    );
  };

  const handleSubscribe = () => {
    haptic.light();
    Alert.alert(
      '곧 지원돼요',
      '쿼카 패스 구독은 준비 중이에요 🐾',
      [{ text: '확인' }],
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* Header */}
      <LinearGradient colors={['#F6E0B5', Colors.cream]} locations={[0, 0.7]} style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← 돌아가기</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>잎사귀 충전</Text>
        <Text style={styles.headerSub}>AI 호출에 사용되는 잎사귀를 구매해요</Text>
      </LinearGradient>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>

        {/* 현재 잔액 카드 */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceRow}>
            <LeafIcon size={44} />
            <View style={styles.balanceTexts}>
              <Text style={styles.balanceLabel}>현재 잔액</Text>
              <Text style={styles.balanceValue}>
                {balance ? (balance.isUnlimited ? '∞ 무제한' : `${balance.total}🍃`) : '·'}
              </Text>
            </View>
          </View>
          {balance && !balance.isUnlimited && (
            <Text style={styles.balanceBreakdown}>
              오늘 무료 {balance.daily} · 보너스 풀 {balance.bonus}
            </Text>
          )}
        </View>

        {/* 패키지 리스트 */}
        <Text style={styles.sectionLabel}>충전 패키지</Text>
        {LEAF_PACKAGES.map(pkg => (
          <TouchableOpacity
            key={pkg.id}
            style={[styles.pkgCard, pkg.featured && styles.pkgCardFeatured]}
            onPress={() => handlePurchase(pkg)}
            activeOpacity={0.85}
          >
            {pkg.featured && (
              <View style={styles.featuredBadge}>
                <Text style={styles.featuredBadgeText}>🔥 인기</Text>
              </View>
            )}
            <View style={styles.pkgLeft}>
              <Image source={pkg.image} style={styles.pkgImage} resizeMode="contain" />
              <View>
                <Text style={styles.pkgName}>{pkg.name}</Text>
                <View style={styles.pkgLeavesRow}>
                  <LeafIcon size={18} />
                  <Text style={styles.pkgLeavesText}>{pkg.leaves}개</Text>
                  {pkg.bonusPercent && (
                    <View style={styles.bonusChip}>
                      <Text style={styles.bonusChipText}>+{pkg.bonusPercent}% 더</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.pkgPerUnit}>개당 {pricePerLeaf(pkg)}원</Text>
              </View>
            </View>
            <View style={styles.pkgRight}>
              <Text style={styles.pkgPrice}>{formatKrw(pkg.price)}</Text>
              <View style={styles.pkgBuyBtn}>
                <Text style={styles.pkgBuyBtnText}>구매</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}

        {/* 구독 안내 */}
        <Text style={[styles.sectionLabel, { marginTop: 10 }]}>매일 쓴다면</Text>
        <TouchableOpacity style={styles.subCard} onPress={handleSubscribe} activeOpacity={0.85}>
          <Image
            source={require('../../assets/quokka_pass.webp')}
            style={styles.subBgImage}
            resizeMode="contain"
          />
          <View style={styles.subBadge}>
            <Text style={styles.subBadgeText}>PRO</Text>
          </View>
          <Text style={styles.subTitle}>쿼카 패스</Text>
          <Text style={styles.subPrice}>₩4,900<Text style={styles.subPricePer}>/월</Text></Text>
          <View style={styles.subBenefits}>
            <Text style={styles.subBenefit}>✓ 잎사귀 매달 {PRO_MONTHLY_LEAVES}개</Text>
            <Text style={styles.subBenefit}>✓ 광고 완전 제거</Text>
          </View>
          <Text style={styles.subHint}>하루 3회 이상 사용 시 더 이득</Text>
        </TouchableOpacity>

        {/* 정책 안내 */}
        <View style={styles.policyBox}>
          <Text style={styles.policyText}>
            • 결제 후 잎사귀는 즉시 보너스 풀에 적립돼요{'\n'}
            • 보너스 풀은 만료되지 않아요 (영구 보관){'\n'}
            • 일일 무료 잎사귀가 먼저 차감되고, 부족분만 보너스에서 차감돼요{'\n'}
            • 환불은 Google Play 정책을 따라요
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
  backBtnText: { color: Colors.ink, fontSize: 14, fontWeight: '700' },
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
});
