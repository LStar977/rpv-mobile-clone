import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY, FONTS } from '../../lib/theme';

interface MultipleChoiceBallotProps {
  options: string[];
  onSubmit: (selectedOption: string) => void | Promise<void>;
  submitting?: boolean;
}

export function MultipleChoiceBallot({ options, onSubmit, submitting }: MultipleChoiceBallotProps) {
  const { colors } = useTheme();
  const [selected, setSelected] = useState<string | null>(null);

  const handleSelect = (option: string) => {
    Haptics.selectionAsync();
    setSelected(option);
  };

  const handleSubmit = async () => {
    if (!selected) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await onSubmit(selected);
  };

  const canSubmit = !submitting && selected !== null;

  return (
    <View>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>PICK ONE OPTION</Text>
        <Animated.View layout={LinearTransition.duration(200)}>
          {options.map((option) => {
            const isSelected = selected === option;
            return (
              <Animated.View key={option} entering={FadeIn.duration(150)}>
                <TouchableOpacity
                  style={[
                    styles.row,
                    {
                      borderColor: isSelected ? colors.gold : colors.border,
                      backgroundColor: isSelected ? `${colors.gold}10` : 'transparent',
                    },
                  ]}
                  onPress={() => handleSelect(option)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.radioOuter,
                      { borderColor: isSelected ? colors.gold : colors.border },
                    ]}
                  >
                    {isSelected && <View style={[styles.radioInner, { backgroundColor: colors.gold }]} />}
                  </View>
                  <Text
                    style={[
                      styles.optionText,
                      { color: isSelected ? colors.text : colors.textSecondary, fontFamily: isSelected ? FONTS.sansSemiBold : FONTS.sansMedium },
                    ]}
                    numberOfLines={3}
                  >
                    {option}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </Animated.View>
      </View>

      <TouchableOpacity
        style={[
          styles.submitButton,
          { backgroundColor: canSubmit ? colors.gold : `${colors.gold}40` },
        ]}
        onPress={handleSubmit}
        disabled={!canSubmit}
        activeOpacity={0.8}
      >
        {submitting ? (
          <ActivityIndicator color="#000" />
        ) : (
          <>
            <Ionicons name="checkmark-circle" size={20} color="#000" />
            <Text style={styles.submitButtonText}>
              {selected === null ? 'Pick an option' : 'Cast ballot'}
            </Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  label: {
    ...TYPOGRAPHY.labelSmall,
    letterSpacing: 1.5,
    marginBottom: SPACING.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderWidth: 1.5,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.sm,
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
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  optionText: {
    ...TYPOGRAPHY.bodyMedium,
    flex: 1,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    marginTop: SPACING.sm,
  },
  submitButtonText: {
    ...TYPOGRAPHY.labelLarge,
    color: '#000',
  },
});

export default MultipleChoiceBallot;
