import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
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
  withSequence,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, SPACING, RADIUS, TYPOGRAPHY, SHADOWS, EASING } from '../lib/theme';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useAuthStore } from '../lib/auth';
import { router } from 'expo-router';
import { isBiometricAvailable, getBiometricType, authenticateWithBiometrics, isBiometricEnabled } from '../lib/biometrics';
import { Button, Input, Card, Badge } from '../components/ui';
import { haptics } from '../lib/haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

GoogleSignin.configure({
  iosClientId: '945878560232-blus90hj4nqh6h32msts24971t72f8g7.apps.googleusercontent.com',
  webClientId: '945878560232-8ot8f3lr62436nlrm9qas82aras59koi.apps.googleusercontent.com',
  offlineAccess: true,
});

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

// Premium Feature Pill Component
function FeaturePill({
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

  return (
    <Animated.View
      entering={FadeInUp.delay(delay).duration(500).springify()}
      style={[styles.featurePill, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <IconComponent name={icon} size={16} color={colors.gold} />
      <Text style={[styles.featurePillText, { color: colors.textSecondary }]}>{label}</Text>
    </Animated.View>
  );
}

// Premium Social Button
function SocialButton({
  provider,
  onPress,
  disabled,
  loading,
}: {
  provider: 'google' | 'apple';
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const { colors, isDark } = useTheme();
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    if (!disabled) {
      haptics.light();
      scale.value = withSpring(0.97, EASING.springSnappy);
    }
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, EASING.springSnappy);
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const isGoogle = provider === 'google';
  const bgColor = isGoogle ? '#FFFFFF' : (isDark ? '#FFFFFF' : '#000000');
  const textColor = isGoogle ? '#1F1F1F' : (isDark ? '#000000' : '#FFFFFF');

  return (
    <AnimatedTouchable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      activeOpacity={1}
      style={[
        styles.socialButton,
        { backgroundColor: bgColor, opacity: disabled ? 0.5 : 1 },
        animatedStyle,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <>
          <Ionicons
            name={isGoogle ? 'logo-google' : 'logo-apple'}
            size={20}
            color={textColor}
          />
          <Text style={[styles.socialButtonText, { color: textColor }]}>
            {isGoogle ? 'Google' : 'Apple'}
          </Text>
        </>
      )}
    </AnimatedTouchable>
  );
}

// Biometric Quick Login Button
function BiometricButton({
  type,
  onPress,
}: {
  type: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const glow = useSharedValue(0);

  useEffect(() => {
    glow.value = withSequence(
      withTiming(1, { duration: 1500 }),
      withTiming(0.5, { duration: 1500 })
    );
  }, []);

  const handlePress = () => {
    haptics.medium();
    scale.value = withSequence(
      withSpring(0.92, EASING.springSnappy),
      withSpring(1, EASING.springSnappy)
    );
    onPress();
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glow.value, [0, 1], [0.3, 0.6], Extrapolation.CLAMP),
  }));

  const isFaceID = type === 'Face ID';

  return (
    <AnimatedTouchable
      onPress={handlePress}
      activeOpacity={1}
      style={[styles.biometricContainer, animatedStyle]}
    >
      <Animated.View style={[styles.biometricGlow, { backgroundColor: colors.gold }, glowStyle]} />
      <LinearGradient
        colors={[colors.goldLight, colors.gold, colors.goldDark] as any}
        style={styles.biometricButton}
      >
        <Ionicons
          name={isFaceID ? 'scan-outline' : 'finger-print-outline'}
          size={32}
          color={colors.black}
        />
      </LinearGradient>
      <Text style={[styles.biometricLabel, { color: colors.textSecondary }]}>
        {type}
      </Text>
    </AnimatedTouchable>
  );
}

export default function AuthScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<'welcome' | 'login' | 'signup'>('welcome');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState('Biometric');
  const { login, isAuthenticated, checkAuth } = useAuthStore();

  // Animations
  const logoScale = useSharedValue(0.8);
  const logoOpacity = useSharedValue(0);
  const contentOpacity = useSharedValue(0);

  useEffect(() => {
    logoOpacity.value = withTiming(1, { duration: 800 });
    logoScale.value = withSpring(1, EASING.springGentle);
    contentOpacity.value = withDelay(400, withTiming(1, { duration: 600 }));
  }, []);

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  // Check biometric availability
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

  // Redirect when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/(tabs)/dashboard');
    }
  }, [isAuthenticated]);

  const handleBiometricLogin = async () => {
    const result = await authenticateWithBiometrics(`Use ${biometricType} to sign in`);
    if (result.success) {
      haptics.success();
      await checkAuth();
      if (useAuthStore.getState().isAuthenticated) {
        router.replace('/(tabs)/dashboard');
      } else {
        haptics.error();
        Alert.alert('Session Expired', 'Please sign in again.');
      }
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const tokens = await GoogleSignin.getTokens();

      const userData = (userInfo as any).data?.user || (userInfo as any).user;
      const success = await login('google', tokens.accessToken, {
        email: userData?.email || '',
        name: userData?.name || '',
        profileImageUrl: userData?.photo || '',
      });

      if (success) {
        haptics.success();
        router.replace('/(tabs)/dashboard');
      } else {
        haptics.error();
        Alert.alert('Login Failed', 'Could not authenticate. Please try again.');
      }
    } catch (err: any) {
      if (err.code === statusCodes.SIGN_IN_CANCELLED) {
        // User cancelled
      } else if (err.code === statusCodes.IN_PROGRESS) {
        haptics.warning();
        Alert.alert('Please wait', 'Sign in is already in progress');
      } else {
        haptics.error();
        Alert.alert('Error', err.message || 'Failed to sign in with Google');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleAppleLogin = async () => {
    setAppleLoading(true);
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
        Alert.alert('Login Failed', 'Could not authenticate. Please try again.');
      }
    } catch (err: any) {
      if (err.code !== 'ERR_REQUEST_CANCELED') {
        haptics.error();
        Alert.alert('Error', 'An error occurred during Apple sign in');
      }
    } finally {
      setAppleLoading(false);
    }
  };

  const handleEmailAuth = () => {
    if (!email || !password || (view === 'signup' && !name)) {
      setError('Please fill in all fields');
      haptics.warning();
      return;
    }
    setError('');
    setIsLoading(true);
    // Simulated - replace with actual auth
    setTimeout(() => {
      setIsLoading(false);
      haptics.error();
      setError('Email authentication coming soon. Please use Google or Apple.');
    }, 1000);
  };

  // Welcome Screen
  if (view === 'welcome') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Background gradient */}
        <LinearGradient
          colors={['transparent', colors.goldSurface, 'transparent']}
          locations={[0, 0.5, 1]}
          style={styles.backgroundGradient}
        />

        {/* Content */}
        <View style={[styles.welcomeContent, { paddingTop: insets.top + 60 }]}>
          {/* Logo */}
          <Animated.View style={[styles.logoWrapper, logoAnimatedStyle]}>
            <View style={[styles.logoOuter, { borderColor: colors.gold + '30' }]}>
              <LinearGradient
                colors={[colors.surface, colors.surfaceElevated] as any}
                style={styles.logoInner}
              >
                <Image
                  source={require('../assets/logo.png')}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              </LinearGradient>
            </View>
            <Animated.View style={[styles.logoGlow, { backgroundColor: colors.gold }]} />
          </Animated.View>

          {/* Brand */}
          <Animated.Text
            entering={FadeInDown.delay(300).duration(600)}
            style={[styles.brandName, { color: colors.text }]}
          >
            Represent
          </Animated.Text>

          <Animated.Text
            entering={FadeInDown.delay(400).duration(600)}
            style={[styles.tagline, { color: colors.textSecondary }]}
          >
            Your voice in governance.{'\n'}Verified. Secure. Powerful.
          </Animated.Text>

          {/* Feature pills */}
          <View style={styles.featurePills}>
            <FeaturePill icon="shield-checkmark" label="Identity" delay={500} />
            <FeaturePill icon="checkmark-done-circle" label="Vote" delay={600} />
            <FeaturePill icon="sparkles" label="AI Analysis" delay={700} />
          </View>

          {/* Biometric login (if available) */}
          {biometricAvailable && (
            <Animated.View
              entering={FadeInUp.delay(800).duration(500)}
              style={styles.biometricSection}
            >
              <BiometricButton type={biometricType} onPress={handleBiometricLogin} />
            </Animated.View>
          )}

          {/* Auth buttons */}
          <Animated.View
            entering={FadeInUp.delay(900).duration(500)}
            style={styles.welcomeButtons}
          >
            <Button
              title="Get Started"
              onPress={() => setView('signup')}
              variant="primary"
              size="xl"
              fullWidth
            />
            <Button
              title="I have an account"
              onPress={() => setView('login')}
              variant="ghost"
              size="lg"
              fullWidth
            />
          </Animated.View>
        </View>

        {/* Bottom accent */}
        <LinearGradient
          colors={[colors.goldLight, colors.gold, colors.goldDark] as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.bottomAccent, { bottom: insets.bottom }]}
        />
      </View>
    );
  }

  // Login/Signup Screen
  const isLogin = view === 'login';

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[styles.authContent, { paddingTop: insets.top + 20 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Back button */}
        <Animated.View entering={FadeIn.duration(300)}>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => {
              haptics.light();
              setView('welcome');
              setError('');
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
        </Animated.View>

        {/* Header */}
        <Animated.View
          entering={FadeInDown.delay(100).duration(400)}
          style={styles.authHeader}
        >
          <View style={[styles.authLogo, { backgroundColor: colors.goldSurface }]}>
            <Image
              source={require('../assets/logo.png')}
              style={styles.authLogoImage}
              resizeMode="contain"
            />
          </View>
          <Text style={[styles.authTitle, { color: colors.text }]}>
            {isLogin ? 'Welcome back' : 'Create account'}
          </Text>
          <Text style={[styles.authSubtitle, { color: colors.textSecondary }]}>
            {isLogin
              ? 'Sign in to continue to Represent'
              : 'Join the future of civic engagement'}
          </Text>
        </Animated.View>

        {/* Social login buttons */}
        <Animated.View
          entering={FadeInUp.delay(200).duration(400)}
          style={styles.socialButtons}
        >
          <SocialButton
            provider="google"
            onPress={handleGoogleLogin}
            disabled={googleLoading || appleLoading}
            loading={googleLoading}
          />
          {Platform.OS === 'ios' && appleAvailable && (
            <SocialButton
              provider="apple"
              onPress={handleAppleLogin}
              disabled={googleLoading || appleLoading}
              loading={appleLoading}
            />
          )}
        </Animated.View>

        {/* Divider */}
        <Animated.View
          entering={FadeIn.delay(300).duration(400)}
          style={styles.divider}
        >
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          <Text style={[styles.dividerText, { color: colors.textTertiary }]}>or</Text>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        </Animated.View>

        {/* Form */}
        <Animated.View entering={FadeInUp.delay(350).duration(400)}>
          {error ? (
            <View style={[styles.errorBox, { backgroundColor: colors.errorSurface, borderColor: colors.error }]}>
              <Ionicons name="alert-circle" size={18} color={colors.error} />
              <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
            </View>
          ) : null}

          {!isLogin && (
            <Input
              label="Full Name"
              placeholder="Enter your name"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              leftIcon="person-outline"
            />
          )}

          <Input
            label="Email"
            placeholder="Enter your email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            leftIcon="mail-outline"
          />

          <Input
            label="Password"
            placeholder={isLogin ? 'Enter password' : 'Create a password'}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            leftIcon="lock-closed-outline"
          />

          <Button
            title={isLogin ? 'Sign In' : 'Create Account'}
            onPress={handleEmailAuth}
            variant="primary"
            size="lg"
            fullWidth
            loading={isLoading}
            style={{ marginTop: SPACING.sm }}
          />
        </Animated.View>

        {/* Switch auth */}
        <Animated.View
          entering={FadeIn.delay(450).duration(400)}
          style={styles.switchAuth}
        >
          <Text style={[styles.switchAuthText, { color: colors.textSecondary }]}>
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
          </Text>
          <TouchableOpacity
            onPress={() => {
              haptics.light();
              setView(isLogin ? 'signup' : 'login');
              setError('');
            }}
          >
            <Text style={[styles.switchAuthLink, { color: colors.gold }]}>
              {isLogin ? 'Sign up' : 'Sign in'}
            </Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Terms */}
        <Animated.Text
          entering={FadeIn.delay(500).duration(400)}
          style={[styles.terms, { color: colors.textTertiary }]}
        >
          By continuing, you agree to our Terms of Service and Privacy Policy
        </Animated.Text>
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
  loadingLogo: {
    borderRadius: RADIUS['2xl'],
    overflow: 'hidden',
  },
  loadingLogoGradient: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingLogoImage: {
    width: 56,
    height: 56,
  },
  loadingDots: {},
  backgroundGradient: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.5,
  },
  welcomeContent: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
  },
  logoWrapper: {
    marginBottom: SPACING['3xl'],
    position: 'relative',
  },
  logoOuter: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  logoInner: {
    width: '100%',
    height: '100%',
    borderRadius: 62,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 80,
    height: 80,
  },
  logoGlow: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    bottom: 20,
    borderRadius: 60,
    opacity: 0.15,
    zIndex: -1,
  },
  brandName: {
    fontSize: 48,
    fontWeight: '700',
    letterSpacing: -1.5,
    marginBottom: SPACING.md,
  },
  tagline: {
    ...TYPOGRAPHY.bodyLarge,
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: SPACING['3xl'],
  },
  featurePills: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING['3xl'],
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  featurePillText: {
    ...TYPOGRAPHY.labelSmall,
  },
  biometricSection: {
    marginBottom: SPACING['2xl'],
    alignItems: 'center',
  },
  biometricContainer: {
    alignItems: 'center',
  },
  biometricGlow: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    top: 4,
    left: 4,
  },
  biometricButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  biometricLabel: {
    ...TYPOGRAPHY.caption,
    marginTop: SPACING.sm,
  },
  welcomeButtons: {
    width: '100%',
    gap: SPACING.md,
    marginTop: 'auto',
    marginBottom: SPACING['2xl'],
  },
  bottomAccent: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 3,
    opacity: 0.6,
  },
  // Auth screen
  authContent: {
    flexGrow: 1,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING['3xl'],
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginBottom: SPACING.xl,
  },
  authHeader: {
    alignItems: 'center',
    marginBottom: SPACING['2xl'],
  },
  authLogo: {
    width: 64,
    height: 64,
    borderRadius: RADIUS.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  authLogoImage: {
    width: 44,
    height: 44,
  },
  authTitle: {
    ...TYPOGRAPHY.h2,
    marginBottom: SPACING.xs,
  },
  authSubtitle: {
    ...TYPOGRAPHY.body,
    textAlign: 'center',
  },
  socialButtons: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.xl,
  },
  socialButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    height: 52,
    borderRadius: RADIUS.md,
  },
  socialButtonText: {
    ...TYPOGRAPHY.label,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    ...TYPOGRAPHY.caption,
    marginHorizontal: SPACING.lg,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.lg,
  },
  errorText: {
    ...TYPOGRAPHY.bodySmall,
    flex: 1,
  },
  switchAuth: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: SPACING.xl,
  },
  switchAuthText: {
    ...TYPOGRAPHY.body,
  },
  switchAuthLink: {
    ...TYPOGRAPHY.body,
    fontWeight: '600',
  },
  terms: {
    ...TYPOGRAPHY.captionSmall,
    textAlign: 'center',
    marginTop: SPACING.xl,
    paddingHorizontal: SPACING.lg,
  },
});
