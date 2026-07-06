// A consistent top back bar for every PUSHED redesign screen (detail, ballot,
// results, create, settings, etc.). Tab screens don't use it. Guarantees a
// visible, tappable way out so users never get stuck (the root Stack has no
// native header). Falls back to the Vote tab if there's nothing to go back to.
import React from 'react';
import { View, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../lib/theme';
import { T } from './Text';
import { SPACE } from '../../lib/redesign';

export function BackBar({ title }: { title?: string }) {
  const { colors } = useTheme();
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(redesign)/vote');
  };
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACE.sm,
        paddingHorizontal: SPACE.xl,
        paddingTop: SPACE.sm,
        paddingBottom: SPACE.sm,
      }}
    >
      <Pressable
        onPress={goBack}
        hitSlop={14}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}
      >
        <Ionicons name="chevron-back" size={22} color={colors.gold} />
        <T variant="bodyMedium" color={colors.gold}>Back</T>
      </Pressable>
      {title ? (
        <T variant="bodyMedium" color={colors.textSecondary} numberOfLines={1} style={{ flex: 1 }}>
          {title}
        </T>
      ) : null}
    </View>
  );
}
