import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import Svg, { Circle, Path, Rect, Defs, Pattern } from 'react-native-svg';

import { useTheme } from '../../lib/theme';
import { Button } from '../ui';
import { useTutorialTarget } from '../tutorial';

const ID_STATIC = {
  G: '#EABA58',
  GD: '#C89A3E',
  GL: '#F4D28C',
  BG: '#040707',
  BG_CARD: '#0D0F12',
  BG_RAISED: '#15181C',
  LINE: '#1E2228',
  LINE_STRONG: '#2A2F37',
  FG: '#F4F5F6',
  FG_MUTED: '#C7CACD',
  FG_FAINT: '#8E9297',
  GREEN: '#34C759',
  SERIF: 'Georgia',
  MONO: 'JetBrainsMono-Regular',
};

function useIdentityColors() {
  const { colors } = useTheme();
  return {
    G: colors.gold,
    GD: colors.goldDark,
    GL: colors.goldLight,
    BG: colors.background,
    BG_CARD: colors.surface,
    BG_RAISED: colors.surfaceElevated,
    LINE: colors.border,
    LINE_STRONG: colors.borderStrong,
    FG: colors.text,
    FG_MUTED: colors.textSecondary,
    FG_FAINT: colors.textTertiary,
    GREEN: colors.success,
  };
}

export type PassportStatus = 'unverified' | 'pending' | 'verified' | 'failed';

type PassportCardProps = {
  name: string;
  location: string;
  verified: boolean;
  status: PassportStatus;
  folio: string;
  memberSince?: string;
  onVerify: () => void;
  startingKyc?: boolean;
};

