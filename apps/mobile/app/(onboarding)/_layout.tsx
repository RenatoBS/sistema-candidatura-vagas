import { Stack } from 'expo-router';

import { colors } from '@/design-system/tokens';

export default function OnboardingLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />;
}
