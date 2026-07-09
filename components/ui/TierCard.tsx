import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY, FONTS } from '../../lib/theme';
import type { OrgTier, OrgTierMeta } from '../../lib/org-tiers';

interface TierCardProps {
  tier: OrgTierMeta;
  tierKey: OrgTier;
  selected: boolean;
  onSelect: () => void;
  // Marks this card as the org's currently-active plan. Adds a "Current"
  // chip to the top-right and dims the price (since the user already pays
  // it). Defaults to false so create-organization stays unchanged.
  currentTier?: boolean;
}

export function TierCard({ tier, selected, onSelect, currentTier }: TierCardProps) {
  const { colors } = useTheme();
  const isContactOnly = tier.contactOnly;

  return (
    <TouchableOpacity
      style={[
        styles.tierCard,
        {
          backgroundColor: colors.surface,
          borderColor: selected ? colors.gold : colors.border,
          borderWidth: selected ? 2 : 1,
        },
      ]}
      onPress={onSelect}
      activeOpacity={0.8}
    >
      {tier.popular && !currentTier && (
        <View style={[styles.popularBadge, { backgroundColor: colors.gold }]}>
          <Text style={styles.popularText}>MOST POPULAR</Text>
        </View>
      )}
      {currentTier && (
        <View style={[styles.popularBadge, { backgroundColor: colors.success }]}>
          <Text style={styles.popularText}>CURRENT PLAN</Text>
        </View>
      )}

      <View style={styles.tierHeader}>
        <View style={[styles.tierIcon, { backgroundColor: `${colors.gold}15` }]}>
          <Ionicons name={tier.icon} size={24} color={colors.gold} />
        </View>
        <View style={styles.tierInfo}>
          <Text style={[styles.tierName, { color: colors.text }]}>{tier.name}</Text>
          <View style={styles.tierPriceRow}>
            <Text style={[styles.tierPrice, { color: colors.gold }]}>{tier.price}</Text>
            {!isContactOnly && (
              <Text style={[styles.tierPeriod, { color: colors.textSecondary }]}>/month</Text>
            )}
          </View>
        </View>
        <View
          style={[
            styles.radioOuter,
            { borderColor: selected ? colors.gold : colors.border },
          ]}
        >
          {selected && <View style={[styles.radioInner, { backgroundColor: colors.gold }]} />}
        </View>
      </View>

      <Text style={[styles.tierDescription, { color: colors.textSecondary }]}>
        {tier.description}
      </Text>

      <View style={styles.tierFeatures}>
        {tier.features.map((feature, index) => (
          <View key={index} style={styles.featureRow}>
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            <Text style={[styles.featureText, { color: colors.text }]}>{feature}</Text>
          </View>
        ))}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  tierCard: {
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    position: 'relative',
  },
  popularBadge: {
    position: 'absolute',
    top: -10,
    right: SPACING.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
  },
  popularText: {
    ...TYPOGRAPHY.labelSmall,
    color: '#000',
    fontSize: 10,
    letterSpacing: 1,
  },
  tierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.sm,
  },
  tierIcon: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tierInfo: {
    flex: 1,
  },
  tierName: {
    ...TYPOGRAPHY.headlineSmall,
    marginBottom: 2,
  },
  tierPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  tierPrice: {
    ...TYPOGRAPHY.headlineMedium,
    fontFamily: FONTS.monoSemiBold,
    fontVariant: ['tabular-nums'],
  },
  tierPeriod: {
    ...TYPOGRAPHY.bodySmall,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  tierDescription: {
    ...TYPOGRAPHY.bodySmall,
    marginBottom: SPACING.md,
  },
  tierFeatures: {
    gap: SPACING.sm,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  featureText: {
    ...TYPOGRAPHY.bodySmall,
    flex: 1,
  },
});

export default TierCard;
