import { Platform, Alert } from 'react-native';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

const PUSH_TOKEN_KEY = 'represent_push_token';
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://representportal.com';

let Notifications: any = null;
let Device: any = null;
let isModulesLoaded = false;

function loadModules(): boolean {
  if (isModulesLoaded) return Notifications !== null;
  isModulesLoaded = true;
  try {
    Notifications = require('expo-notifications');
    Device = require('expo-device');
    if (Notifications) {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });
    }
    return true;
  } catch (e) {
    console.log('Push notifications not available (Expo Go)');
    return false;
  }
}

export async function registerForPushNotifications(): Promise<string | null> {
  if (!loadModules()) { console.log('Push notifications require a development build'); return null; }
  if (!Device.isDevice) { console.log('Push notifications require a physical device'); return null; }
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') { console.log('Push notification permission not granted'); return null; }
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data;
    await SecureStore.setItemAsync(PUSH_TOKEN_KEY, token);
    console.log('Push token registered:', token);
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#EABA58',
      });
    }
    return token;
  } catch (error) { console.error('Error getting push token:', error); return null; }
}

export async function savePushTokenToServer(userId: string, authToken: string): Promise<boolean> {
  try {
    const pushToken = await SecureStore.getItemAsync(PUSH_TOKEN_KEY);
    if (!pushToken) return false;
    const response = await fetch(`${API_BASE_URL}/api/push-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
      body: JSON.stringify({ token: pushToken, platform: Platform.OS }),
    });
    if (response.ok) console.log('Push token saved to server');
    return response.ok;
  } catch (error) { console.error('Error saving push token:', error); return false; }
}

export function addNotificationReceivedListener(callback: (notification: any) => void) {
  if (!loadModules()) return { remove: () => {} };
  return Notifications.addNotificationReceivedListener(callback);
}

export function addNotificationResponseListener(callback: (response: any) => void) {
  if (!loadModules()) return { remove: () => {} };
  return Notifications.addNotificationResponseReceivedListener(callback);
}

export async function scheduleLocalNotification(title: string, body: string, data?: Record<string, unknown>, triggerSeconds?: number) {
  if (!loadModules()) { Alert.alert('Push Notifications', 'Push notifications require a development build.'); return; }
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data, sound: true },
    trigger: triggerSeconds ? { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: triggerSeconds } : null,
  });
}

export async function cancelAllNotifications() { if (!loadModules()) return; await Notifications.cancelAllScheduledNotificationsAsync(); }
export async function getBadgeCount(): Promise<number> { if (!loadModules()) return 0; return await Notifications.getBadgeCountAsync(); }
export async function setBadgeCount(count: number) { if (!loadModules()) return; await Notifications.setBadgeCountAsync(count); }
export async function clearAllNotifications() { if (!loadModules()) return; await Notifications.dismissAllNotificationsAsync(); }
export function isPushNotificationsAvailable(): boolean { return loadModules(); }
