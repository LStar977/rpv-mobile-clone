import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuthStore } from '../../lib/auth';
import { useTheme } from '../../lib/theme';

export default function ProfileScreen() {
  const { colors } = useTheme();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: async () => { await logout(); router.replace('/'); }},
    ]);
  };

  const navigateTo = (screen: string) => router.push(screen as any);
  const getInitial = () => user?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.profileHeader}>
          <View style={[styles.avatar, { backgroundColor: colors.gold }]}><Text style={[styles.avatarText, { color: colors.background }]}>{getInitial()}</Text></View>
          <Text style={[styles.userName, { color: colors.text }]}>{user?.name || 'Citizen'}</Text>
          <Text style={[styles.userEmail, { color: colors.textSecondary }]}>{user?.email || ''}</Text>
          {user?.country && (
            <View style={[styles.locationBadge, { backgroundColor: colors.goldLight }]}>
              <Ionicons name="location" size={12} color={colors.gold} />
              <Text style={[styles.locationText, { color: colors.gold }]}>{[user.city, user.state, user.country].filter(Boolean).join(', ')}</Text>
            </View>
          )}
        </View>

        <View style={[styles.menuCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <TouchableOpacity style={[styles.menuRow, { borderBottomColor: colors.border }]} onPress={() => navigateTo('/modals/subscription')}>
            <Ionicons name="card-outline" size={22} color={colors.gold} style={styles.menuIcon} />
            <Text style={[styles.menuLabel, { color: colors.text }]}>Subscription</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.menuRow, { borderBottomColor: colors.border }]} onPress={() => navigateTo('/modals/wallet')}>
            <Ionicons name="wallet-outline" size={22} color={colors.gold} style={styles.menuIcon} />
            <Text style={[styles.menuLabel, { color: colors.text }]}>Connected Wallet</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.menuRow, { borderBottomColor: colors.border }]} onPress={() => navigateTo('/modals/voting-history')}>
            <Ionicons name="time-outline" size={22} color={colors.gold} style={styles.menuIcon} />
            <Text style={[styles.menuLabel, { color: colors.text }]}>Voting History</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.menuRow, { borderBottomColor: colors.border }]} onPress={() => navigateTo('/modals/badges')}>
            <Ionicons name="trophy-outline" size={22} color={colors.gold} style={styles.menuIcon} />
            <Text style={[styles.menuLabel, { color: colors.text }]}>Badges</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuRow} onPress={() => navigateTo('/modals/privacy')}>
            <Ionicons name="settings-outline" size={22} color={colors.gold} style={styles.menuIcon} />
            <Text style={[styles.menuLabel, { color: colors.text }]}>Settings</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={[styles.logoutButton, { backgroundColor: 'rgba(230, 57, 70, 0.1)', borderColor: '#e63946' }]} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#e63946" />
          <Text style={[styles.logoutText, { color: '#e63946' }]}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 80, paddingBottom: 100 },
  profileHeader: { alignItems: 'center', marginBottom: 24 },
  avatar: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  avatarText: { fontSize: 32, fontWeight: 'bold' },
  userName: { fontSize: 24, fontWeight: 'bold', marginBottom: 4 },
  userEmail: { fontSize: 14 },
  locationBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, marginTop: 12, gap: 4 },
  locationText: { fontSize: 12, fontWeight: '500' },
  menuCard: { borderRadius: 16, marginBottom: 24, borderWidth: 1, overflow: 'hidden' },
  menuRow: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  menuIcon: { marginRight: 14 },
  menuLabel: { flex: 1, fontSize: 16 },
  logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 12, padding: 16, borderWidth: 1, gap: 8 },
  logoutText: { fontSize: 16, fontWeight: '600' },
});
