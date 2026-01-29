import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Linking, Alert } from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuthStore } from '../../lib/auth';
import { useTheme } from '../../lib/theme';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://representportal.com';

interface SubscriptionData {
  subscription: string | null;
  status: string;
  endDate: string | null;
}

interface PriceData {
  priceId: string;
  amount: number;
  currency: string;
  interval: string;
}

export default function SubscriptionScreen() {
  const { colors } = useTheme();
  const { user, token } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [priceData, setPriceData] = useState<PriceData | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const [subRes, priceRes] = await Promise.all([
        fetch(`${API_URL}/api/stripe/subscription`, { headers }),
        fetch(`${API_URL}/api/stripe/prices`, { headers }),
      ]);

      if (subRes.ok) {
        setSubscription(await subRes.json());
      }
      if (priceRes.ok) {
        setPriceData(await priceRes.json());
      }
    } catch (error) {
      console.error('Error fetching subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async () => {
    if (!priceData?.priceId) {
      Alert.alert('Error', 'Unable to load pricing. Please try again.');
      return;
    }

    setActionLoading(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(`${API_URL}/api/stripe/checkout`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ priceId: priceData.priceId }),
      });

      if (response.ok) {
        const { url } = await response.json();
        await Linking.openURL(url);
      } else {
        throw new Error('Failed to create checkout');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to start checkout');
    } finally {
      setActionLoading(false);
    }
  };

  const handleManageBilling = async () => {
    setActionLoading(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(`${API_URL}/api/stripe/portal`, {
        method: 'POST',
        headers,
      });

      if (response.ok) {
        const { url } = await response.json();
        await Linking.openURL(url);
      } else {
        throw new Error('Failed to open billing portal');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to open billing');
    } finally {
      setActionLoading(false);
    }
  };

  const isActive = subscription?.status === 'active';

  const FREE_FEATURES = [
    'Vote on proposals',
    'Verify your identity',
    'View voting history',
    'Join communities',
  ];

  const PRO_FEATURES = [
    'Create unlimited proposals',
    'Featured proposal slot',
    'Priority governance access',
    'Analytics dashboard',
    'Early access to features',
    'Monthly rewards & badges',
  ];

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.gold} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.gold }]}>Subscription</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.gold} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.gold} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.gold }]}>Subscription</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {isActive && (
          <View style={[styles.statusBanner, { backgroundColor: colors.gold + '20', borderColor: colors.gold }]}>
            <Ionicons name="checkmark-circle" size={24} color={colors.gold} />
            <Text style={[styles.statusText, { color: colors.gold }]}>Pro Subscription Active</Text>
          </View>
        )}

        <View style={[styles.planCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <Text style={[styles.planName, { color: colors.text }]}>Free</Text>
          <Text style={[styles.planPrice, { color: colors.gold }]}>$0</Text>
          <Text style={[styles.planPeriod, { color: colors.textSecondary }]}>Forever free</Text>
          
          <View style={styles.featuresList}>
            {FREE_FEATURES.map((feature, index) => (
              <View key={index} style={styles.featureRow}>
                <Ionicons name="checkmark" size={18} color={colors.gold} />
                <Text style={[styles.featureText, { color: colors.text }]}>{feature}</Text>
              </View>
            ))}
          </View>

          {!isActive && (
            <View style={[styles.currentPlanBadge, { backgroundColor: colors.border }]}>
              <Text style={[styles.currentPlanText, { color: colors.textSecondary }]}>Current Plan</Text>
            </View>
          )}
        </View>

        <View style={[styles.planCard, styles.proPlanCard, { backgroundColor: colors.cardBg, borderColor: colors.gold }]}>
          <View style={[styles.recommendedBadge, { backgroundColor: colors.gold }]}>
            <Text style={[styles.recommendedText, { color: colors.background }]}>RECOMMENDED</Text>
          </View>
          
          <Text style={[styles.planName, { color: colors.gold }]}>Pro</Text>
          <View style={styles.priceRow}>
            <Text style={[styles.planPrice, { color: colors.gold }]}>$10</Text>
            <Text style={[styles.planPeriod, { color: colors.textSecondary }]}>/month</Text>
          </View>
          <Text style={[styles.planDescription, { color: colors.textSecondary }]}>Everything in Free, plus:</Text>
          
          <View style={styles.featuresList}>
            {PRO_FEATURES.map((feature, index) => (
              <View key={index} style={styles.featureRow}>
                <Ionicons name="checkmark" size={18} color={colors.gold} />
                <Text style={[styles.featureText, { color: colors.text }]}>{feature}</Text>
              </View>
            ))}
          </View>

          {isActive ? (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.gold }]}
              onPress={handleManageBilling}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <>
                  <Ionicons name="settings-outline" size={20} color={colors.background} />
                  <Text style={[styles.actionButtonText, { color: colors.background }]}>Manage Billing</Text>
                </>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.gold }]}
              onPress={handleSubscribe}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <>
                  <Ionicons name="card-outline" size={20} color={colors.background} />
                  <Text style={[styles.actionButtonText, { color: colors.background }]}>Subscribe Now</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        <View style={[styles.faqSection, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <Text style={[styles.faqTitle, { color: colors.gold }]}>FAQ</Text>
          
          <View style={styles.faqItem}>
            <Text style={[styles.faqQuestion, { color: colors.gold }]}>Can I cancel anytime?</Text>
            <Text style={[styles.faqAnswer, { color: colors.textSecondary }]}>
              Yes, cancel your subscription anytime with no questions asked.
            </Text>
          </View>
          
          <View style={styles.faqItem}>
            <Text style={[styles.faqQuestion, { color: colors.gold }]}>What payment methods?</Text>
            <Text style={[styles.faqAnswer, { color: colors.textSecondary }]}>
              We accept all major credit cards, Apple Pay, and Google Pay.
            </Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
  },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  content: { flex: 1, paddingHorizontal: 16 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
    gap: 12,
  },
  statusText: { fontSize: 16, fontWeight: '600' },
  planCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginBottom: 16,
  },
  proPlanCard: { borderWidth: 2, marginTop: 8 },
  recommendedBadge: {
    position: 'absolute',
    top: -12,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  recommendedText: { fontSize: 12, fontWeight: '700' },
  planName: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline' },
  planPrice: { fontSize: 36, fontWeight: '700' },
  planPeriod: { fontSize: 16, marginLeft: 4 },
  planDescription: { fontSize: 14, marginTop: 8, marginBottom: 16 },
  featuresList: { marginTop: 16, gap: 12 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureText: { fontSize: 15, flex: 1 },
  currentPlanBadge: {
    marginTop: 20,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  currentPlanText: { fontSize: 14, fontWeight: '600' },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  actionButtonText: { fontSize: 16, fontWeight: '700' },
  faqSection: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginTop: 8,
  },
  faqTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  faqItem: { marginBottom: 16 },
  faqQuestion: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  faqAnswer: { fontSize: 14, lineHeight: 20 },
});