export function PassportCard({
  name,
  location,
  verified,
  status,
  folio,
  memberSince,
  onVerify,
  startingKyc = false,
}: PassportCardProps) {
  const id = useIdentityColors();
  const { colors } = useTheme();
  const idCardRef = useTutorialTarget('id-card');
  const verifyButtonRef = useTutorialTarget('verify-button');

  const initials = useMemo(() => {
    if (!name) return 'RW';
    const parts = name.split(' ').filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }, [name]);

  return (
    <>
      <View ref={idCardRef} collapsable={false}>
        <Animated.View entering={FadeInUp.delay(100).duration(400)}>
          <View style={[styles.passportCard, { backgroundColor: id.BG_CARD, borderColor: id.LINE_STRONG }]}>
            {/* Guilloché pattern */}
            <View style={styles.guilloche}>
              <Svg width="100%" height="100%" viewBox="0 0 400 260" preserveAspectRatio="none">
                <Defs>
                  <Pattern id="passport-guilloche" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                    <Path d="M 0 20 Q 10 0, 20 20 T 40 20" stroke={id.G} fill="none" strokeWidth={0.5} opacity={0.07} />
                    <Path d="M 0 20 Q 10 40, 20 20 T 40 20" stroke={id.G} fill="none" strokeWidth={0.5} opacity={0.07} />
                  </Pattern>
                </Defs>
                <Rect width="400" height="260" fill="url(#passport-guilloche)" />
              </Svg>
            </View>

            {/* Top strip */}
            <View style={[styles.passportTop, { borderBottomColor: id.LINE }]}>
              <View style={styles.passportLogo}>
                <Image source={require('../../assets/logo.png')} style={{ width: 22, height: 22 }} resizeMode="contain" />
                <Text style={[styles.passportBrand, { color: id.G }]}>REPRESENT</Text>
              </View>
              <Text style={[styles.passportEst, { color: id.FG_FAINT }]}>EST 2026</Text>
            </View>

            {/* Main section */}
            <View style={styles.passportMain}>
              {/* Portrait frame */}
              <View style={[styles.portraitFrame, { borderColor: id.GD }]}>
                <View style={[styles.cornerTick, { top: -1, left: -1, borderColor: id.G }]} />
                <View style={[styles.cornerTick, { top: -1, right: -1, borderLeftWidth: 0, borderRightWidth: 1.5, borderColor: id.G }]} />
                <View style={[styles.cornerTick, { bottom: -1, left: -1, borderTopWidth: 0, borderBottomWidth: 1.5, borderColor: id.G }]} />
                <View style={[styles.cornerTick, { bottom: -1, right: -1, borderTopWidth: 0, borderBottomWidth: 1.5, borderLeftWidth: 0, borderRightWidth: 1.5, borderColor: id.G }]} />
                <Text style={[styles.initialsText, { color: id.GL }]} numberOfLines={1} adjustsFontSizeToFit>{initials}</Text>
                {verified && (
                  <View style={[styles.biometricTick, { backgroundColor: id.GREEN }]}>
                    <Ionicons name="checkmark" size={10} color={id.BG} />
                  </View>
                )}
              </View>

              {/* Info */}
              <View style={styles.passportInfo}>
                <Text style={[styles.registeredLabel, { color: id.FG_FAINT }]}>Registered name</Text>
                <Text style={[styles.passportName, { color: id.FG }]}>{name || 'Your Name'}</Text>
                <View style={styles.locationRow}>
                  <Svg width={10} height={10} viewBox="0 0 12 12">
                    <Path d="M6 11s4-3.5 4-7a4 4 0 1 0-8 0c0 3.5 4 7 4 7z" stroke={id.G} strokeWidth={1} fill="none" />
                    <Circle cx="6" cy="4" r="1.2" fill={id.G} />
                  </Svg>
                  <Text style={[styles.locationText, { color: id.FG_MUTED }]}>{location || 'Location not set'}</Text>
                </View>
              </View>
            </View>

            {/* Register strip */}
            <View style={[styles.registerStrip, { borderTopColor: id.LINE }]}>
              <View style={styles.registerCell}>
                <Text style={[styles.registerLabel, { color: id.FG_FAINT }]}>Joined</Text>
                <Text style={[styles.registerValue, { color: id.FG }]}>{memberSince || 'Apr 2026'}</Text>
              </View>
              <View style={[styles.registerCell, styles.registerCellMid, { borderColor: id.LINE }]}>
                <Text style={[styles.registerLabel, { color: id.FG_FAINT }]}>Folio</Text>
                <Text style={[styles.registerMono, { color: id.FG }]}>RW·{folio}</Text>
              </View>
              <View style={styles.registerCell}>
                <Text style={[styles.registerLabel, { color: id.FG_FAINT }]}>Status</Text>
                <Text style={[styles.registerValue, { color: verified ? id.GREEN : id.FG_MUTED }]}>
                  {verified ? 'Active' : 'Pending'}
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>
      </View>

      {!verified && (
        <Animated.View
          entering={FadeInUp.delay(200).duration(400)}
          style={[styles.verifyCta, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <View style={styles.verifyCtaContent}>
            <View style={[styles.verifyCtaIcon, { backgroundColor: `${colors.gold}15` }]}>
              <Ionicons name="shield-checkmark-outline" size={24} color={colors.gold} />
            </View>
            <View style={styles.verifyCtaText}>
              <Text style={[styles.verifyCtaTitle, { color: colors.text }]}>
                {status === 'pending' ? 'Verification Pending' : 'Verify Your Identity'}
              </Text>
              <Text style={[styles.verifyCtaSubtitle, { color: colors.textSecondary }]}>
                {status === 'pending'
                  ? 'Your verification is being processed'
                  : 'Unlock voting and earn the Verified badge'}
              </Text>
            </View>
          </View>
          <View ref={verifyButtonRef} collapsable={false}>
            <Button
              title={startingKyc ? 'Starting...' : status === 'pending' ? 'Refresh' : 'Verify Now'}
              onPress={onVerify}
              variant="primary"
              size="md"
              loading={startingKyc}
              disabled={startingKyc}
            />
          </View>
        </Animated.View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  passportCard: {
    position: 'relative',
    borderRadius: 20,
    backgroundColor: ID_STATIC.BG_CARD,
    borderWidth: 1,
    borderColor: ID_STATIC.LINE_STRONG,
    overflow: 'hidden',
    marginBottom: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.4,
    shadowRadius: 36,
    elevation: 20,
  },
  guilloche: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.07 },
  passportTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: ID_STATIC.LINE,
  },
  passportLogo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  passportBrand: { fontWeight: '600', fontSize: 10, letterSpacing: 2.8, color: ID_STATIC.G },
  passportEst: { fontFamily: ID_STATIC.MONO, fontSize: 9, color: ID_STATIC.FG_FAINT, letterSpacing: 1 },
  passportMain: { flexDirection: 'row', alignItems: 'flex-start', padding: 20, gap: 16 },
  portraitFrame: {
    width: 88,
    height: 110,
    borderWidth: 1,
    borderColor: ID_STATIC.GD,
    backgroundColor: '#0A0C0F',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  cornerTick: { position: 'absolute', width: 8, height: 8, borderTopWidth: 1.5, borderLeftWidth: 1.5, borderColor: ID_STATIC.G },
  initialsText: { fontFamily: ID_STATIC.SERIF, fontSize: 42, fontWeight: '500', fontStyle: 'italic', color: ID_STATIC.GL, letterSpacing: -0.8 },
  biometricTick: {
    position: 'absolute',
    bottom: -8,
    right: -8,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: ID_STATIC.GREEN,
    borderWidth: 2,
    borderColor: '#0B0D10',
    justifyContent: 'center',
    alignItems: 'center',
  },
  passportInfo: { flex: 1, paddingTop: 4 },
  registeredLabel: { fontWeight: '600', fontSize: 9, letterSpacing: 2.2, textTransform: 'uppercase', color: ID_STATIC.FG_FAINT, marginBottom: 4 },
  passportName: { fontFamily: ID_STATIC.SERIF, fontSize: 24, fontWeight: '500', letterSpacing: -0.4, color: ID_STATIC.FG, lineHeight: 26, marginBottom: 8 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  locationText: { fontSize: 11.5, color: ID_STATIC.FG_MUTED, letterSpacing: -0.05 },
  registerStrip: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: ID_STATIC.LINE },
  registerCell: { flex: 1, padding: 12, paddingHorizontal: 14 },
  registerCellMid: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: ID_STATIC.LINE },
  registerLabel: { fontWeight: '600', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: ID_STATIC.FG_FAINT, marginBottom: 4 },
  registerValue: { fontFamily: ID_STATIC.SERIF, fontSize: 14, fontWeight: '500', fontStyle: 'italic', color: ID_STATIC.FG },
  registerMono: { fontFamily: ID_STATIC.MONO, fontSize: 11, fontWeight: '500', color: ID_STATIC.FG, letterSpacing: 0.4 },

  verifyCta: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: ID_STATIC.LINE,
    padding: 16,
    marginBottom: 16,
    backgroundColor: ID_STATIC.BG_CARD,
  },
  verifyCtaContent: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  verifyCtaIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  verifyCtaText: { flex: 1 },
  verifyCtaTitle: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  verifyCtaSubtitle: { fontSize: 13 },
});
