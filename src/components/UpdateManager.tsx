import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Updates from 'expo-updates';
import { Colors, shadow } from '../constants/colors';
import { checkStoreUpdate, openStorePage, snoozeStoreUpdate } from '../services/appVersion';
import { haptic } from '../services/haptics';
import { t } from '../i18n';

// 업데이트는 둘로 나뉜다.
//  - 작은 업데이트(EAS Update, 화면·로직): 안내 없이 받아 두고 다음 실행 때 적용된다.
//  - 큰 업데이트(스토어 새 버전): 서버의 최신/최소 버전과 비교해 안내한다(services/appVersion.ts).
//      최신보다 낮음 → "새 버전이 나왔어요 [나중에][업데이트]", 최소보다 낮음 → 업데이트 전엔 사용 불가.
// 앱을 완전히 끄지 않고 오가는 사용자가 대부분이라, 앱으로 돌아올 때도 확인한다(너무 잦지 않게).
const CHECK_INTERVAL_MS = 30 * 60 * 1000;

export function UpdateManager() {
  const [required, setRequired] = useState(false);
  const lastCheck = useRef(0);
  const asking = useRef(false);

  const check = useCallback(async () => {
    if (Date.now() - lastCheck.current < CHECK_INTERVAL_MS) return;
    lastCheck.current = Date.now();

    // 작은 업데이트: 조용히 받기만 한다(앱 시작 때는 expo-updates 가 알아서 받는다)
    if (Updates.isEnabled && !__DEV__) {
      Updates.checkForUpdateAsync()
        .then(r => (r.isAvailable ? Updates.fetchUpdateAsync() : undefined))
        .catch(() => { /* 오프라인 등 — 다음에 다시 */ });
    }

    // 큰 업데이트: 스토어로 안내
    const u = await checkStoreUpdate();
    if (u?.kind === 'required') { setRequired(true); return; }
    if (u?.kind === 'available' && !asking.current) {
      asking.current = true;
      Alert.alert(t('update.storeTitle'), t('update.storeMsg'), [
        { text: t('update.later'), style: 'cancel', onPress: () => { asking.current = false; snoozeStoreUpdate(u.version); } },
        { text: t('update.update'), onPress: () => { asking.current = false; openStorePage(); } },
      ], { cancelable: false });
    }
  }, []);

  useEffect(() => {
    check();
    const sub = AppState.addEventListener('change', s => { if (s === 'active') check(); });
    return () => sub.remove();
  }, [check]);

  // 최소 버전보다 낮음: 닫을 수 없는 화면. 스토어에서 업데이트하면 새 앱으로 다시 시작된다.
  return (
    <Modal visible={required} animationType="fade" onRequestClose={() => {}}>
      <View style={styles.root}>
        <View style={styles.card}>
          <Image source={require('../../assets/applogo-512.png')} style={styles.logo} />
          <Text style={styles.title}>{t('update.requiredTitle')}</Text>
          <Text style={styles.msg}>{t('update.requiredMsg')}</Text>
          <TouchableOpacity style={styles.btn} onPress={() => { haptic.light(); openStorePage(); }} activeOpacity={0.85}>
            <Text style={styles.btnText}>{t('update.update')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.cream, alignItems: 'center', justifyContent: 'center', padding: 28 },
  card: { width: '100%', backgroundColor: Colors.white, borderRadius: 24, padding: 28, alignItems: 'center', ...shadow.md },
  logo: { width: 72, height: 72, borderRadius: 18, marginBottom: 18 },
  title: { fontSize: 20, fontWeight: '900', color: Colors.ink, textAlign: 'center' },
  msg: { fontSize: 14, fontWeight: '500', color: Colors.inkSoft, textAlign: 'center', lineHeight: 21, marginTop: 8 },
  btn: { marginTop: 22, alignSelf: 'stretch', backgroundColor: Colors.forest, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  btnText: { fontSize: 15, fontWeight: '800', color: '#FFF' },
});
