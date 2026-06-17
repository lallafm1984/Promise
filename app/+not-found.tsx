import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { palette, spacing } from '@/constants/theme';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: '없는 화면' }} />
      <View style={styles.container}>
        <Text style={styles.title}>카드를 찾지 못했어요</Text>

        <Link href="/create" style={styles.link}>
          <Text style={styles.linkText}>카드로 돌아가기</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: palette.background,
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  title: {
    color: palette.ink,
    fontSize: 22,
    fontWeight: '900',
  },
  link: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
  },
  linkText: {
    color: palette.primary,
    fontSize: 14,
    fontWeight: '900',
  },
});
