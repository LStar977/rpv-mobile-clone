import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, FONTS, ANIMATION } from '../../lib/theme';

// ═══════════════════════════════════════════════════════════════════════════════
// P3 · HOW VOTING WORKS — RULES SHEET
//
// A self-contained bottom sheet over a 75% scrim (same sheet language as the
// X1 confirm-before-cast sheet in VoteConfirmationOverlay) that states the
// four rules of the ledger: one person one ballot; public & permanent;
// CHANGEABLE org ballots; tallies appear at 25 ballots.
// ═══════════════════════════════════════════════════════════════════════════════

interface HowVotingWorksSheetProps {
  visible: boolean;
  onClose: () => void;
}

interface Rule {
  icon?: keyof typeof Ionicons.glyphMap;
  /** Mono glyph rendered instead of an icon (the "25" threshold tile). */
  glyph?: string;
  title: string;
  body: React.ReactNode;
}

export function HowVotingWorksSheet({ visible, onClose }: HowVotingWorksSheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const scrimOpacity = useSharedValue(0);
  const sheetTranslate = useSharedValue(560);

  useEffect(() => {
    if (visible) {
      scrimOpacity.value = withTiming(1, { duration: ANIMATION.motion.quick });
      sheetTranslate.value = withSpring(0, ANIMATION.spring.gentle);
    } else {
      scrimOpacity.value = 0;
      sheetTranslate.value = 560;
    }
  }, [visible]);

  const scrimStyle = useAnimatedStyle(() => ({
    opacity: scrimOpacity.value,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetTranslate.value }],
  }));

  const dismiss = () => {
    scrimOpacity.value = withTiming(0, { duration: ANIMATION.motion.quick });
    sheetTranslate.value = withTiming(560, { duration: ANIMATION.motion.quick }, () => {
      runOnJS(onClose)();
    });
  };

  const rules: Rule[] = [
    {
      icon: 'shield-checkmark-outline',
      title: 'One person, one ballot',
      body: 'Your verified identity can cast exactly one ballot per question. No bots, no duplicates.',
    },
    {
      icon: 'business-outline',
      title: 'Public and permanent',
      body:
        'Ballots are recorded on a tamper-evident public ledger anyone can audit. Once cast, a referendum ballot cannot be changed.',
    },
    {
      icon: 'refresh-outline',
      title: 'Some ballots allow changes',
      body: (
        <>
          Organization votes marked{' '}
          <Text style={[styles.changeableChip, { color: colors.gold }]}>CHANGEABLE</Text> can be
          recast until they close. The ledger keeps every version.
        </>
      ),
    },
    {
      glyph: '25',
      title: 'Tallies appear at 25 ballots',
      body:
        "Below that, you'll see the raw count only — so three early ballots never read as a landslide.",
    },
  ];

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={dismiss} statusBarTranslucent>
      <View style={styles.root}>
        {/* 75% scrim — tapping it dismisses */}
        <Animated.View style={[styles.scrim, { backgroundColor: colors.overlay }, scrimStyle]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={dismiss} />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.backgroundElevated,
              borderColor: colors.border,
              paddingBottom: Math.max(insets.bottom, 16) + 24,
            },
            sheetStyle,
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: colors.surfaceHighlight }]} />

          <Text style={[styles.title, { color: colors.text }]}>How voting works</Text>

          <View style={styles.rules}>
            {rules.map((rule) => (
              <View key={rule.title} style={styles.ruleRow}>
                <View style={[styles.ruleTile, { backgroundColor: colors.goldSurface }]}>
                  {rule.glyph ? (
                    <Text style={[styles.ruleGlyph, { color: colors.gold }]}>{rule.glyph}</Text>
                  ) : (
                    <Ionicons name={rule.icon!} size={17} color={colors.gold} />
                  )}
                </View>
                <View style={styles.ruleTextCol}>
                  <Text style={[styles.ruleTitle, { color: colors.text }]}>{rule.title}</Text>
                  <Text style={[styles.ruleBody, { color: colors.textSecondary }]}>{rule.body}</Text>
                </View>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.cta, { backgroundColor: colors.goldFill }]}
            onPress={dismiss}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Got it, close"
          >
            <Text style={styles.ctaText}>Got It</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    borderWidth: 1,
    borderBottomWidth: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    paddingHorizontal: 26,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -20 },
    shadowOpacity: 0.6,
    shadowRadius: 60,
    elevation: 24,
  },
  grabber: {
    width: 40,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
  },
  title: {
    fontFamily: FONTS.serif,
    fontSize: 24,
    lineHeight: 28,
  },
  rules: {
    gap: 12,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 13,
  },
  ruleTile: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ruleGlyph: {
    fontFamily: FONTS.monoSemiBold,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  ruleTextCol: {
    flex: 1,
    gap: 2,
  },
  ruleTitle: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 14,
  },
  ruleBody: {
    fontFamily: FONTS.sans,
    fontSize: 12.5,
    lineHeight: 19,
  },
  changeableChip: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    letterSpacing: 0.8,
  },
  cta: {
    height: 54,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 16,
    color: '#040707',
  },
});

export default HowVotingWorksSheet;
