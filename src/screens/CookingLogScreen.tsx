import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Image,
  StatusBar, Dimensions, Modal, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavProps } from '../types';
import { Colors, shadow } from '../constants/colors';
import { haptic } from '../services/haptics';
import { getCookLogs, removeCookLog, CookLog } from '../services/cookingLog';
import { formatRelativeDate } from '../services/youtube';
import { t } from '../i18n';

const { width } = Dimensions.get('window');
const GAP = 12;
const COLS = 2;
const CELL = (width - 20 * 2 - GAP * (COLS - 1)) / COLS;

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
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 4 }]}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{t('cookLog.galleryTitle')}</Text>
          <Text style={styles.headerSub}>{t('cookLog.gallerySub', { count: logs.length })}</Text>
        </View>
        <View style={styles.backBtn} />
      </View>

      {logs.length === 0 ? (
        <View style={styles.empty}>
          <Image source={require('../../assets/quokka_question.png')} style={styles.emptyQuokka} resizeMode="contain" />
          <Text style={styles.emptyTitle}>{t('cookLog.emptyTitle')}</Text>
          <Text style={styles.emptySub}>{t('cookLog.emptySub')}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
          {logs.map(log => (
            <TouchableOpacity
              key={log.id}
              style={styles.cell}
              activeOpacity={0.85}
              onPress={() => { haptic.light(); setViewer(log); }}
            >
              <Image source={{ uri: log.photoUri }} style={styles.cellImg} resizeMode="cover" />
              <Text style={styles.cellName} numberOfLines={1}>{log.recipeName}</Text>
              <Text style={styles.cellDate}>{formatRelativeDate(log.cookedAt)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* 사진 뷰어 */}
      <Modal visible={!!viewer} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <View style={styles.viewerOverlay}>
          {viewer && (
            <>
              <Image source={{ uri: viewer.photoUri }} style={styles.viewerImg} resizeMode="contain" />
              <Text style={styles.viewerName}>{viewer.recipeName}</Text>
              <Text style={styles.viewerDate}>{formatRelativeDate(viewer.cookedAt)}</Text>
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
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, gap: 10,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 24, fontWeight: '700', color: Colors.ink },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '900', color: Colors.ink },
  headerSub: { fontSize: 12, fontWeight: '600', color: Colors.inkSoft, marginTop: 2 },

  grid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: GAP,
    paddingHorizontal: 20, paddingBottom: 32,
  },
  cell: { width: CELL },
  cellImg: { width: CELL, height: CELL, borderRadius: 16, backgroundColor: Colors.creamDark, ...shadow.sm },
  cellName: { fontSize: 13, fontWeight: '800', color: Colors.ink, marginTop: 7 },
  cellDate: { fontSize: 11, fontWeight: '600', color: Colors.inkMute, marginTop: 1 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyQuokka: { width: 130, height: 130, marginBottom: 12, opacity: 0.9 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: Colors.ink, marginBottom: 8 },
  emptySub: { fontSize: 14, fontWeight: '500', color: Colors.inkSoft, textAlign: 'center', lineHeight: 21 },

  viewerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  viewerImg: { width: width - 48, height: width - 48, borderRadius: 20 },
  viewerName: { fontSize: 18, fontWeight: '900', color: '#fff', marginTop: 20 },
  viewerDate: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  viewerBtns: { flexDirection: 'row', gap: 12, marginTop: 28 },
  viewerDelete: {
    paddingHorizontal: 28, paddingVertical: 13, borderRadius: 14,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)',
  },
  viewerDeleteText: { fontSize: 15, fontWeight: '800', color: '#FF8A80' },
  viewerClose: { paddingHorizontal: 32, paddingVertical: 13, borderRadius: 14, backgroundColor: '#fff' },
  viewerCloseText: { fontSize: 15, fontWeight: '800', color: Colors.ink },
});
