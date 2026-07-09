import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme, FONTS } from '../../lib/theme';
import { Button } from '../ui';
import { useTutorialTarget } from '../tutorial';

export type PassportStatus = 'unverified' | 'pending' | 'verified' | 'failed';

type PassportCardProps = {
  name: string;
  location: string;
  verified: boolean;
  status: PassportStatus;
  folio: string;
  memberSince?: string;
  /** Country used for the credential's scope line, e.g. "Canada". */
  country?: string;
  onVerify: () => void;
  startingKyc?: boolean;
};

// ═══════════════════════════════════════════════════════════════════════════
// Civic credential card — mock 10 "Identity · Civic Credential".
// Gold-accented gradient card: mono scope eyebrow, serif holder name,
// verification status line, constituency/member-since grid, and a mono
// credential-ID + ledger footer. Below it, unverified users get the verify
// prompt (gold CTA + "Checked, never kept").
// ═══════════════════════════════════════════════════════════════════════════

export function PassportCard({
  name,
  location,
  verified,
  status,
  folio,
  memberSince,
  country,
  onVerify,
  startingKyc = false,
}: PassportCardProps) {
  const { colors } = useTheme();
  const idCardRef = useTutorialTarget('id-card');
  const verifyButtonRef = useTutorialTarget('verify-button');

  const statusLine = verified
    ? { icon: 'shield-checkmark' as const, label: 'VERIFIED CITIZEN', color: colors.gold }
    : status === 'pending'
      ? { icon: 'time-outline' as const, label: 'VERIFICATION PENDING', color: colors.warning }
      : status === 'failed'
        ? { icon: 'alert-circle-outline' as const, label: 'VERIFICATION FAILED', color: colors.error }
        : { icon: 'shield-outline' as const, label: 'UNVERIFIED', color: colors.textTertiary };

  const ledgerLine = verified ? 'ON THE PUBLIC LEDGER' : 'NOT YET ON THE LEDGER';
  const eyebrow = `CIVIC IDENTITY${country ? ` · ${country.toUpperCase()}` : ''}`;

  return (
    <>
      <View ref={idCardRef} collapsable={false}>
        <Animated.View entering={FadeInUp.delay(100).duration(400)}>
          <View style={[styles.card, { borderColor: `${colors.gold}66` }]}>
            <LinearGradient
              colors={[colors.surface, colors.backgroundSecondary, colors.background]}
              locations={[0, 0.55, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0.55, y: 1 }}
              style={StyleSheet.absoluteFill}
            />

            {/* Eyebrow + seal */}
            <View style={styles.topRow}>
              <Text style={[styles.eyebrow, { color: colors.gold }]}>{eyebrow}</Text>
              <Image
                source={require('../../assets/logo.png')}
                style={styles.seal}
                resizeMode="contain"
              />
            </View>

            {/* Holder */}
            <View style={styles.holder}>
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>
                {name || 'Your Name'}
              </Text>
              <View style={styles.statusRow}>
                <Ionicons name={statusLine.icon} size={13} color={statusLine.color} />
                <Text style={[styles.statusLabel, { color: statusLine.color }]}>{statusLine.label}</Text>
              </View>
            </View>

            {/* Constituency / member since */}
            <View style={styles.metaGrid}>
              <View style={styles.metaCell}>
                <Text style={[styles.metaLabel, { color: colors.textTertiary }]}>CONSTITUENCY</Text>
                <Text style={[styles.metaValue, { color: colors.textSecondary }]} numberOfLines={1}>
                  {location || 'Not set'}
                </Text>
              </View>
              <View style={styles.metaCell}>
                <Text style={[styles.metaLabel, { color: colors.textTertiary }]}>MEMBER SINCE</Text>
                <Text style={[styles.metaValue, { color: colors.textSecondary }]} numberOfLines={1}>
                  {memberSince || 'Apr 2026'}
                </Text>
              </View>
            </View>

            {/* Credential footer */}
            <View style={[styles.footer, { borderTopColor: colors.borderSubtle }]}>
              <Text style={[styles.footerMono, { color: colors.textTertiary }]}>{folio}</Text>
              <Text style={[styles.footerMono, { color: colors.textTertiary }]}>{ledgerLine}</Text>
            </View>
          </View>
        </Animated.View>
      </View>

      {/* Verify prompt — unverified / pending / failed */}
      {!verified && (
        <Animated.View
          entering={FadeInUp.delay(200).duration(400)}
          style={[styles.verifyCta, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
        >
          <View style={styles.verifyCtaContent}>
            <View
              style={[
                styles.verifyCtaIcon,
                { backgroundColor: status === 'failed' ? colors.errorSurface : colors.goldSurface },
              ]}
            >
              <Ionicons
                name={status === 'failed' ? 'alert-circle-outline' : 'shield-checkmark-outline'}
                size={20}
                color={status === 'failed' ? colors.error : colors.gold}
              />
            </View>
            <View style={styles.verifyCtaText}>
              <Text style={[styles.verifyCtaTitle, { color: colors.text }]}>
                {status === 'pending'
                  ? 'Verification Pending'
                  : status === 'failed'
                    ? 'Verification Failed'
                    : 'Verify Your Identity'}
              </Text>
              <Text style={[styles.verifyCtaSubtitle, { color: colors.textSecondary }]}>
                {status === 'pending'
                  ? 'Your verification is being processed'
                  : status === 'failed'
                    ? 'Something went wrong — you can try again'
                    : 'Unlock voting and earn the Verified badge'}
              </Text>
            </View>
          </View>
          <View ref={verifyButtonRef} collapsable={false}>
            <Button
              title={startingKyc ? 'Starting...' : status === 'pending' ? 'Refresh' : status === 'failed' ? 'Try Again' : 'Verify Now'}
              onPress={onVerify}
              variant="primary"
              size="md"
              loading={startingKyc}
              disabled={startingKyc}
            />
          </View>
          <Text style={[styles.trustNote, { color: colors.textTertiary }]}>
            Your ID is confirmed, then discarded. Checked, never kept.
          </Text>
        </Animated.View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 22,
    gap: 16,
    marginBottom: 16,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: {
    fontFamily: FONTS.monoSemiBold,
    fontVariant: ['tabular-nums'],
    fontSize: 9.5,
    letterSpacing: 1.9,
  },
  seal: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  holder: {
    gap: 4,
  },
  name: {
    fontFamily: FONTS.serif,
    fontSize: 29,
    lineHeight: 32,
    letterSpacing: -0.29,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusLabel: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 11,
    letterSpacing: 1.32,
  },
  metaGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  metaCell: {
    flex: 1,
    gap: 2,
  },
  metaLabel: {
    fontFamily: FONTS.mono,
    fontVariant: ['tabular-nums'],
    fontSize: 8.5,
    letterSpacing: 1.36,
  },
  metaValue: {
    fontFamily: FONTS.sansMedium,
    fontSize: 12.5,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    paddingTop: 13,
  },
  footerMono: {
    fontFamily: FONTS.mono,
    fontVariant: ['tabular-nums'],
    fontSize: 10,
    letterSpacing: 1,
  },

  // Verify prompt
  verifyCta: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    marginBottom: 16,
  },
  verifyCtaContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  verifyCtaIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifyCtaText: { flex: 1 },
  verifyCtaTitle: { fontFamily: FONTS.sansSemiBold, fontSize: 15, marginBottom: 2 },
  verifyCtaSubtitle: { fontFamily: FONTS.sans, fontSize: 12.5, lineHeight: 17 },
  trustNote: {
    fontFamily: FONTS.sans,
    fontSize: 11.5,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 12,
  },
});
