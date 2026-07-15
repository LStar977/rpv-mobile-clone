import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme, FONTS } from '../../lib/theme';
import { veriffApi, kycApi } from '../../lib/api';
import { useAuthStore } from '../../lib/auth';

type ErrorState = null | 'no-session' | 'webview-error' | 'cancelled' | 'duplicate';

const SUPPORT_EMAIL = 'support@representvote.com';

// Only load KYC-provider URLs in the WebView. The session URL comes from
// our backend, but defense-in-depth: a compromised response or MITM'd
// payload must not be able to point the identity-document camera flow at
// an arbitrary site.
function isTrustedKycUrl(url: string | undefined): url is string {
  if (!url || !url.startsWith('https://')) return false;
  try {
    const host = new URL(url).hostname;
    return host === 'didit.me' || host.endsWith('.didit.me') ||
           host === 'veriff.com' || host.endsWith('.veriff.com');
  } catch {
    return false;
  }
}

// Retry checklist shown on every failure state (P1). Every retry re-enters
// the capture flow, so the capture tips apply regardless of what failed.
const RETRY_CHECKLIST = [
  'Place the ID on a flat, dark surface',
  'Avoid glare — tilt away from direct light',
  'Keep all four corners inside the frame',
];

export default function VeriffScreen() {
  const { colors } = useTheme();
  // originatingOrgId: when present, this verification is org-paid (the
  // user's org has requireMemberVerification=true). Threaded through to
  // the session-create call so the backend packs it into vendor_data and
  // the org gets billed via Stripe metered usage on success.
  const params = useLocalSearchParams<{ sessionUrl?: string; verificationId?: string; originatingOrgId?: string; flow?: string }>();
  const originatingOrgId = typeof params.originatingOrgId === 'string' && params.originatingOrgId.length > 0
    ? params.originatingOrgId
    : undefined;
  // 'citizen' selects the Didit Citizen workflow (passport + proof of
  // address) which sets citizenshipVerified on success.
  const flow: 'standard' | 'citizen' = params.flow === 'citizen' ? 'citizen' : 'standard';

  const [sessionUrl, setSessionUrl] = useState<string | undefined>(
    isTrustedKycUrl(params.sessionUrl) ? params.sessionUrl : undefined,
  );
  const [verificationId, setVerificationId] = useState<string | undefined>(params.verificationId);
  // Start in `null` (loading) when no sessionUrl is preloaded — the
  // bootstrap effect below auto-creates one. Only flip to `no-session`
  // if that auto-create actually fails.
  const [errorState, setErrorState] = useState<ErrorState>(null);
  const [retrying, setRetrying] = useState(!params.sessionUrl);
  // Branded intro (X4) shown before handing off to the verifier WebView.
  const [stage, setStage] = useState<'intro' | 'webview'>('intro');
  // Failed tries so far — drives the "Attempt N of 5" line on P1 states.
  const [failures, setFailures] = useState(0);

  const handleClose = () => {
    // Refresh auth in the background — if the user actually completed
    // verification and just tapped X to close, the dashboard needs to see
    // the new verified state without a manual refresh.
    useAuthStore.getState().checkAuth().catch(() => {});
    router.back();
  };

  // Called on a positive verification signal from the WebView (either Didit
  // says "success" or the per-session callback redirected us). Force-pull
  // the decision so the backend updates even if the webhook hasn't fired
  // yet, then refresh the auth store so the home/profile reflect verified
  // state immediately, then close back to the app.
  const handleVerificationComplete = useCallback(async () => {
    try {
      if (verificationId) {
        const decision = await kycApi.checkDecision(verificationId);
        // P2 · the provider approved the documents but this identity has
        // already verified a different account — the server refused the
        // claim. Show the duplicate-identity screen instead of the profile.
        if (decision.data?.reason === 'duplicate_identity') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          setErrorState('duplicate');
          return;
        }
      }
    } catch {
      /* non-fatal */
    }
    try {
      await useAuthStore.getState().checkAuth();
    } catch {
      /* non-fatal */
    }
    router.replace({
      pathname: '/(tabs)/profile',
      params: { verificationId: verificationId ?? '', completed: 'true' },
    });
  }, [verificationId]);

  const handleRetry = useCallback(async () => {
    setRetrying(true);
    try {
      const response = await veriffApi.createSession(originatingOrgId, flow);
      if (isTrustedKycUrl(response.data?.sessionUrl) && response.data?.verificationId) {
        setSessionUrl(response.data.sessionUrl);
        setVerificationId(response.data.verificationId);
        setErrorState(null);
      } else {
        setErrorState('webview-error');
      }
    } catch (e) {
      setErrorState('webview-error');
    } finally {
      setRetrying(false);
    }
  }, [originatingOrgId, flow]);

  // Auto-bootstrap on mount when no sessionUrl was passed (the typical
  // path from the verification picker, which routes here with just a
  // flow param). Skips the "Try again" fallback screen on the happy path.
  useEffect(() => {
    if (!params.sessionUrl) {
      handleRetry();
    }
    // Intentionally only on mount — handleRetry is stable enough and we
    // don't want flow/orgId changes mid-screen to re-bootstrap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Count every entry into a failure state, for the P1 attempt line.
  useEffect(() => {
    if (errorState) setFailures((f) => f + 1);
  }, [errorState]);

  const handleNavigationStateChange = (navState: any) => {
    const url = navState.url || '';

    // Post-verification redirect. The backend sets the Didit per-session
    // `callback` to its own /api/didit/webhook URL, so after the user
    // finishes, Didit redirects the WebView to that backend endpoint —
    // which is server-to-server and renders nothing (the user sees
    // Replit's "Run this app" placeholder). Catch the URL here and bounce
    // back into the app.
    if (url.includes('/api/didit/webhook') || url.includes('/verification-complete')) {
      handleVerificationComplete();
      return;
    }

    // KYC provider host (Didit / legacy Veriff). Anything outside these
    // domains is either our own redirect (caught above) or noise the
    // WebView handles internally.
    const isKycHost = url.includes('didit.me') || url.includes('veriff.com');
    if (!isKycHost) return;

    if (url.includes('cancelled') || url.includes('canceled')) {
      setErrorState('cancelled');
      return;
    }
    if (url.includes('finished') || url.includes('success') || url.includes('complete')) {
      handleVerificationComplete();
    }
  };

  const CloseCircle = (
    <TouchableOpacity
      onPress={handleClose}
      style={[styles.closeCircle, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
      accessibilityLabel="Close"
    >
      <Ionicons name="close" size={18} color={colors.textSecondary} />
    </TouchableOpacity>
  );

  // ── P2 · duplicate identity detected ─────────────────────────────────
  // The documents were genuine — but this identity already verified a
  // different account. One person, one account: no retry offered. The two
  // honest paths are "sign in to the account you verified first" and
  // "report it" (someone may have used their ID).
  if (errorState === 'duplicate') {
    const caseRef = `RV-DUP-${String(verificationId || '').replace(/[^a-zA-Z0-9]/g, '').slice(-5).toUpperCase() || 'REVIEW'}`;
    const reportSubject = encodeURIComponent(`Duplicate identity report — CASE ${caseRef}`);
    const reportBody = encodeURIComponent(
      `I attempted to verify my identity and was told my ID is already attached to another Represent account. That wasn't me.\n\nCase: ${caseRef}\n\nPlease investigate.`,
    );
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.brandedBody}>
          <View style={styles.topRow}>
            {CloseCircle}
            <Text style={[styles.caseLabel, { color: colors.textTertiary }]}>CASE {caseRef}</Text>
          </View>

          <View style={styles.errorCenter}>
            <View style={[styles.errorCircle, { backgroundColor: colors.warningSurface, borderColor: `${colors.warning}4D` }]}>
              <Ionicons name="shield-outline" size={38} color={colors.warning} />
            </View>
            <Text style={[styles.errorTitle, { color: colors.text }]}>This identity is already verified</Text>
            <Text style={[styles.errorSubtitle, { color: colors.textSecondary }]}>
              One person, one ballot means an identity can only ever hold one account. This ID is
              already attached to another verified account.
            </Text>

            {/* A / B paths */}
            <View style={[styles.checklistCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle, paddingVertical: 14 }]}>
              <View style={styles.dupPathRow}>
                <Text style={[styles.dupPathKey, { color: colors.gold }]}>A</Text>
                <Text style={[styles.dupPathText, { color: colors.textSecondary }]}>
                  <Text style={[styles.dupPathLead, { color: colors.text }]}>That was me.</Text>
                  {' '}Sign in to your existing account — your record and verification are intact.
                </Text>
              </View>
              <View style={[styles.dupPathDivider, { backgroundColor: colors.borderSubtle }]} />
              <View style={styles.dupPathRow}>
                <Text style={[styles.dupPathKey, { color: colors.error }]}>B</Text>
                <Text style={[styles.dupPathText, { color: colors.textSecondary }]}>
                  <Text style={[styles.dupPathLead, { color: colors.text }]}>That wasn't me.</Text>
                  {' '}Someone may have used your ID. Report it and a human will investigate.
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.bottomStack}>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.goldFill }]}
              activeOpacity={0.8}
              accessibilityRole="button"
              onPress={async () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                try {
                  await useAuthStore.getState().logout();
                } catch { /* proceed regardless */ }
                router.replace('/');
              }}
            >
              <Text style={styles.primaryButtonText}>Sign In to My Account</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dupReportButton, { borderColor: `${colors.error}80` }]}
              activeOpacity={0.8}
              accessibilityRole="button"
              onPress={() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${reportSubject}&body=${reportBody}`);
              }}
            >
              <Text style={[styles.dupReportText, { color: colors.error }]}>Report — This Wasn't Me</Text>
            </TouchableOpacity>
            <Text style={[styles.attemptLine, { color: colors.textTertiary }]}>
              Nothing about this attempt is recorded on the ledger
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ── P1 · failure / decline states — honest retry layout ─────────────
  if (errorState) {
    const messages: Record<Exclude<ErrorState, null | 'duplicate'>, { title: string; subtitle: string; icon: keyof typeof Ionicons.glyphMap }> = {
      'no-session': {
        title: "Couldn't start verification",
        subtitle: 'No verification session was found. Nothing was saved. Tap Try Again to start a new one.',
        icon: 'card-outline',
      },
      'webview-error': {
        title: "Couldn't load verification",
        subtitle: 'Something went wrong loading the verification page. Nothing was saved — check your connection and try again.',
        icon: 'cloud-offline-outline',
      },
      cancelled: {
        title: "Verification didn't complete",
        subtitle: 'The check was cancelled before it finished. Nothing was saved — any images have already been discarded.',
        icon: 'card-outline',
      },
    };
    const msg = messages[errorState as Exclude<ErrorState, null | 'duplicate'>];
    const attempt = Math.min(failures + 1, 5);

    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.brandedBody}>
          {/* Top row */}
          <View style={styles.topRow}>
            {CloseCircle}
            <Text style={[styles.stepLabel, { color: colors.textTertiary }]}>STEP 2 OF 3</Text>
          </View>
          {/* Progress — middle segment failed */}
          <View style={styles.progressRow}>
            <View style={[styles.progressSeg, { backgroundColor: colors.goldFill }]} />
            <View style={[styles.progressSeg, { backgroundColor: colors.error }]} />
            <View style={[styles.progressSeg, { backgroundColor: colors.surfaceHighlight }]} />
          </View>

          <View style={styles.errorCenter}>
            <View style={[styles.errorCircle, { backgroundColor: colors.errorSurface, borderColor: `${colors.error}40` }]}>
              <Ionicons name={msg.icon} size={38} color={colors.error} />
            </View>
            <Text style={[styles.errorTitle, { color: colors.text }]}>{msg.title}</Text>
            <Text style={[styles.errorSubtitle, { color: colors.textSecondary }]}>{msg.subtitle}</Text>

            {/* Retry checklist */}
            <View style={[styles.checklistCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
              {RETRY_CHECKLIST.map((item, i) => (
                <View
                  key={item}
                  style={[
                    styles.checklistRow,
                    i < RETRY_CHECKLIST.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderSubtle },
                  ]}
                >
                  <Ionicons name="checkmark" size={15} color={colors.gold} />
                  <Text style={[styles.checklistText, { color: colors.textSecondary }]}>{item}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.bottomStack}>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.goldFill, opacity: retrying ? 0.6 : 1 }]}
              onPress={handleRetry}
              disabled={retrying}
              activeOpacity={0.8}
            >
              {retrying ? (
                <ActivityIndicator color="#040707" />
              ) : (
                <Text style={styles.primaryButtonText}>Try Again</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={handleClose} disabled={retrying}>
              <Text style={[styles.secondaryButtonText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.attemptLine, { color: colors.textTertiary }]}>
              Attempt {attempt} of 5 · then a human review takes over
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ── X4 · branded intro before handing off to the verifier ───────────
  if (stage === 'intro') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.brandedBody}>
          <View style={styles.topRow}>
            {CloseCircle}
            <Text style={[styles.stepLabel, { color: colors.textTertiary }]}>STEP 2 OF 3</Text>
          </View>
          <View style={styles.progressRow}>
            <View style={[styles.progressSeg, { backgroundColor: colors.goldFill }]} />
            <View style={[styles.progressSeg, { backgroundColor: colors.goldFill }]} />
            <View style={[styles.progressSeg, { backgroundColor: colors.surfaceHighlight }]} />
          </View>

          <View style={styles.introHeading}>
            <Text style={[styles.introTitle, { color: colors.text }]}>Scan Your ID</Text>
            <Text style={[styles.introSubtitle, { color: colors.textSecondary }]}>
              {flow === 'citizen'
                ? 'Have your passport and a proof-of-address document ready, then place each inside the frame.'
                : "Place your driver's licence, passport, or provincial ID inside the frame."}
            </Text>
          </View>

          {/* Capture area with gold corner brackets */}
          <View style={styles.frameWrap}>
            <View style={styles.frame}>
              <View style={[StyleSheet.absoluteFill, styles.frameFill, { backgroundColor: colors.surface }]} />
              <View style={[styles.corner, styles.cornerTL, { borderColor: colors.gold }]} />
              <View style={[styles.corner, styles.cornerTR, { borderColor: colors.gold }]} />
              <View style={[styles.corner, styles.cornerBL, { borderColor: colors.gold }]} />
              <View style={[styles.corner, styles.cornerBR, { borderColor: colors.gold }]} />
              <View style={styles.frameCenter}>
                <Ionicons name="card-outline" size={30} color={colors.textTertiary} />
                <Text style={[styles.frameLabel, { color: colors.textTertiary }]}>ALIGN ID WITHIN FRAME</Text>
              </View>
            </View>
          </View>

          {/* Auto-capture note */}
          <View style={styles.autoRow}>
            <View style={[styles.autoDot, { backgroundColor: colors.goldFill }]} />
            <Text style={[styles.autoText, { color: colors.text }]}>Hold steady — it captures automatically</Text>
          </View>

          {/* Encrypted-to-verifier trust note */}
          <View style={[styles.trustCard, { backgroundColor: colors.goldSurface, borderColor: colors.goldSurfaceIntense }]}>
            <Ionicons name="shield-outline" size={15} color={colors.gold} style={{ marginTop: 1 }} />
            <Text style={[styles.trustText, { color: colors.textSecondary }]}>
              <Text style={[styles.trustLead, { color: colors.text }]}>Checked, never kept.</Text>
              {' '}Encrypted directly to the verifier — Represent never sees or stores this image; it's discarded after the check.
            </Text>
          </View>

          <View style={styles.bottomStack}>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.goldFill, opacity: retrying || !sessionUrl ? 0.6 : 1 }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setStage('webview');
              }}
              disabled={retrying || !sessionUrl}
              activeOpacity={0.8}
            >
              {retrying || !sessionUrl ? (
                <ActivityIndicator color="#040707" />
              ) : (
                <Text style={styles.primaryButtonText}>Start Capture</Text>
              )}
            </TouchableOpacity>
            <Text style={[styles.attemptLine, { color: colors.textTertiary }]}>Takes about two minutes</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ── Verifier WebView (wiring unchanged) ──────────────────────────────
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
          <Ionicons name="close" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Identity Verification</Text>
        <View style={{ width: 40 }} />
      </View>
      <WebView
        source={{ uri: sessionUrl! }}
        style={styles.webview}
        onNavigationStateChange={handleNavigationStateChange}
        onError={() => setErrorState('webview-error')}
        onHttpError={(syntheticEvent) => {
          const { statusCode } = syntheticEvent.nativeEvent;
          if (statusCode >= 500) setErrorState('webview-error');
        }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        renderLoading={() => (
          <View style={[styles.loading, { backgroundColor: colors.background }]}>
            <ActivityIndicator size="large" color={colors.gold} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading verification...</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Branded (intro / P1) layout
  brandedBody: { flex: 1, paddingHorizontal: 28, paddingTop: 8, paddingBottom: 40, gap: 18 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  closeCircle: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepLabel: { fontFamily: FONTS.mono, fontSize: 10.5, letterSpacing: 1.7 },
  progressRow: { flexDirection: 'row', gap: 6 },
  progressSeg: { flex: 1, height: 4, borderRadius: 2 },

  // X4 intro
  introHeading: { gap: 6 },
  introTitle: { fontFamily: FONTS.serif, fontSize: 26, lineHeight: 30, letterSpacing: -0.3 },
  introSubtitle: { fontFamily: FONTS.sans, fontSize: 13.5, lineHeight: 20 },
  frameWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frame: { width: '100%', aspectRatio: 1.586, maxHeight: 220 },
  frameFill: { borderRadius: 18, opacity: 0.6 },
  corner: { position: 'absolute', width: 44, height: 44 },
  cornerTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 18 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 18 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 18 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 18 },
  frameCenter: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 8 },
  frameLabel: { fontFamily: FONTS.mono, fontSize: 11, letterSpacing: 1.5 },
  autoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  autoDot: { width: 7, height: 7, borderRadius: 4 },
  autoText: { fontFamily: FONTS.sansSemiBold, fontSize: 12.5 },
  trustCard: { flexDirection: 'row', gap: 11, alignItems: 'flex-start', borderWidth: 1, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 15 },
  trustText: { flex: 1, fontFamily: FONTS.sans, fontSize: 12, lineHeight: 18 },
  trustLead: { fontFamily: FONTS.sansSemiBold },

  // P2 duplicate identity
  caseLabel: { fontFamily: FONTS.mono, fontSize: 10.5, letterSpacing: 1.05 },
  dupPathRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  dupPathKey: { fontFamily: FONTS.monoSemiBold, fontSize: 11, marginTop: 1 },
  dupPathText: { flex: 1, fontFamily: FONTS.sans, fontSize: 12.5, lineHeight: 19 },
  dupPathLead: { fontFamily: FONTS.sansSemiBold },
  dupPathDivider: { height: 1, marginVertical: 12 },
  dupReportButton: { height: 50, borderRadius: 15, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  dupReportText: { fontFamily: FONTS.sansSemiBold, fontSize: 15 },

  // P1 failure
  errorCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },
  errorCircle: { width: 92, height: 92, borderRadius: 46, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  errorTitle: { fontFamily: FONTS.serif, fontSize: 27, lineHeight: 31, textAlign: 'center' },
  errorSubtitle: { fontFamily: FONTS.sans, fontSize: 14, lineHeight: 22, textAlign: 'center', maxWidth: 290 },
  checklistCard: { width: '100%', borderWidth: 1, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 17 },
  checklistRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 11 },
  checklistText: { fontFamily: FONTS.sans, fontSize: 13, flex: 1 },

  // Shared bottom stack
  bottomStack: { gap: 10 },
  primaryButton: { height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { fontFamily: FONTS.sansSemiBold, fontSize: 17, color: '#040707' },
  secondaryButton: { height: 46, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { fontFamily: FONTS.sansMedium, fontSize: 14.5 },
  attemptLine: { fontFamily: FONTS.mono, fontSize: 11.5, textAlign: 'center', fontVariant: ['tabular-nums'] },

  // WebView stage (unchanged)
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  closeButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: FONTS.serif, fontSize: 18 },
  webview: { flex: 1 },
  loading: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 12, fontFamily: FONTS.sans, fontSize: 14 },
});
