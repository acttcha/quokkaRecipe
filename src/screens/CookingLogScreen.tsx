import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Image,
  StatusBar, Dimensions, Modal, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '../components/BackButton';
import { NavProps } from '../types';
import { Colors, shadow } from '../constants/colors';
import { haptic } from '../services/haptics';
import { getCookLogs, removeCookLog, CookLog } from '../services/cookingLog';
import { formatRelativeDate } from '../services/youtube';
import { t } from '../i18n';

const { width } = Dimensions.get('window');
const PAD = 16;
const GAP = 14;
const CELL = (width - PAD * 2 - GAP) / 2;
const PHOTO = CELL - 16; // 카드 내부 패딩(8) 양쪽 제외

export default function CookingLogScreen({ goBack }: NavProps) {
  const insets = useSafeAreaInsets();
  const [logs, setLogs] = useState<CookLog[]>([]);
  const [viewer, setViewer] = useState<CookLog | null>(null);

  const load = async () => setLogs(await getCookLogs());
  useEffect(() => { load(); }, []);

  const confirmDelete = (log: CookLog) => {
    Alert.alert(t('cookLog.deleteTitle'), t('cookLog.deleteMsg'), [
      { text: t('cookLog.cancel'), style: 'cancel' },
      {
        text: t('cookLog.delete'), style: 'destructive',
        onPress: async () => {
          await removeCookLog(log.id);
          setViewer(null);
          haptic.success();
          load();
        },
      },
    ]);
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* 헤더 */}
      <LinearGradient colors={['#F6E0B5', Colors.cream]} locations={[0, 1]} style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 6 }]}>
        <BackButton onPress={goBack} label={t('common.back')} style={styles.backBtn} />
        <Text style={styles.headerTitle}>{t('cookLog.galleryTitle')}</Text>
        {logs.length > 0 && (
          <Text style={styles.headerSub}>{t('cookLog.gallerySub', { count: logs.length })}</Text>
        )}
      </LinearGradient>

      {logs.length === 0 ? (
        <View style={styles.empty}>
          <Image source={require('../../assets/quokka.png')} style={styles.emptyQuokka} resizeMode="contain" />
          <Text style={styles.emptyTitle}>{t('cookLog.emptyTitle')}</Text>
          <Text style={styles.emptySub}>{t('cookLog.emptySub')}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
          {logs.map((log, i) => (
            <TouchableOpacity
              key={log.id}
              style={[styles.card, { transform: [{ rotate: i % 2 === 0 ? '-1.4deg' : '1.4deg' }] }]}
              activeOpacity={0.9}
              onPress={() => { haptic.light(); setViewer(log); }}
            >
              <Image source={{ uri: log.photoUri }} style={styles.cardImg} resizeMode="cover" />
              <View style={styles.cardFooter}>
                <Text style={styles.cardName} numberOfLines={1}>{log.recipeName}</Text>
                <Text style={styles.cardDate}>{formatRelativeDate(log.cookedAt)}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* 사진 뷰어 */}
      <Modal visible={!!viewer} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <View style={styles.viewerOverlay}>
          {viewer && (
            <>
              <View style={styles.viewerCard}>
                <Image source={{ uri: viewer.photoUri }} style={styles.viewerImg} resizeMode="cover" />
                <View style={styles.viewerCaption}>
                  <Text style={styles.viewerName} numberOfLines={2}>{viewer.recipeName}</Text>
                  <Text style={styles.viewerDate}>{formatRelativeDate(viewer.cookedAt)}</Text>
                </View>
              </View>
              <View style={styles.viewerBtns}>
                <TouchableOpacity style={styles.viewerDelete} onPress={() => confirmDelete(viewer)} activeOpacity={0.85}>
                  <Text style={styles.viewerDeleteText}>{t('cookLog.delete')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.viewerClose} onPress={() => setViewer(null)} activeOpacity={0.85}>
                  <Text style={styles.viewerCloseText}>{t('cookLog.close')}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.cream },

  header: { paddingBottom: 14, paddingHorizontal: 16 },
  backBtn: { alignSelf: 'flex-start', paddingVertical: 4, marginBottom: 4 },
  headerTitle: { fontSize: 20, fontWeight: '900', color: Colors.ink, letterSpacing: -0.4 },
  headerSub: { fontSize: 13, fontWeight: '600', color: Colors.inkSoft, marginTop: 4 },

  grid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: PAD, paddingTop: 18, paddingBottom: 36,
    gap: GAP,
  },
  // 폴라로이드 카드
  card: {
    width: CELL,
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 8,
    paddingBottom: 10,
    borderWidth: 1, borderColor: Colors.lineSoft,
    ...shadow.md,
  },
  cardImg: { width: PHOTO, height: PHOTO, borderRadius: 8, backgroundColor: Colors.creamDark },
  cardFooter: { paddingTop: 8, paddingHorizontal: 2 },
  cardName: { fontSize: 14, fontWeight: '800', color: Colors.ink, letterSpacing: -0.2 },
  cardDate: { fontSize: 11, fontWeight: '600', color: Colors.inkMute, marginTop: 3 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, paddingBottom: 80 },
  emptyQuokka: { width: 160, height: 160, marginBottom: 18 },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: Colors.ink, marginBottom: 10 },
  emptySub: { fontSize: 14, fontWeight: '500', color: Colors.inkSoft, textAlign: 'center', lineHeight: 21 },

  viewerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', alignItems: 'center', justifyContent: 'center', padding: 22 },
  viewerCard: { backgroundColor: Colors.white, borderRadius: 22, padding: 12, width: '100%', ...shadow.md },
  viewerImg: { width: '100%', height: width - 110, borderRadius: 14, backgroundColor: Colors.creamDark },
  viewerCaption: { paddingTop: 14, paddingHorizontal: 6, paddingBottom: 4 },
  viewerName: { fontSize: 19, fontWeight: '900', color: Colors.ink, letterSpacing: -0.3 },
  viewerDate: { fontSize: 13, fontWeight: '600', color: Colors.inkMute, marginTop: 5 },
  viewerBtns: { flexDirection: 'row', gap: 12, marginTop: 24 },
  viewerDelete: {
    paddingHorizontal: 28, paddingVertical: 13, borderRadius: 14,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)',
  },
  viewerDeleteText: { fontSize: 15, fontWeight: '800', color: '#FF8A80' },
  viewerClose: { flex: 1, paddingVertical: 13, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center' },
  viewerCloseText: { fontSize: 15, fontWeight: '800', color: Colors.ink },
});
