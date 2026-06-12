import { StatusBar } from 'expo-status-bar';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { palette, radius, spacing } from '@/constants/theme';

export default function ModalScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.modalMark}>
        <Text style={styles.modalMarkText}>언제?</Text>
      </View>
      <Text style={styles.title}>언제볼래 MVP 골격</Text>
      <Text style={styles.body}>스프라이트 시트 기준의 약속 카드 앱 디자인 프로토타입입니다.</Text>

      <StatusBar style={Platform.OS === 'ios' ? 'light' : 'auto'} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: palette.background,
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  title: {
    color: palette.ink,
    fontSize: 24,
    fontWeight: '900',
  },
  modalMark: {
    alignItems: 'center',
    backgroundColor: palette.amberSoft,
    borderColor: palette.lineStrong,
    borderRadius: radius.xl,
    borderWidth: 2,
    height: 118,
    justifyContent: 'center',
    transform: [{ rotate: '-5deg' }],
    width: 148,
  },
  modalMarkText: {
    color: palette.primaryDeep,
    fontSize: 28,
    fontWeight: '900',
  },
  body: {
    backgroundColor: palette.surfaceSoft,
    borderRadius: radius.lg,
    color: palette.inkMuted,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 21,
    padding: spacing.lg,
    textAlign: 'center',
  },
});
