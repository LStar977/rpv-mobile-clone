import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ImageBackground,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const HERO_IMAGE =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDk5nyt5hZ5yGkzebF0ce2qxsIZGvV_JTqU6pBdNMlBapLTCsc6vmNHn1BqXPKtsJ2F-tmpSqYRx2vjJhI-fL1Ay0BZ7WUZxqe-grkwCYyBdScT-hZMfR7CqMpJPv-NZ2KcGWvwDNeY_iIjFnnkqXdgkuD58-mZgaH-2ja_tX5_KdaYUyll1tSEa38zZmaSmBPiXDwrWUdYfSFQ1uJjDEFOAupw-5xKcFoiseM3dUqyCo-q_SVCTfeVYzMH--jcuz398li-ZfnUrAxQ';

export default function SentinelScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton}>
          <MaterialIcons name="arrow-back" size={22} color="#d4d4d8" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <MaterialIcons name="auto-awesome" size={18} color="#eab957" />
          <Text style={styles.headerTitle}>Sentinel AI</Text>
        </View>
        <TouchableOpacity style={styles.headerButton}>
          <MaterialIcons name="share" size={20} color="#d4d4d8" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.badgeRow}>
          <MaterialIcons name="verified" size={14} color="#eab957" />
          <Text style={styles.badgeText}>AI Generated • Verified Source</Text>
        </View>

        <Text style={styles.title}>H.R. 4521 - The Sustainable Infrastructure Act</Text>
        <Text style={styles.subtitle}>Introduced Jan 12, 2024 • Committee on Energy</Text>

        <ImageBackground source={{ uri: HERO_IMAGE }} style={styles.heroCard} imageStyle={styles.heroImage}>
          <View style={styles.heroOverlay} />
          <View style={styles.heroContent}>
            <View style={styles.heroTitleRow}>
              <View style={styles.heroIcon}>
                <MaterialIcons name="description" size={18} color="#eab957" />
              </View>
              <Text style={styles.heroTitle}>Executive Summary</Text>
            </View>
            <Text style={styles.heroBody}>
              This bill proposes a 10% tax credit for green construction but introduces stricter zoning laws
              for residential areas. It aims to accelerate urban sustainability while managing suburban sprawl.
            </Text>
          </View>
        </ImageBackground>

        <View style={styles.segmentedControl}>
          <TouchableOpacity style={[styles.segmentButton, styles.segmentActive]}>
            <Text style={styles.segmentActiveText}>Summary</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.segmentButton}>
            <Text style={styles.segmentText}>Full Text</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.segmentButton}>
            <Text style={styles.segmentText}>Impact</Text>
          </TouchableOpacity>
        </View>

        <InsightCard
          accent="#22c55e"
          icon="trending-up"
          title="Arguments For"
          items={[
            'Incentivizes eco-friendly building materials, potentially reducing carbon footprint by 15% over 5 years.',
            'Projected to create 50,000 new jobs in the renewable construction sector.',
          ]}
        />

        <InsightCard
          accent="#ef4444"
          icon="trending-down"
          title="Arguments Against"
          items={[
            'Increases initial construction costs by estimated 15%, potentially slowing new housing starts.',
            'Stricter zoning may cause displacement in existing semi-urban residential zones.',
          ]}
        />

        <View style={styles.neutralCard}>
          <View style={styles.neutralAccent} />
          <View style={styles.neutralHeader}>
            <View style={styles.neutralIcon}>
              <MaterialIcons name="insights" size={18} color="#eab957" />
            </View>
            <Text style={styles.neutralTitle}>Neutral Context</Text>
          </View>
          <Text style={styles.neutralBody}>
            Similar legislation passed in the Pacific Northwest in 2018 resulted in mixed economic outcomes.
            While green jobs increased, housing prices rose by 3% in affected zones.
          </Text>
          <View style={styles.neutralSource}>
            <Text style={styles.sourceLabel}>Source:</Text>
            <Text style={styles.sourceLink}>Congressional Budget Office Report 2023-A</Text>
          </View>
        </View>

        <View style={styles.feedbackSection}>
          <Text style={styles.feedbackText}>Was this insight helpful?</Text>
          <View style={styles.feedbackButtons}>
            <TouchableOpacity style={styles.feedbackButton}>
              <MaterialIcons name="thumb-up" size={20} color="#9ca3af" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.feedbackButton}>
              <MaterialIcons name="thumb-down" size={20} color="#9ca3af" />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <View style={styles.fab}>
        <MaterialIcons name="chat" size={18} color="#18181b" />
        <Text style={styles.fabText}>Ask Sentinel</Text>
      </View>
    </View>
  );
}

function InsightCard({
  accent,
  icon,
  title,
  items,
}: {
  accent: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  items: string[];
}) {
  return (
    <View style={styles.insightCard}>
      <View style={[styles.accentBar, { backgroundColor: accent }]} />
      <View style={styles.insightHeader}>
        <View style={[styles.insightIcon, { backgroundColor: `${accent}22` }]}>
          <MaterialIcons name={icon} size={18} color={accent} />
        </View>
        <Text style={styles.insightTitle}>{title}</Text>
      </View>
      {items.map((item, index) => (
        <View key={item} style={styles.insightRow}>
          <MaterialIcons name="check-circle" size={18} color={accent} style={{ marginTop: 2 }} />
          <Text style={styles.insightText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#18181b',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(24,24,27,0.95)',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    padding: 18,
    paddingBottom: 120,
    gap: 14,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(234,185,87,0.2)',
    backgroundColor: 'rgba(234,185,87,0.1)',
    alignSelf: 'flex-start',
  },
  badgeText: {
    color: '#eab957',
    fontSize: 11,
    fontWeight: '600',
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
  },
  heroCard: {
    borderRadius: 16,
    overflow: 'hidden',
    minHeight: 170,
    justifyContent: 'flex-end',
  },
  heroImage: {
    resizeMode: 'cover',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(39,39,42,0.8)',
  },
  heroContent: {
    padding: 16,
    gap: 10,
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(234,185,87,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(234,185,87,0.3)',
  },
  heroTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  heroBody: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    lineHeight: 21,
  },
  segmentedControl: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 14,
    backgroundColor: '#27272a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: '#eab957',
  },
  segmentActiveText: {
    color: '#18181b',
    fontWeight: '700',
    fontSize: 12,
  },
  segmentText: {
    color: '#a1a1aa',
    fontWeight: '600',
    fontSize: 12,
  },
  insightCard: {
    borderRadius: 16,
    backgroundColor: '#27272a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 16,
    position: 'relative',
    overflow: 'hidden',
    gap: 12,
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  insightIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  insightRow: {
    flexDirection: 'row',
    gap: 10,
  },
  insightText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    lineHeight: 19,
    flex: 1,
  },
  neutralCard: {
    borderRadius: 16,
    backgroundColor: '#27272a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 16,
    position: 'relative',
    overflow: 'hidden',
    gap: 10,
  },
  neutralAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: '#eab957',
  },
  neutralHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  neutralIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(234,185,87,0.2)',
  },
  neutralTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  neutralBody: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    lineHeight: 19,
  },
  neutralSource: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingTop: 8,
    marginTop: 6,
  },
  sourceLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sourceLink: {
    color: '#eab957',
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  feedbackSection: {
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  feedbackText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
  },
  feedbackButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  feedbackButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#27272a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#eab957',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    shadowColor: '#eab957',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  fabText: {
    color: '#18181b',
    fontSize: 12,
    fontWeight: '700',
  },
});
