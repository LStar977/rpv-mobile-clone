// Minimal stub — debugging UPDATE 30 render crash.
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/theme';

export default function YourCommunitiesModal() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ country?: string; state?: string; city?: string }>();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top + 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12 }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={26} color={colors.text} />
        </TouchableOpacity>
      </View>
      <View style={{ padding: 24 }}>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700' }}>
          Stub modal loaded
        </Text>
        <Text style={{ color: colors.textSecondary, marginTop: 12 }}>
          Country: {String(params.country ?? '(none)')}
        </Text>
        <Text style={{ color: colors.textSecondary }}>
          State: {String(params.state ?? '(none)')}
        </Text>
        <Text style={{ color: colors.textSecondary }}>
          City: {String(params.city ?? '(none)')}
        </Text>
      </View>
    </View>
  );
}
