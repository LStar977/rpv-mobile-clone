import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useAuthStore } from '../../lib/auth';
import { veriffApi, passportApi, userApi } from '../../lib/api';
import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../../lib/theme';
import { Button, SectionHeader } from '../../components/ui';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

// Status Card Component
function StatusCard({
  icon,
  title,
  subtitle,
  status,
  statusColor,
  children,
  delay = 0,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  status: 'none' | 'pending' | 'verified' | 'minted';
  statusColor: string;
  children?: React.ReactNode;
  delay?: number;
}) {
  const { colors } = useTheme();

  const getStatusIcon = () => {
    switch (status) {
      case 'verified':
      case 'minted':
        return 'checkmark-circle';
      case 'pending':
        return 'time';
      default:
        return 'ellipse-outline';
    }
  };

  return (
    <Animated.View
      entering={FadeInUp.delay(delay).duration(400)}
      style={[
        styles.statusCard,
        {
          backgroundColor: colors.cardBg,
          borderColor: status === 'verified' || status === 'minted' ? colors.success : colors.border,
          borderWidth: status === 'verified' || status === 'minted' ? 1.5 : 1,
        },
      ]}
    >
      <View style={styles.statusHeader}>
        <View
          style={[
            styles.statusIconBg,
            {
              backgroundColor:
                status === 'verified' || status === 'minted'
                  ? colors.successLight
                  : status === 'pending'
                  ? colors.warningLight
                  : colors.cardBgLight,
            },
          ]}
        >
          <Ionicons
            name={icon}
            size={28}
            color={
              status === 'verified' || status === 'minted'
                ? colors.success
                : status === 'pending'
                ? colors.warning
                : colors.textMuted
            }
          />
        </View>
        <View style={styles.statusInfo}>
          <Text style={[styles.statusTitle, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.statusSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: `${statusColor}15` }]}>
          <Ionicons name={getStatusIcon()} size={16} color={statusColor} />
        </View>
      </View>
      {children}
    </Animated.View>
  );
}

// Pulsing animation for pending state
function PulsingDot() {
  const { colors } = useTheme();
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.3, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.pulsingDot, { backgroundColor: colors.warning }, animatedStyle]} />
  );
}

