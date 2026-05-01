import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../lib/theme';
import { veriffApi } from '../../lib/api';

type ErrorState = null | 'no-session' | 'webview-error' | 'cancelled';

export default function VeriffScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ sessionUrl: string; verificationId: string }>();

  const [sessionUrl, setSessionUrl] = useState<string | undefined>(params.sessionUrl);
  const [verificationId, setVerificationId] = useState<string | undefined>(params.verificationId);
  const [errorState, setErrorState] = useState<ErrorState>(sessionUrl ? null : 'no-session');
  const [retrying, setRetrying] = useState(false);

  const handleClose = () => {
    router.back();
  };

  const handleRetry = useCallback(async () => {
    setRetrying(true);
    try {
      const response = await veriffApi.createSession();
      if (response.data?.sessionUrl && response.data?.verificationId) {
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
  }, []);

  const handleNavigationStateChange = (navState: any) => {
    const url = navState.url;
    if (url.includes('veriff.com')) {
      if (url.includes('cancelled') || url.includes('canceled')) {
        setErrorState('cancelled');
        return;
      }
      if (url.includes('finished') || url.includes('success')) {
        router.replace({
          pathname: '/(tabs)/profile',
          params: { verificationId, completed: 'true' },
        });
      }
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
