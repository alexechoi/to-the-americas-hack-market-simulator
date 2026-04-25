/**
 * Push Notification Service
 *
 * Handles FCM token management, permission requests, and notification listeners.
 * Uses Firebase Cloud Messaging for push notifications.
 */

import messaging from "@react-native-firebase/messaging";
import { Alert, Platform } from "react-native";

export interface NotificationData {
  messageId?: string;
  title?: string;
  body?: string;
  data?: Record<string, string>;
}

/**
 * Request permission to receive push notifications.
 * iOS requires explicit permission, Android 13+ requires runtime permission.
 *
 * @returns Authorization status
 */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (enabled) {
      console.log("Push notification permission granted");
    } else {
      console.log("Push notification permission denied");
    }

    return enabled;
  } catch (error) {
    console.error("Error requesting notification permission:", error);
    return false;
  }
}

/**
 * Check if notification permissions are already granted.
 *
 * @returns Whether notifications are enabled
 */
export async function checkNotificationPermission(): Promise<boolean> {
  try {
    const authStatus = await messaging().hasPermission();
    return (
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL
    );
  } catch (error) {
    console.error("Error checking notification permission:", error);
    return false;
  }
}

/**
 * Register the device for remote messages.
 * Required on iOS before getting the FCM token.
 * On Android, this is a no-op as registration is automatic.
 */
export async function registerForRemoteMessages(): Promise<boolean> {
  try {
    if (!messaging().isDeviceRegisteredForRemoteMessages) {
      await messaging().registerDeviceForRemoteMessages();
      console.log("Device registered for remote messages");
    }
    return true;
  } catch (error) {
    console.error("Error registering for remote messages:", error);
    return false;
  }
}

/**
 * Get the FCM device token.
 * This token is used to send notifications to this specific device.
 *
 * @returns FCM token or null if unavailable
 */
export async function getFCMToken(): Promise<string | null> {
  try {
    // Check if we have permission first
    const hasPermission = await checkNotificationPermission();
    if (!hasPermission) {
      console.log("No notification permission, cannot get FCM token");
      return null;
    }

    // iOS requires explicit registration for remote messages
    const registered = await registerForRemoteMessages();
    if (!registered) {
      console.log("Failed to register for remote messages");
      return null;
    }

    const token = await messaging().getToken();
    console.log("FCM Token obtained:", token.substring(0, 20) + "...");
    return token;
  } catch (error) {
    console.error("Error getting FCM token:", error);
    return null;
  }
}

/**
 * Delete the FCM token.
 * Call this on logout to stop receiving notifications on this device.
 */
export async function deleteFCMToken(): Promise<void> {
  try {
    await messaging().deleteToken();
    console.log("FCM token deleted");
  } catch (error) {
    console.error("Error deleting FCM token:", error);
  }
}

/**
 * Subscribe to FCM token refresh events.
 * Tokens can refresh when the app is reinstalled or data is cleared.
 *
 * @param callback Function to call when token refreshes
 * @returns Unsubscribe function
 */
export function onTokenRefresh(callback: (token: string) => void): () => void {
  return messaging().onTokenRefresh(callback);
}

/**
 * Subscribe to foreground notification messages.
 * These are notifications received while the app is in the foreground.
 *
 * @param callback Function to call when message is received
 * @returns Unsubscribe function
 */
export function onForegroundMessage(
  callback: (notification: NotificationData) => void,
): () => void {
  return messaging().onMessage((remoteMessage) => {
    const notification: NotificationData = {
      messageId: remoteMessage.messageId,
      title: remoteMessage.notification?.title,
      body: remoteMessage.notification?.body,
      data: remoteMessage.data as Record<string, string> | undefined,
    };
    callback(notification);
  });
}

/**
 * Subscribe to notifications that were tapped when app was in background.
 *
 * @param callback Function to call when notification is opened
 * @returns Unsubscribe function
 */
export function onNotificationOpenedApp(
  callback: (notification: NotificationData) => void,
): () => void {
  return messaging().onNotificationOpenedApp((remoteMessage) => {
    const notification: NotificationData = {
      messageId: remoteMessage.messageId,
      title: remoteMessage.notification?.title,
      body: remoteMessage.notification?.body,
      data: remoteMessage.data as Record<string, string> | undefined,
    };
    callback(notification);
  });
}

/**
 * Check if app was opened from a notification when it was killed.
 *
 * @returns The notification that opened the app, or null
 */
export async function getInitialNotification(): Promise<NotificationData | null> {
  try {
    const remoteMessage = await messaging().getInitialNotification();
    if (!remoteMessage) {
      return null;
    }

    return {
      messageId: remoteMessage.messageId,
      title: remoteMessage.notification?.title,
      body: remoteMessage.notification?.body,
      data: remoteMessage.data as Record<string, string> | undefined,
    };
  } catch (error) {
    console.error("Error getting initial notification:", error);
    return null;
  }
}

/**
 * Display a local alert for a foreground notification.
 *
 * @param notification The notification to display
 */
export function showNotificationAlert(notification: NotificationData): void {
  const title = notification.title || "New Notification";
  const body = notification.body || "";

  Alert.alert(title, body, [{ text: "OK", style: "default" }]);
}

/**
 * Register background message handler.
 * This must be called at the app entry point (index.js or app/_layout.tsx).
 *
 * @param handler Function to handle background messages
 */
export function setBackgroundMessageHandler(
  handler: (notification: NotificationData) => Promise<void>,
): void {
  messaging().setBackgroundMessageHandler(async (remoteMessage) => {
    const notification: NotificationData = {
      messageId: remoteMessage.messageId,
      title: remoteMessage.notification?.title,
      body: remoteMessage.notification?.body,
      data: remoteMessage.data as Record<string, string> | undefined,
    };
    await handler(notification);
  });
}

/**
 * Check if the device supports push notifications.
 * iOS simulators do not support push notifications.
 */
export function isPushNotificationSupported(): boolean {
  // iOS simulators don't support push notifications
  if (Platform.OS === "ios" && __DEV__) {
    // In dev mode on iOS, we can't easily detect simulator vs device
    // FCM will fail gracefully if on simulator
    return true;
  }
  return true;
}
