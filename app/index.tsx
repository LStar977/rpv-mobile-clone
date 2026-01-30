import { useState, useEffect } from 'react';
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
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../lib/theme';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useAuthStore } from '../lib/auth';
import { router } from 'expo-router';
import { isBiometricAvailable, getBiometricType, authenticateWithBiometrics, isBiometricEnabled } from '../lib/biometrics';
import { Button } from '../components/ui';
import { haptics } from '../lib/haptics';
import { ONBOARDING_KEY } from './onboarding';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

GoogleSignin.configure({
  iosClientId: '945878560232-blus90hj4nqh6h32msts24971t72f8g7.apps.googleusercontent.com',
  webClientId: '945878560232-8ot8f3lr62436nlrm9qas82aras59koi.apps.googleusercontent.com',
  offlineAccess: true,
});

// Animated Feature Icon Component
function FeatureIcon({
  icon,
  label,
  delay,
  IconComponent = Ionicons,
}: {
  icon: string;
  label: string;
  delay: number;
  IconComponent?: any;
}) {
  const { colors } = useTheme();
  const scale = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(delay, withSpring(1, { damping: 12, stiffness: 100 }));
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: scale.value,
  }));

  return (
    <Animated.View style={[styles.featureItem, animatedStyle]}>
      <View style={[styles.featureIconContainer, { borderColor: colors.gold }]}>
        <LinearGradient
          colors={[`${colors.gold}20`, `${colors.gold}05`]}
          style={styles.featureIconGradient}
        >
          <IconComponent name={icon} size={28} color={colors.gold} />
        </LinearGradient>
      </View>
      <Text style={[styles.featureLabel, { color: colors.textSecondary }]}>{label}</Text>
    </Animated.View>
  );
}

// Animated Input Component
function AnimatedInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  secureTextEntry,
  autoCapitalize,
  autoCorrect,
  delay = 0,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  keyboardType?: any;
  secureTextEntry?: boolean;
  autoCapitalize?: any;
  autoCorrect?: boolean;
  delay?: number;
}) {
  const { colors } = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = () => setIsFocused(true);
  const handleBlur = () => setIsFocused(false);

  return (
    <Animated.View
      entering={FadeInUp.delay(delay).duration(400)}
      style={styles.inputGroup}
    >
      <Text style={[styles.inputLabel, { color: isFocused ? colors.gold : colors.textSecondary }]}>
        {label}
      </Text>
      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: colors.cardBgLight,
            borderColor: isFocused ? colors.gold : colors.border,
          },
        ]}
      >
        <TextInput
          style={[styles.input, { color: colors.text }]}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          value={value}
          onChangeText={onChangeText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          selectionColor={colors.gold}
        />
      </View>
    </Animated.View>
  );
}

