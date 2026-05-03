import { Text, StyleSheet, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';

const O_GOLD = '#EABA58';
const O_BG_RAISED = '#15181C';

export function GlobalsPill({
  count,
  onPress,
}: {
  count: number;
  onPress: () => void;
}) {
  if (count === 0) return null;
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [styles.pill, pressed && { opacity: 0.7 }]}
    >
      <Text style={styles.globe}>🌍</Text>
      <Text style={styles.text}>
        <Text style={styles.count}>{count}</Text>
        {' '}global{count === 1 ? '' : ''} · everyone votes
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: O_BG_RAISED,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(234, 186, 88, 0.35)',
    gap: 8,
  },
  globe: {
    fontSize: 14,
  },
  text: {
    color: '#C7CACD',
    fontSize: 12,
    letterSpacing: 0.2,
  },
  count: {
    color: O_GOLD,
    fontWeight: '700',
  },
});
