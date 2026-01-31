import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, {
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../lib/theme';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useAuthStore } from '../lib/auth';
import { router } from 'expo-router';
import { isBiometricAvailable, authenticateWithBiometrics } from '../lib/biometrics';
import { Button } from '../components/ui';
import { haptics } from '../lib/haptics';
import { ONBOARDING_KEY } from './onboarding';

GoogleSignin.configure({
  iosClientId: '945878560232-blus90hj4nqh6h32msts24971t72f8g7.apps.googleusercontent.com',
  webClientId: '945878560232-8ot8f3lr62436nlrm9qas82aras59koi.apps.googleusercontent.com',
  offlineAccess: true,
});

const HIGHLIGHTS = [
  { title: 'Verified voting', detail: 'One person, one voice in every community.' },
  { title: 'Policy intelligence', detail: 'Sentinel explains what matters fast.' },
  { title: 'Transparent outcomes', detail: 'See decisions with proof, not noise.' },
];

function HighlightCard({ title, detail, index }: { title: string; detail: string; index: number }) {
  const { colors } = useTheme();
  return (
    <Animated.View
      entering={FadeInUp.delay(index * 120).duration(400)}
      style={[styles.highlightCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
    >
      <Text style={[styles.highlightTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.highlightDetail, { color: colors.textSecondary }]}>{detail}</Text>
    </Animated.View>
  );
}

function PrimaryField({
  label,
  value,
  placeholder,
  onChangeText,
  keyboardType,
  secureTextEntry,
  autoCapitalize,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChangeText: (text: string) => void;
  keyboardType?: any;
  secureTextEntry?: boolean;
  autoCapitalize?: any;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.fieldGroup}>
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{label}</Text>
      <View style={[styles.fieldInputWrap, { backgroundColor: colors.cardBgLight, borderColor: colors.border }]}
    >
        <TextInput
          value={value}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry}
          autoCapitalize={autoCapitalize}
          style={[styles.fieldInput, { color: colors.text }]}
        />
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const { colors } = useTheme();
  const [view, setView] = useState<'welcome' | 'login' | 'signup'>('welcome');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const { login } = useAuthStore();

  const logoScale = useSharedValue(0.9);
  const logoOpacity = useSharedValue(0);

  useEffect(() => {
    logoOpacity.value = withTiming(1, { duration: 500 });
    logoScale.value = withSpring(1, { damping: 12, stiffness: 120 });
  }, []);

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const hasCompletedOnboarding = await AsyncStorage.getItem(ONBOARDING_KEY);
        if (!hasCompletedOnboarding) {
          router.replace('/onboarding');
          return;
        }
        setCheckingOnboarding(false);
      } catch (error) {
        console.error('Error checking onboarding status:', error);
        setCheckingOnboarding(false);
      }
    };
    checkOnboarding();
  }, []);

  useEffect(() => {
    AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
    isBiometricAvailable().then(setBiometricAvailable);
  }, []);

  const handleBiometricLogin = async () => {
    haptics.selection();
    setIsLoading(true);
    try {
      const result = await authenticateWithBiometrics();
      if (result.success) {
        Alert.alert('Biometric login', 'Biometric login is connected to your account.');
      }
    } catch (e) {
      console.error('Biometric login failed:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    haptics.selection();
    setIsLoading(true);
    setError('');

    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const tokens = await GoogleSignin.getTokens();

      const success = await login('google', tokens.accessToken, {
        email: userInfo.user.email,
        name: userInfo.user.name || undefined,
        profileImageUrl: userInfo.user.photo || undefined,
      });

      if (success) {
        router.replace('/(tabs)/dashboard');
      } else {
        setError('Google sign-in failed.');
      }
    } catch (error: any) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        setError('Sign-in cancelled');
      } else {
        setError('Unable to sign in with Google.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleAppleLogin = async () => {
    haptics.selection();
    setIsLoading(true);
    setError('');

    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      const success = await login('apple', credential.identityToken || '', {
        email: credential.email || undefined,
        name: credential.fullName?.givenName
          ? `${credential.fullName.givenName} ${credential.fullName.familyName || ''}`.trim()
          : undefined,
      });

      if (success) {
        router.replace('/(tabs)/dashboard');
      } else {
        setError('Apple sign-in failed.');
      }
    } catch (error) {
      console.error('Apple sign-in failed', error);
      setError('Unable to sign in with Apple.');
    } finally {
      setIsLoading(false);
    }
  };

  const headerCopy = useMemo(() => {
    if (view === 'login') return { title: 'Welcome back', subtitle: 'Pick up where your community left off.' };
    if (view === 'signup') return { title: 'Create your civic passport', subtitle: 'Build trust and vote with confidence.' };
    return { title: 'The new civic operating system.', subtitle: 'Verified decisions that feel human again.' };
  }, [view]);

  if (checkingOnboarding) {
    return (
      <View style={[styles.loadingWrap, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.gold} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Preparing your experience…</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <LinearGradient
        colors={[colors.background, colors.backgroundSecondary, colors.background]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Animated.View style={[styles.brandRow, logoAnimatedStyle]}>
          <View style={[styles.logoHalo, { backgroundColor: colors.goldLight }]} />
          <Image source={require('../assets/logo.png')} style={styles.logo} />
          <View>
            <Text style={[styles.brandTitle, { color: colors.text }]}>Represent</Text>
            <Text style={[styles.brandSubtitle, { color: colors.textMuted }]}>Civic design studio</Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400)} style={styles.heroBlock}>
          <Text style={[styles.heroTitle, { color: colors.text }]}>{headerCopy.title}</Text>
          <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>{headerCopy.subtitle}</Text>
        </Animated.View>

        {view === 'welcome' && (
          <View style={styles.highlightsGrid}>
            {HIGHLIGHTS.map((item, index) => (
              <HighlightCard key={item.title} title={item.title} detail={item.detail} index={index} />
            ))}
          </View>
        )}

        {view !== 'welcome' && (
          <View style={[styles.formCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
          >
            {view === 'signup' && (
              <PrimaryField
                label="Full name"
                value={name}
                placeholder="Ada Lovelace"
                onChangeText={setName}
                autoCapitalize="words"
              />
            )}
            <PrimaryField
              label="Email"
              value={email}
              placeholder="you@domain.com"
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <PrimaryField
              label="Password"
              value={password}
              placeholder="••••••••"
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />

            {error.length > 0 && <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>}

            <Button
              title={view === 'login' ? 'Sign in' : 'Create account'}
              onPress={() => Alert.alert('Demo', 'Email sign-in is not connected yet. Use Google or Apple.')}
              variant="primary"
              style={styles.primaryButton}
            />

            <View style={styles.switchRow}>
              <Text style={[styles.switchText, { color: colors.textSecondary }]}>
                {view === 'login' ? "Don't have an account?" : 'Already have access?'}
              </Text>
              <TouchableOpacity onPress={() => setView(view === 'login' ? 'signup' : 'login')}>
                <Text style={[styles.switchAction, { color: colors.gold }]}>Switch</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={[styles.actionBar, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
        >
          {view === 'welcome' ? (
            <>
              <Button title="Sign in" onPress={() => setView('login')} variant="primary" />
              <Button title="Create account" onPress={() => setView('signup')} variant="secondary" />
            </>
          ) : (
            <Button title="Back to overview" onPress={() => setView('welcome')} variant="secondary" />
          )}
        </View>

        <View style={styles.socialRow}>
          <TouchableOpacity
            style={[styles.socialButton, { borderColor: colors.border, backgroundColor: colors.cardBgLight }]}
            onPress={handleGoogleLogin}
            disabled={isLoading}
          >
            <Ionicons name="logo-google" size={20} color={colors.text} />
            <Text style={[styles.socialText, { color: colors.text }]}>Continue with Google</Text>
          </TouchableOpacity>

          {appleAvailable && (
            <TouchableOpacity
              style={[styles.socialButton, { borderColor: colors.border, backgroundColor: colors.cardBgLight }]}
              onPress={handleAppleLogin}
              disabled={isLoading}
            >
              <Ionicons name="logo-apple" size={20} color={colors.text} />
              <Text style={[styles.socialText, { color: colors.text }]}>Continue with Apple</Text>
            </TouchableOpacity>
          )}

          {biometricAvailable && (
            <TouchableOpacity
              style={[styles.socialButton, { borderColor: colors.border, backgroundColor: colors.cardBgLight }]}
              onPress={handleBiometricLogin}
              disabled={isLoading}
            >
              <Ionicons name="finger-print" size={20} color={colors.text} />
              <Text style={[styles.socialText, { color: colors.text }]}>Use biometrics</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.xl,
    paddingTop: SPACING.xl * 1.2,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
  },
  loadingText: {
    ...TYPOGRAPHY.bodyMedium,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  logoHalo: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    left: -18,
    top: -8,
    opacity: 0.7,
  },
  logo: {
    width: 44,
    height: 44,
  },
  brandTitle: {
    ...TYPOGRAPHY.headlineMedium,
  },
  brandSubtitle: {
    ...TYPOGRAPHY.bodySmall,
  },
  heroBlock: {
    marginBottom: SPACING.lg,
  },
  heroTitle: {
    ...TYPOGRAPHY.displaySmall,
    marginBottom: SPACING.sm,
  },
  heroSubtitle: {
    ...TYPOGRAPHY.bodyLarge,
  },
  highlightsGrid: {
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  highlightCard: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.lg,
    ...SHADOWS.soft,
  },
  highlightTitle: {
    ...TYPOGRAPHY.headlineSmall,
    marginBottom: SPACING.xs,
  },
  highlightDetail: {
    ...TYPOGRAPHY.bodyMedium,
  },
  formCard: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.lg,
    gap: SPACING.md,
    marginBottom: SPACING.lg,
    ...SHADOWS.soft,
  },
  fieldGroup: {
    gap: SPACING.xs,
  },
  fieldLabel: {
    ...TYPOGRAPHY.labelMedium,
  },
  fieldInputWrap: {
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: Platform.OS === 'ios' ? SPACING.sm : 0,
  },
  fieldInput: {
    ...TYPOGRAPHY.bodyLarge,
    minHeight: 44,
  },
  errorText: {
    ...TYPOGRAPHY.bodySmall,
  },
  primaryButton: {
    marginTop: SPACING.sm,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  switchText: {
    ...TYPOGRAPHY.bodySmall,
  },
  switchAction: {
    ...TYPOGRAPHY.labelMedium,
  },
  actionBar: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
    ...SHADOWS.soft,
  },
  socialRow: {
    gap: SPACING.sm,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
  },
  socialText: {
    ...TYPOGRAPHY.labelLarge,
  },
});
