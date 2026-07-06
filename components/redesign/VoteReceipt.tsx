// The "Ballot recorded" receipt — shared by the yes/no detail screen and the
// ranked/multiple-choice ballot screen so the recorded-moment is identical
// everywhere. Honest ledger language (public + tamper-evident + one-per-person),
// never "secret". Optional children render a tally or result under the receipt.
import React, { useEffect, useRef } from 'react';
import { View, Animated, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../lib/theme';
import { T, Button } from './index';
import { SPACE, RADIUS, MOTION } from '../../lib/redesign';

interface Row {
  label: string;
  value: string;
  emphasize?: boolean;
}

interface Props {
  headline?: string;
  choiceRows: Row[]; // e.g. [{label:'Your ballot', value:'SUPPORT', emphasize:true}]
  ledgerRef?: string;
  recordedAt: string;
  children?: React.ReactNode; // tally / result viz under the receipt
  onDone?: () => void;
}

export function VoteReceipt({
  headline = 'Ballot recorded',
  choiceRows,
  ledgerRef,
  recordedAt,
  children,
  onDone,
}: Props) {
  const { colors } = useTheme();
  const scale = useRef(new Animated.Value(0.5)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6 }),
      Animated.timing(opacity, { toValue: 1, duration: MOTION.tick, useNativeDriver: true }),
    ]).start();
  }, [opacity, scale]);

  const done = onDone ?? (() => router.back());

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: SPACE.xl, gap: SPACE.xl, flexGrow: 1, justifyContent: 'center' }}>
        <View style={{ alignItems: 'center', gap: SPACE.lg }}>
          <Animated.View
            style={{
              width: 84,
              height: 84,
              borderRadius: 42,
              backgroundColor: colors.goldSurface,
              borderWidth: 1,
              borderColor: colors.gold,
              alignItems: 'center',
              justifyContent: 'center',
              transform: [{ scale }],
              opacity,
            }}
          >
            <T variant="heroSerif" color={colors.gold} style={{ fontSize: 40, lineHeight: 44 }}>✓</T>
          </Animated.View>
          <T variant="resultSerif" color={colors.text} style={{ textAlign: 'center' }}>{headline}</T>
          <T variant="body" color={colors.textSecondary} style={{ textAlign: 'center', maxWidth: 300 }}>
            Recorded on the public ledger · one person, one ballot · verifiable by anyone.
          </T>
        </View>

        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: RADIUS.card,
            borderWidth: 1,
            borderColor: colors.border,
            padding: SPACE.xl,
            gap: SPACE.md,
          }}
        >
          {choiceRows.map((r, i) => (
            <React.Fragment key={r.label}>
              {i > 0 && <View style={{ height: 1, backgroundColor: colors.border }} />}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: SPACE.md }}>
                <T variant="monoLabel" color={colors.textTertiary}>{r.label}</T>
                <T variant="monoData" color={r.emphasize ? colors.gold : colors.textSecondary} numberOfLines={1} style={{ flex: 1, textAlign: 'right' }}>
                  {r.value}
                </T>
              </View>
            </React.Fragment>
          ))}
          <View style={{ height: 1, backgroundColor: colors.border }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <T variant="monoLabel" color={colors.textTertiary}>Recorded</T>
            <T variant="monoData" color={colors.textSecondary}>{recordedAt}</T>
          </View>
          {ledgerRef ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: SPACE.md }}>
              <T variant="monoLabel" color={colors.textTertiary}>Ledger ref</T>
              <T variant="monoData" color={colors.textSecondary} numberOfLines={1} style={{ flex: 1, textAlign: 'right' }}>
                {ledgerRef.slice(0, 10)}…{ledgerRef.slice(-6)}
              </T>
            </View>
          ) : (
            <T variant="caption" color={colors.textTertiary}>Confirming on the ledger…</T>
          )}
        </View>

        {children}

        <View style={{ gap: SPACE.sm }}>
          <Button label="Keep voting" onPress={done} />
          <Button label="Done" variant="ghost" onPress={done} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