export default function HomeScreen() {
  const { colors, isDark } = useTheme();
  const [view, setView] = useState<'welcome' | 'login' | 'signup'>('welcome');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState('Biometric');
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const { login, isAuthenticated, checkAuth } = useAuthStore();

  // Logo animation
  const logoScale = useSharedValue(0.8);
  const logoOpacity = useSharedValue(0);

  useEffect(() => {
    logoOpacity.value = withTiming(1, { duration: 600 });
    logoScale.value = withSpring(1, { damping: 12, stiffness: 100 });
  }, []);

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  // Check if onboarding has been completed
  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const hasCompletedOnboarding = await AsyncStorage.getItem(ONBOARDING_KEY);
        if (!hasCompletedOnboarding) {
          // First time user - show onboarding
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

    const checkBiometric = async () => {
      const available = await isBiometricAvailable();
      const enabled = await isBiometricEnabled();

      if (available && enabled) {
        await checkAuth();
        const hasStoredSession = useAuthStore.getState().token !== null;
        setBiometricAvailable(hasStoredSession);
      } else {
        setBiometricAvailable(false);
      }

      if (available) {
        const type = await getBiometricType();
        setBiometricType(type);
      }
    };
    checkBiometric();
  }, []);

  const handleBiometricLogin = async () => {
    haptics.medium();
    const result = await authenticateWithBiometrics(`Use ${biometricType} to sign in`);
    if (result.success) {
      haptics.success();
      await checkAuth();
      if (useAuthStore.getState().isAuthenticated) {
        router.replace('/(tabs)/dashboard');
      } else {
        haptics.error();
        Alert.alert('Session Expired', 'Please sign in again with Google or Apple.');
      }
    }
  };

  // Show loading while checking onboarding status
  if (checkingOnboarding) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: colors.background }]}>
        <LinearGradient
          colors={[`${colors.gold}08`, 'transparent', `${colors.gold}05`]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
        <View style={[styles.loadingLogoBox, { backgroundColor: colors.goldLight }]}>
          <Text style={styles.loadingLogoText}>R</Text>
        </View>
        <ActivityIndicator size="small" color={colors.gold} style={{ marginTop: SPACING.xl }} />
      </View>
    );
  }

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/(tabs)/dashboard');
    }
  }, [isAuthenticated]);

  const handleGoogleLogin = async () => {
    haptics.medium();
    setIsLoading(true);
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const tokens = await GoogleSignin.getTokens();

      const success = await login('google', tokens.accessToken, {
        email: userInfo.data?.user?.email || '',
        name: userInfo.data?.user?.name || '',
        profileImageUrl: userInfo.data?.user?.photo || '',
      });

      if (success) {
        haptics.success();
        router.replace('/(tabs)/dashboard');
      } else {
        haptics.error();
        Alert.alert('Login Failed', 'Could not authenticate with the server. Please try again.');
      }
    } catch (err: any) {
      if (err.code === statusCodes.SIGN_IN_CANCELLED) {
        console.log('User cancelled');
      } else if (err.code === statusCodes.IN_PROGRESS) {
        haptics.warning();
        Alert.alert('Please wait', 'Sign in is already in progress');
      } else if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        haptics.error();
        Alert.alert('Error', 'Play services not available');
      } else {
        haptics.error();
        Alert.alert('Error', err.message || 'Failed to sign in with Google');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleAppleLogin = async () => {
    haptics.medium();
    setIsLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      const fullName = credential.fullName
        ? `${credential.fullName.givenName || ''} ${credential.fullName.familyName || ''}`.trim()
        : null;

      const success = await login('apple', credential.identityToken || '', {
        id: credential.user,
        email: credential.email || undefined,
        name: fullName || undefined,
      });

      if (success) {
        haptics.success();
        router.replace('/(tabs)/dashboard');
      } else {
        haptics.error();
        Alert.alert('Login Failed', 'Could not authenticate with the server. Please try again.');
      }
    } catch (err: any) {
      if (err.code === 'ERR_REQUEST_CANCELED') {
        console.log('User canceled Apple sign in');
      } else {
        haptics.error();
        Alert.alert('Error', 'An error occurred during Apple sign in');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Welcome Screen
  if (view === 'welcome') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Background gradient overlay */}
        <LinearGradient
          colors={[`${colors.gold}08`, 'transparent', `${colors.gold}05`]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />

        <View style={styles.welcomeContent}>
          {/* Logo */}
          <Animated.View style={[styles.logoContainer, logoAnimatedStyle]}>
            <LinearGradient
              colors={[colors.cardBgElevated, colors.cardBg]}
              style={styles.logoGradient}
            >
              <Image
                source={require('../assets/logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </LinearGradient>
            {/* Glow effect */}
            <View style={[styles.logoGlow, { shadowColor: colors.gold }]} />
          </Animated.View>

          {/* Brand Title */}
          <Animated.Text
            entering={FadeInDown.delay(200).duration(500)}
            style={[styles.brandTitle, { color: colors.text }]}
          >
            Represent
          </Animated.Text>

          <Animated.Text
            entering={FadeInDown.delay(300).duration(500)}
            style={[styles.tagline, { color: colors.textSecondary }]}
          >
            Your civic platform for identity, voting, and community.
          </Animated.Text>

          {/* Feature Icons */}
          <View style={styles.featuresRow}>
            <FeatureIcon icon="shield-outline" label="Identity" delay={400} />
            <FeatureIcon
              icon="vote-outline"
              label="Voice"
              delay={500}
              IconComponent={MaterialCommunityIcons}
            />
            <FeatureIcon icon="people-outline" label="Community" delay={600} />
          </View>

          {/* Buttons */}
          <Animated.View
            entering={FadeInUp.delay(700).duration(500)}
            style={styles.buttonContainer}
          >
            <Button
              title="Create Account"
              onPress={() => setView('signup')}
              variant="primary"
              size="xl"
              fullWidth
              icon="person-add-outline"
            />

            <Button
              title="Log In"
              onPress={() => setView('login')}
              variant="secondary"
              size="xl"
              fullWidth
              icon="log-in-outline"
            />

            {biometricAvailable && (
              <TouchableOpacity
                style={[styles.biometricButton, { borderColor: colors.gold }]}
                onPress={handleBiometricLogin}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={biometricType === 'Face ID' ? 'scan-outline' : 'finger-print-outline'}
                  size={24}
                  color={colors.gold}
                />
                <Text style={[styles.biometricButtonText, { color: colors.gold }]}>
                  Quick Sign In with {biometricType}
                </Text>
              </TouchableOpacity>
            )}
          </Animated.View>
        </View>

        {/* Bottom decoration */}
        <View style={[styles.bottomDecoration, { backgroundColor: colors.gold }]} />
      </View>
    );
  }

  // Auth Screen (Login/Signup)
  const isLogin = view === 'login';

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <LinearGradient
        colors={[`${colors.gold}05`, 'transparent']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.5 }}
      />

      <ScrollView
        contentContainerStyle={styles.authContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Back Button */}
        <Animated.View entering={FadeIn.duration(300)}>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: colors.cardBg }]}
            onPress={() => setView('welcome')}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
        </Animated.View>

        {/* Auth Card */}
        <Animated.View
          entering={FadeInUp.delay(100).duration(400).springify()}
          style={[
            styles.authCard,
            {
              backgroundColor: colors.cardBg,
              borderColor: colors.border,
              ...SHADOWS.lg,
            },
          ]}
        >
          {/* Header */}
          <View style={styles.authHeader}>
            <Animated.View
              entering={FadeInDown.delay(200).duration(400)}
              style={[styles.authLogoContainer, { backgroundColor: colors.cardBgLight }]}
            >
              <Image
                source={require('../assets/logo.png')}
                style={styles.authLogoImage}
                resizeMode="contain"
              />
            </Animated.View>

            <Animated.Text
              entering={FadeInDown.delay(250).duration(400)}
              style={[styles.authTitle, { color: colors.text }]}
            >
              {isLogin ? 'Welcome Back' : 'Join Represent'}
            </Animated.Text>

            <Animated.Text
              entering={FadeInDown.delay(300).duration(400)}
              style={[styles.authSubtitle, { color: colors.textSecondary }]}
            >
              {isLogin
                ? 'Sign in to access your wallet and civic platform'
                : 'Create your account to start participating in governance'}
            </Animated.Text>
          </View>

          {/* Error */}
          {error ? (
            <Animated.View
              entering={FadeIn.duration(200)}
              style={[styles.errorContainer, { backgroundColor: colors.errorLight, borderLeftColor: colors.error }]}
            >
              <Ionicons name="alert-circle" size={18} color={colors.error} />
              <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
            </Animated.View>
          ) : null}

          {/* Form */}
          {!isLogin && (
            <AnimatedInput
              label="Full Name"
              placeholder="Jane Doe"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              delay={350}
            />
          )}

          <AnimatedInput
            label="Email Address"
            placeholder="citizen@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            delay={isLogin ? 350 : 400}
          />

          <AnimatedInput
            label="Password"
            placeholder={isLogin ? 'Enter password' : 'Create a strong password'}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            delay={isLogin ? 400 : 450}
          />

          {/* Submit Button */}
          <Animated.View entering={FadeInUp.delay(500).duration(400)}>
            <Button
              title={isLoading ? (isLogin ? 'Signing in...' : 'Creating account...') : (isLogin ? 'Sign In' : 'Create Account')}
              onPress={() => {
                if (!email || !password || (!isLogin && !name)) {
                  setError('Please fill in all fields');
                  return;
                }
                setError('');
                setIsLoading(true);
                setTimeout(() => setIsLoading(false), 1500);
              }}
              variant="primary"
              size="lg"
              fullWidth
              loading={isLoading}
              style={{ marginTop: SPACING.md }}
            />
          </Animated.View>

          {/* Divider */}
          <Animated.View
            entering={FadeIn.delay(550).duration(400)}
            style={styles.orDivider}
          >
            <View style={[styles.orLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.orText, { color: colors.textMuted }]}>OR</Text>
            <View style={[styles.orLine, { backgroundColor: colors.border }]} />
          </Animated.View>

          {/* Social Login */}
          <Animated.View entering={FadeInUp.delay(600).duration(400)}>
            <TouchableOpacity
              style={[styles.socialButton, styles.googleButton, isLoading && styles.socialButtonDisabled]}
              onPress={handleGoogleLogin}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              <Ionicons name="logo-google" size={20} color="#fff" />
              <Text style={styles.googleButtonText}>
                {isLoading ? 'Signing in...' : 'Continue with Google'}
              </Text>
            </TouchableOpacity>

            {Platform.OS === 'ios' && appleAvailable && (
              <TouchableOpacity
                style={[styles.socialButton, styles.appleButton, isLoading && styles.socialButtonDisabled]}
                onPress={handleAppleLogin}
                disabled={isLoading}
                activeOpacity={0.8}
              >
                <Ionicons name="logo-apple" size={20} color="#000" />
                <Text style={styles.appleButtonText}>Continue with Apple</Text>
              </TouchableOpacity>
            )}
          </Animated.View>

          {/* Switch Auth */}
          <Animated.View entering={FadeIn.delay(700).duration(400)}>
            <TouchableOpacity
              style={styles.switchAuth}
              onPress={() => setView(isLogin ? 'signup' : 'login')}
            >
              <Text style={[styles.switchAuthText, { color: colors.textSecondary }]}>
                {isLogin ? "Don't have an account? " : 'Already have an account? '}
                <Text style={[styles.switchAuthLink, { color: colors.gold }]}>
                  {isLogin ? 'Sign up' : 'Sign in'}
                </Text>
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingLogoBox: {
    width: 80,
    height: 80,
    borderRadius: BORDER_RADIUS.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingLogoText: {
    fontSize: 40,
    fontWeight: '700',
    color: '#D4AF37',
  },
  // Welcome Screen
  welcomeContent: {
    flex: 1,
    paddingHorizontal: SPACING.xxl,
    paddingTop: SCREEN_HEIGHT * 0.1,
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: SPACING.xxxl,
    position: 'relative',
  },
  logoGradient: {
    width: 120,
    height: 120,
    borderRadius: BORDER_RADIUS.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImage: {
    width: 100,
    height: 100,
  },
  logoGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: BORDER_RADIUS.xxl,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 30,
  },
  brandTitle: {
    fontSize: 44,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: SPACING.md,
  },
  tagline: {
    ...TYPOGRAPHY.bodyLarge,
    textAlign: 'center',
    lineHeight: 26,
    maxWidth: 300,
    marginBottom: SPACING.huge,
  },
  featuresRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.huge,
    marginBottom: SPACING.huge,
  },
  featureItem: {
    alignItems: 'center',
  },
  featureIconContainer: {
    width: 72,
    height: 72,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1.5,
    marginBottom: SPACING.md,
    overflow: 'hidden',
  },
  featureIconGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureLabel: {
    ...TYPOGRAPHY.labelMedium,
  },
  buttonContainer: {
    width: '100%',
    gap: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.full,
    gap: SPACING.md,
    marginTop: SPACING.sm,
  },
  biometricButtonText: {
    ...TYPOGRAPHY.labelLarge,
  },
  bottomDecoration: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    opacity: 0.3,
  },
  // Auth Screen
  authContent: {
    flexGrow: 1,
    padding: SPACING.xl,
    paddingTop: 60,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: BORDER_RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xl,
  },
  authCard: {
    borderRadius: BORDER_RADIUS.xxl,
    padding: SPACING.xxl,
    borderWidth: 1,
  },
  authHeader: {
    alignItems: 'center',
    marginBottom: SPACING.xxl,
  },
  authLogoContainer: {
    width: 80,
    height: 80,
    borderRadius: BORDER_RADIUS.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
    overflow: 'hidden',
  },
  authLogoImage: {
    width: 64,
    height: 64,
  },
  authTitle: {
    ...TYPOGRAPHY.headlineLarge,
    marginBottom: SPACING.sm,
  },
  authSubtitle: {
    ...TYPOGRAPHY.bodyMedium,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.lg,
    borderLeftWidth: 3,
    gap: SPACING.sm,
  },
  errorText: {
    ...TYPOGRAPHY.bodyMedium,
    flex: 1,
  },
  inputGroup: {
    marginBottom: SPACING.lg,
  },
  inputLabel: {
    ...TYPOGRAPHY.labelMedium,
    marginBottom: SPACING.sm,
  },
  inputContainer: {
    borderWidth: 1.5,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  input: {
    ...TYPOGRAPHY.bodyLarge,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md + 2,
  },
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: SPACING.xl,
  },
  orLine: {
    flex: 1,
    height: 1,
  },
  orText: {
    ...TYPOGRAPHY.labelMedium,
    marginHorizontal: SPACING.lg,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.full,
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  socialButtonDisabled: {
    opacity: 0.5,
  },
  googleButton: {
    backgroundColor: '#4285F4',
  },
  googleButtonText: {
    ...TYPOGRAPHY.labelLarge,
    color: '#fff',
  },
  appleButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  appleButtonText: {
    ...TYPOGRAPHY.labelLarge,
    color: '#000',
  },
  switchAuth: {
    alignItems: 'center',
    paddingTop: SPACING.md,
  },
  switchAuthText: {
    ...TYPOGRAPHY.bodyMedium,
  },
  switchAuthLink: {
    fontWeight: '600',
  },
});
