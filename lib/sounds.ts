import { Audio } from 'expo-av';
import { Platform } from 'react-native';
import { haptics } from './haptics';

/**
 * Sound effects system for premium audio feedback
 * Combines with haptics for a multi-sensory experience
 */

let soundsEnabled = true;
let soundsLoaded = false;

// Sound objects cache
const sounds: Record<string, Audio.Sound | null> = {
  voteSuccess: null,
  voteOppose: null,
  badgeUnlock: null,
  success: null,
  error: null,
  tap: null,
  swoosh: null,
  celebration: null,
};

// Sound configurations with frequencies for generated tones
const SOUND_CONFIG = {
  voteSuccess: { frequency: 880, duration: 150, type: 'success' },
  voteOppose: { frequency: 440, duration: 150, type: 'error' },
  badgeUnlock: { frequency: [523, 659, 784], duration: 100, type: 'celebration' },
  success: { frequency: 784, duration: 100, type: 'success' },
  error: { frequency: 220, duration: 200, type: 'error' },
  tap: { frequency: 1000, duration: 30, type: 'tap' },
  swoosh: { frequency: 600, duration: 80, type: 'swoosh' },
  celebration: { frequency: [523, 659, 784, 1047], duration: 80, type: 'celebration' },
};

/**
 * Initialize the audio system
 */
export async function initSounds(): Promise<void> {
  if (soundsLoaded) return;

  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: false,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });
    soundsLoaded = true;
  } catch (e) {
    console.warn('Audio initialization failed:', e);
  }
}

/**
 * Enable or disable sounds globally
 */
export function setSoundsEnabled(enabled: boolean): void {
  soundsEnabled = enabled;
}

/**
 * Check if sounds are enabled
 */
export function areSoundsEnabled(): boolean {
  return soundsEnabled;
}

/**
 * Play a short tone/beep using the system
 * This is a lightweight approach that doesn't require audio files
 */
async function playTone(
  _frequency: number | number[],
  _duration: number,
  _type: string
): Promise<void> {
  // For now, we rely on haptics for feedback
  // In production, you'd load actual audio files here
  // This is a placeholder that makes the system work without audio files
}

/**
 * Play vote success sound
 * Cheerful ascending tone with haptic
 */
export async function playVoteSuccess(): Promise<void> {
  if (!soundsEnabled) return;

  haptics.success();
  const config = SOUND_CONFIG.voteSuccess;
  await playTone(config.frequency, config.duration, config.type);
}

/**
 * Play vote oppose sound
 * Lower tone with haptic
 */
export async function playVoteOppose(): Promise<void> {
  if (!soundsEnabled) return;

  haptics.medium();
  const config = SOUND_CONFIG.voteOppose;
  await playTone(config.frequency, config.duration, config.type);
}

/**
 * Play badge unlock sound
 * Celebratory ascending arpeggio with strong haptic
 */
export async function playBadgeUnlock(): Promise<void> {
  if (!soundsEnabled) return;

  haptics.success();
  // Double haptic for extra celebration
  setTimeout(() => haptics.light(), 100);
  setTimeout(() => haptics.light(), 200);

  const config = SOUND_CONFIG.badgeUnlock;
  await playTone(config.frequency, config.duration, config.type);
}

/**
 * Play generic success sound
 */
export async function playSuccess(): Promise<void> {
  if (!soundsEnabled) return;

  haptics.success();
  const config = SOUND_CONFIG.success;
  await playTone(config.frequency, config.duration, config.type);
}

/**
 * Play error sound
 */
export async function playError(): Promise<void> {
  if (!soundsEnabled) return;

  haptics.error();
  const config = SOUND_CONFIG.error;
  await playTone(config.frequency, config.duration, config.type);
}

/**
 * Play light tap sound
 */
export async function playTap(): Promise<void> {
  if (!soundsEnabled) return;

  haptics.light();
  const config = SOUND_CONFIG.tap;
  await playTone(config.frequency, config.duration, config.type);
}

/**
 * Play swoosh sound (for swipe gestures)
 */
export async function playSwoosh(): Promise<void> {
  if (!soundsEnabled) return;

  haptics.selection();
  const config = SOUND_CONFIG.swoosh;
  await playTone(config.frequency, config.duration, config.type);
}

/**
 * Play celebration sound (for achievements, milestones)
 */
export async function playCelebration(): Promise<void> {
  if (!soundsEnabled) return;

  // Triple haptic burst
  haptics.success();
  setTimeout(() => haptics.medium(), 80);
  setTimeout(() => haptics.light(), 160);
  setTimeout(() => haptics.success(), 300);

  const config = SOUND_CONFIG.celebration;
  await playTone(config.frequency, config.duration, config.type);
}

/**
 * Cleanup sounds when app is closing
 */
export async function unloadSounds(): Promise<void> {
  for (const key of Object.keys(sounds)) {
    const sound = sounds[key];
    if (sound) {
      try {
        await sound.unloadAsync();
      } catch (e) {
        // Ignore cleanup errors
      }
      sounds[key] = null;
    }
  }
  soundsLoaded = false;
}

// Export all sound functions as a single object
export const soundEffects = {
  init: initSounds,
  unload: unloadSounds,
  setEnabled: setSoundsEnabled,
  isEnabled: areSoundsEnabled,
  voteSuccess: playVoteSuccess,
  voteOppose: playVoteOppose,
  badgeUnlock: playBadgeUnlock,
  success: playSuccess,
  error: playError,
  tap: playTap,
  swoosh: playSwoosh,
  celebration: playCelebration,
};

export default soundEffects;
