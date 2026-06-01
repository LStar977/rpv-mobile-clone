import React from 'react';
import { View, Text, StyleSheet, Linking, Platform } from 'react-native';
import { useTheme, SPACING, TYPOGRAPHY } from '../../lib/theme';

/**
 * Apple Guideline 3.1.2(c) disclosure block. Required on any screen where a
 * paid subscription or one-time purchase is initiated. Must include functional
 * links to the privacy policy and terms of use, plus auto-renewal language for
 * subscriptions. Drop this in below the price/plan summary on any paid screen.
 *
 * `mode`:
 *   'subscription' — auto-renewing (Premium, org tiers)
 *   'consumable'   — one-time (verification unlock fees)
 */
export function SubscriptionLegal({
  mode = 'subscription',
  productTitle,
  productLength,
  productPrice,
}: {
  mode?: 'subscription' | 'consumable';
  productTitle?: string;       // e.g. "Premium", "Pro", "Verification Unlock"
  productLength?: string;      // e.g. "1 month", "one-time"
  productPrice?: string;       // e.g. "$7.99", "$199.99"
}) {
  const { colors } = useTheme();
  const isIos = Platform.OS === 'ios';
  const settingsName = isIos ? 'App Store settings' : 'Google Play settings';

  return (
    <View style={styles.wrap}>
      {(productTitle || productPrice) && (
        <View style={[styles.summary, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          {productTitle && (
            <View style={styles.row}>
              <Text style={[styles.k, { color: colors.textSecondary }]}>Product</Text>
              <Text style={[styles.v, { color: colors.text }]}>{productTitle}</Text>
            </View>
          )}
          {productLength && (
            <View style={styles.row}>
              <Text style={[styles.k, { color: colors.textSecondary }]}>
                {mode === 'subscription' ? 'Length' : 'Type'}
              </Text>
              <Text style={[styles.v, { color: colors.text }]}>
                {mode === 'subscription' ? `${productLength} (auto-renewing)` : productLength}
              </Text>
            </View>
          )}
          {productPrice && (
            <View style={styles.row}>
              <Text style={[styles.k, { color: colors.textSecondary }]}>Price</Text>
              <Text style={[styles.v, { color: colors.text }]}>{productPrice}</Text>
            </View>
          )}
        </View>
      )}
      <Text style={[styles.body, { color: colors.textTertiary }]}>
        {mode === 'subscription' ? (
          <>
            Payment will be charged to your {isIos ? 'Apple ID' : 'Google account'} at confirmation
            of purchase. Subscription automatically renews unless auto-renew is turned off at least
            24 hours before the end of the current period. Your account will be charged for renewal
            within 24 hours prior to the end of the current period. You can manage subscriptions
            and turn off auto-renewal in your {settingsName} after purchase.
          </>
        ) : (
          <>
            This is a one-time purchase. Payment will be charged to your{' '}
            {isIos ? 'Apple ID' : 'Google account'} at confirmation. The unlock is non-refundable
            except as required by {isIos ? 'Apple' : 'Google'}'s standard refund policies.
          </>
        )}
      </Text>
      <Text style={[styles.body, { color: colors.textTertiary }]}>
        By {mode === 'subscription' ? 'subscribing' : 'purchasing'} you agree to our{' '}
        <Text
          style={[styles.link, { color: colors.text }]}
          onPress={() => Linking.openURL('https://representportal.com/terms')}
        >
          Terms of Use (EULA)
        </Text>
        {' and '}
        <Text
          style={[styles.link, { color: colors.text }]}
          onPress={() => Linking.openURL('https://representportal.com/privacy')}
        >
          Privacy Policy
        </Text>
        .
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: SPACING.md, marginTop: SPACING.lg },
  summary: { borderWidth: 1, borderRadius: 12, padding: SPACING.md, gap: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  k: { ...TYPOGRAPHY.bodySmall, fontWeight: '500' },
  v: { ...TYPOGRAPHY.bodyMedium, fontWeight: '600' },
  body: { ...TYPOGRAPHY.bodySmall, lineHeight: 18, textAlign: 'left' },
  link: { fontWeight: '600', textDecorationLine: 'underline' },
});

export default SubscriptionLegal;
