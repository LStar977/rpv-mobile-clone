import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Haptic feedback utility for premium tactile interactions
 * Only triggers on iOS/Android - no-ops on web
 */

// Check if haptics are available
const isHapticsAvailable = Platform.OS === 'ios' || Platform.OS === 'android';

/**
 * Light tap - for subtle selections
 * Use for: toggles, radio buttons, checkboxes, tab switches
 */
export const lightTap = () => {
  if (isHapticsAvailable) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
};

/**
 * Medium tap - for standard button presses
 * Use for: buttons, card presses, menu items
 */
export const mediumTap = () => {
  if (isHapticsAvailable) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }
};

/**
 * Heavy tap - for significant actions
 * Use for: important confirmations, drag-and-drop
 */
export const heavyTap = () => {
  if (isHapticsAvailable) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  }
};

/**
 * Selection feedback - for scrolling through options
 * Use for: pickers, scroll snapping, swipe gestures
 */
export const selectionTap = () => {
  if (isHapticsAvailable) {
    Haptics.selectionAsync();
  }
};

/**
 * Success notification - for completed actions
 * Use for: successful submissions, achievements, confirmations
 */
export const successNotification = () => {
  if (isHapticsAvailable) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }
};

/**
 * Warning notification - for cautionary feedback
 * Use for: warnings, approaching limits, pending states
 */
export const warningNotification = () => {
  if (isHapticsAvailable) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }
};

/**
 * Error notification - for failed actions
 * Use for: errors, validation failures, blocked actions
 */
export const errorNotification = () => {
  if (isHapticsAvailable) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }
};

// Export all haptic functions as a single object for convenience
export const haptics = {
  light: lightTap,
  medium: mediumTap,
  heavy: heavyTap,
  selection: selectionTap,
  success: successNotification,
  warning: warningNotification,
  error: errorNotification,
};

export default haptics;
