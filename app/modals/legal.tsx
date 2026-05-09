import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/theme';

const TERMS_URL = 'https://representportal.com/terms';
const PRIVACY_URL = 'https://representportal.com/privacy';
const SUPPORT_EMAIL = 'support@representvote.com';

export default function LegalScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const open = (url: string) => Linking.openURL(url).catch(() => { /* no-op */ });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border, paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Legal</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.intro, { color: colors.textSecondary }]}>
          By using Represent you agree to our Terms of Service and Privacy Policy.
        </Text>

        <TouchableOpacity
          style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => open(TERMS_URL)}
          activeOpacity={0.8}
        >
          <View style={[styles.iconWrap, { backgroundColor: `${colors.gold}15` }]}>
            <Ionicons name="document-text-outline" size={20} color={colors.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, { color: colors.text }]}>Terms of Service</Text>
            <Text style={[styles.rowSub, { color: colors.textSecondary }]}>How the platform may be used</Text>
          </View>
          <Ionicons name="open-outline" size={18} color={colors.textTertiary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => open(PRIVACY_URL)}
          activeOpacity={0.8}
        >
          <View style={[styles.iconWrap, { backgroundColor: `${colors.gold}15` }]}>
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, { color: colors.text }]}>Privacy Policy</Text>
            <Text style={[styles.rowSub, { color: colors.textSecondary }]}>What data we collect and why</Text>
          </View>
          <Ionicons name="open-outline" size={18} color={colors.textTertiary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => open(`mailto:${SUPPORT_EMAIL}`)}
          activeOpacity={0.8}
        >
          <View style={[styles.iconWrap, { backgroundColor: `${colors.gold}15` }]}>
            <Ionicons name="mail-outline" size={20} color={colors.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, { color: colors.text }]}>Contact Support</Text>
            <Text style={[styles.rowSub, { color: colors.textSecondary }]}>{SUPPORT_EMAIL}</Text>
          </View>
          <Ionicons name="open-outline" size={18} color={colors.textTertiary} />
        </TouchableOpacity>

        <Text style={[styles.footer, { color: colors.textTertiary }]}>
          Documents open in your browser. Support opens in your mail app.
        </Text>
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
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: 'Georgia', fontSize: 20, fontWeight: '600' },
  content: { padding: 20, paddingBottom: 60 },
  intro: { fontSize: 14, lineHeight: 21, marginBottom: 24 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 12,
  },
  iconWrap: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  rowTitle: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  rowSub: { fontSize: 12 },
  footer: { fontSize: 11, textAlign: 'center', marginTop: 24 },
});