export default function IdentityScreen() {
  const { colors } = useTheme();
  const { user, isAuthenticated } = useAuthStore();
  const params = useLocalSearchParams<{ verified?: string; verificationId?: string }>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'none' | 'pending' | 'verified'>('none');
  const [hasPassport, setHasPassport] = useState(false);
  const [startingVerification, setStartingVerification] = useState(false);
  const [mintingPassport, setMintingPassport] = useState(false);
  const [pendingVerificationId, setPendingVerificationId] = useState<string | null>(null);
  const [geoScope, setGeoScope] = useState<{ country?: string; state?: string; city?: string }>({});

  const fetchStatus = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    try {
      const [profileRes, passportRes] = await Promise.all([
        userApi.getVerificationStatus(),
        passportApi.getStatus(),
      ]);
      if (profileRes.data) {
        setVerificationStatus(profileRes.data.verified ? 'verified' : 'none');
        setGeoScope({
          country: profileRes.data.country,
          state: profileRes.data.state,
          city: profileRes.data.city,
        });
      }
      if (passportRes.data) setHasPassport(passportRes.data.hasMinted);
    } catch (error) {
      console.error('Error fetching status:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (pendingVerificationId) {
      const interval = setInterval(async () => {
        const result = await veriffApi.checkDecision(pendingVerificationId);
        if (result.data?.status === 'approved' || result.data?.decision === 'approved') {
          setVerificationStatus('verified');
          setPendingVerificationId(null);
          Alert.alert('Verification Complete', 'Your identity has been verified!');
        } else if (result.data?.status === 'declined' || result.data?.decision === 'declined') {
          setPendingVerificationId(null);
          setVerificationStatus('none');
          Alert.alert('Verification Failed', 'Please try again.');
        }
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [pendingVerificationId]);

  useEffect(() => {
    if ((params.verified === 'true' || params.verified === 'pending') && params.verificationId) {
      setPendingVerificationId(params.verificationId);
      setVerificationStatus('pending');
      veriffApi.checkDecision(params.verificationId).then((result) => {
        if (result.data?.status === 'approved' || result.data?.decision === 'approved') {
          setVerificationStatus('verified');
          setPendingVerificationId(null);
          Alert.alert('Verification Complete', 'Your identity has been verified!');
        }
      });
    }
  }, [params.verified, params.verificationId]);

  const handleStartVerification = async () => {
    if (!isAuthenticated) {
      Alert.alert('Sign In Required', 'Please sign in to verify your identity.');
      return;
    }
    setStartingVerification(true);
    try {
      const result = await veriffApi.createSession();
      if (result.error) {
        Alert.alert('Error', result.error);
        return;
      }

      const sessionUrl = result.data?.sessionUrl;
      const verificationId = result.data?.sessionId || result.data?.verificationId;

      if (sessionUrl) {
        setPendingVerificationId(verificationId || null);
        setVerificationStatus('pending');
        router.push({
          pathname: '/modals/veriff',
          params: { sessionUrl, verificationId },
        });
      } else {
        Alert.alert('Error', 'Could not start verification session.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to start verification.');
    } finally {
      setStartingVerification(false);
    }
  };

  const handleMintPassport = async () => {
    if (!isAuthenticated) {
      Alert.alert('Sign In Required', 'Please sign in.');
      return;
    }
    if (verificationStatus !== 'verified') {
      Alert.alert('Verification Required', 'Please complete identity verification first.');
      return;
    }
    setMintingPassport(true);
    try {
      const result = await passportApi.mint();
      if (result.error) {
        Alert.alert('Error', result.error);
        return;
      }
      setHasPassport(true);
      Alert.alert('Passport Minted', 'Your soulbound passport NFT has been minted!');
    } catch (error) {
      Alert.alert('Error', 'Failed to mint passport.');
    } finally {
      setMintingPassport(false);
    }
  };

  const getInitial = () =>
    user?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U';

  const getLocationString = () => {
    const parts = [geoScope.city, geoScope.state, geoScope.country].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : 'Location not verified';
  };

  // Not authenticated state
  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centerContent}>
          <View style={[styles.emptyIconBg, { backgroundColor: colors.cardBg }]}>
            <Ionicons name="person-outline" size={48} color={colors.textMuted} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Sign In Required</Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Sign in to manage your identity verification
          </Text>
          <Button
            title="Sign In"
            onPress={() => router.replace('/')}
            variant="primary"
            size="lg"
            style={{ marginTop: SPACING.xl }}
          />
        </View>
      </View>
    );
  }

  // Loading state
  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.gold} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchStatus();
            }}
            tintColor={colors.gold}
          />
        }
      >
        {/* Profile Card */}
        <Animated.View
          entering={FadeInDown.duration(500)}
          style={[styles.profileCard, { backgroundColor: colors.cardBg, borderColor: colors.gold }]}
        >
          <LinearGradient
            colors={[`${colors.gold}10`, 'transparent']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
          />
          <View style={[styles.avatar, { backgroundColor: colors.gold, ...SHADOWS.glow }]}>
            <Text style={[styles.avatarText, { color: colors.background }]}>{getInitial()}</Text>
          </View>
          <Text style={[styles.userName, { color: colors.text }]}>{user?.name || 'Citizen'}</Text>
          <Text style={[styles.userEmail, { color: colors.textSecondary }]}>{user?.email}</Text>
        </Animated.View>

        {/* Verification Status */}
        <SectionHeader title="IDENTITY VERIFICATION" style={{ marginTop: SPACING.lg }} />
        <StatusCard
          icon={verificationStatus === 'verified' ? 'shield-checkmark' : 'shield-outline'}
          title={
            verificationStatus === 'verified'
              ? 'Identity Verified'
              : verificationStatus === 'pending'
              ? 'Verification Pending'
              : 'Not Verified'
          }
          subtitle={
            verificationStatus === 'verified'
              ? getLocationString()
              : verificationStatus === 'pending'
              ? 'Checking verification status...'
              : 'Complete identity verification to vote'
          }
          status={verificationStatus}
          statusColor={
            verificationStatus === 'verified'
              ? colors.success
              : verificationStatus === 'pending'
              ? colors.warning
              : colors.textMuted
          }
          delay={200}
        >
          {verificationStatus === 'none' && (
            <Button
              title={startingVerification ? 'Starting...' : 'Start Verification'}
              onPress={handleStartVerification}
              variant="primary"
              size="lg"
              fullWidth
              loading={startingVerification}
              icon="scan-outline"
              style={{ marginTop: SPACING.lg }}
            />
          )}
          {verificationStatus === 'pending' && (
            <View style={[styles.pendingBanner, { backgroundColor: colors.warningLight }]}>
              <PulsingDot />
              <Text style={[styles.pendingText, { color: colors.warning }]}>
                Checking verification status...
              </Text>
            </View>
          )}
        </StatusCard>

        {/* Passport Status */}
        <SectionHeader title="REPRESENT PASSPORT" style={{ marginTop: SPACING.xl }} />
        <StatusCard
          icon={hasPassport ? 'ribbon' : 'ribbon-outline'}
          title={hasPassport ? 'Passport Minted' : 'No Passport'}
          subtitle={
            hasPassport
              ? 'Your soulbound passport NFT is active'
              : 'Mint your passport NFT to vote on proposals'
          }
          status={hasPassport ? 'minted' : 'none'}
          statusColor={hasPassport ? colors.success : colors.textMuted}
          delay={300}
        >
          {!hasPassport && (
            <Button
              title={
                mintingPassport
                  ? 'Minting...'
                  : verificationStatus !== 'verified'
                  ? 'Verify Identity First'
                  : 'Mint Passport'
              }
              onPress={handleMintPassport}
              variant={verificationStatus !== 'verified' ? 'secondary' : 'primary'}
              size="lg"
              fullWidth
              loading={mintingPassport}
              disabled={verificationStatus !== 'verified'}
              icon="diamond-outline"
              style={{ marginTop: SPACING.lg }}
            />
          )}
        </StatusCard>

        {/* Info Card */}
        <Animated.View
          entering={FadeInUp.delay(400).duration(400)}
          style={[styles.infoCard, { backgroundColor: colors.goldLight, borderColor: colors.gold }]}
        >
          <View style={[styles.infoIconBg, { backgroundColor: colors.gold }]}>
            <Ionicons name="information" size={20} color={colors.background} />
          </View>
          <View style={styles.infoContent}>
            <Text style={[styles.infoTitle, { color: colors.gold }]}>Why verify?</Text>
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              Identity verification ensures one person, one vote. Your soulbound passport NFT is
              tied to your verified identity and cannot be transferred.
            </Text>
          </View>
        </Animated.View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: 80,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xxl,
  },
  // Profile Card
  profileCard: {
    alignItems: 'center',
    padding: SPACING.xxl,
    borderRadius: BORDER_RADIUS.xxl,
    borderWidth: 1.5,
    overflow: 'hidden',
    ...SHADOWS.md,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '700',
  },
  userName: {
    ...TYPOGRAPHY.headlineMedium,
    marginBottom: SPACING.xs,
  },
  userEmail: {
    ...TYPOGRAPHY.bodyMedium,
  },
  // Status Card
  statusCard: {
    borderRadius: BORDER_RADIUS.xxl,
    padding: SPACING.xl,
    marginBottom: SPACING.md,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIconBg: {
    width: 56,
    height: 56,
    borderRadius: BORDER_RADIUS.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusInfo: {
    flex: 1,
    marginLeft: SPACING.lg,
  },
  statusTitle: {
    ...TYPOGRAPHY.headlineSmall,
    marginBottom: SPACING.xxs,
  },
  statusSubtitle: {
    ...TYPOGRAPHY.bodyMedium,
  },
  statusBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Pending Banner
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    marginTop: SPACING.lg,
    gap: SPACING.sm,
  },
  pendingText: {
    ...TYPOGRAPHY.labelMedium,
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  // Info Card
  infoCard: {
    flexDirection: 'row',
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    marginTop: SPACING.lg,
    borderWidth: 1,
  },
  infoIconBg: {
    width: 36,
    height: 36,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoContent: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  infoTitle: {
    ...TYPOGRAPHY.labelLarge,
    marginBottom: SPACING.xs,
  },
  infoText: {
    ...TYPOGRAPHY.bodySmall,
    lineHeight: 20,
  },
  // Empty State
  emptyIconBg: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xl,
  },
  emptyTitle: {
    ...TYPOGRAPHY.headlineMedium,
    marginBottom: SPACING.sm,
  },
  emptyText: {
    ...TYPOGRAPHY.bodyMedium,
    textAlign: 'center',
  },
  loadingText: {
    ...TYPOGRAPHY.bodyMedium,
    marginTop: SPACING.lg,
  },
  bottomPadding: {
    height: 120,
  },
});
