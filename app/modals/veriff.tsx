import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../lib/theme';
import { veriffApi, kycApi } from '../../lib/api';
import { useAuthStore } from '../../lib/auth';

type ErrorState = null | 'no-session' | 'webview-error' | 'cancelled';

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
        await kycApi.checkDecision(verificationId);
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

  if (errorState) {
    const messages: Record<Exclude<ErrorState, null>, { title: string; subtitle: string; icon: keyof typeof Ionicons.glyphMap }> = {
      'no-session': {
        title: "Couldn't start verification",
        subtitle: 'No verification session was found. Tap retry to start a new one.',
        icon: 'warning-outline',
      },
      'webview-error': {
        title: "Couldn't load verification",
        subtitle: 'Something went wrong loading the verification page. Please check your connection and try again.',
        icon: 'cloud-offline-outline',
      },
      cancelled: {
        title: "Verification didn't complete",
        subtitle: 'It looks like verification was cancelled. You can try again whenever you\'re ready.',
        icon: 'refresh-circle-outline',
      },
    };
    const msg = messages[errorState];

    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Identity Verification</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name={msg.icon} size={56} color={colors.gold} />
          <Text style={[styles.errorTitle, { color: colors.text }]}>{msg.title}</Text>
          <Text style={[styles.errorSubtitle, { color: colors.textSecondary }]}>{msg.subtitle}</Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.gold, opacity: retrying ? 0.6 : 1 }]}
            onPress={handleRetry}
            disabled={retrying}
          >
            {retrying ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.buttonText}>Try again</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleClose} disabled={retrying}>
            <Text style={[styles.secondaryButtonText, { color: colors.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  closeButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '600' },
  webview: { flex: 1 },
  loading: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 12, fontSize: 14 },
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  errorTitle: { fontSize: 20, fontWeight: '600', marginTop: 20, textAlign: 'center' },
  errorSubtitle: { fontSize: 14, lineHeight: 20, marginTop: 8, textAlign: 'center', paddingHorizontal: 16 },
  button: { marginTop: 32, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12, minWidth: 160, alignItems: 'center' },
  buttonText: { color: '#000', fontSize: 16, fontWeight: '600' },
  secondaryButton: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 10 },
  secondaryButtonText: { fontSize: 14, fontWeight: '500' },
});
