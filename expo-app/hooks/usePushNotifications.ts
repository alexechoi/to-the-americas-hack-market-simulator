/**
 * Push Notifications Hook
 *
 * Manages push notification lifecycle including:
 * - Permission requests
 * - Token registration on login
 * - Token cleanup on logout
 * - Notification handling in all app states
 */

import { useCallback, useEffect, useRef } from "react";

import { useAuth } from "@/components/AuthProvider";
import {
  registerDeviceToken,
  unregisterDeviceToken,
} from "@/lib/firebase/notifications";
import {
  deleteFCMToken,
  getFCMToken,
  getInitialNotification,
  type NotificationData,
  onForegroundMessage,
  onNotificationOpenedApp,
  onTokenRefresh,
  requestNotificationPermission,
  setBackgroundMessageHandler,
  showNotificationAlert,
} from "@/lib/services/pushNotificationService";

interface UsePushNotificationsOptions {
  /**
   * Called when a notification is received in the foreground
   */
  onNotificationReceived?: (notification: NotificationData) => void;

  /**
   * Called when a notification is tapped (from background or killed state)
   */
  onNotificationPressed?: (notification: NotificationData) => void;

  /**
   * Whether to show an alert for foreground notifications
   * @default true
   */
  showForegroundAlert?: boolean;
}

/**
 * Hook to manage push notifications.
 * Automatically registers/unregisters tokens based on auth state.
 */
export function usePushNotifications(
  options: UsePushNotificationsOptions = {},
): void {
  const { user } = useAuth();
  const {
    onNotificationReceived,
    onNotificationPressed,
    showForegroundAlert = true,
  } = options;

  // Track the current token to clean up on logout
  const currentTokenRef = useRef<string | null>(null);
  const previousUserRef = useRef<string | null>(null);

  // Handle token registration when user logs in
  const registerToken = useCallback(async (uid: string) => {
    try {
      // Request permission if not already granted
      const hasPermission = await requestNotificationPermission();
      if (!hasPermission) {
        console.log("Push notification permission not granted");
        return;
      }

      // Get FCM token
      const token = await getFCMToken();
      if (!token) {
        console.log("Could not get FCM token");
        return;
      }

      // Store token reference for cleanup
      currentTokenRef.current = token;

      // Register token with Firestore
      await registerDeviceToken(uid, token);
      console.log("Push notifications initialized for user");
    } catch (error) {
      console.error("Error initializing push notifications:", error);
    }
  }, []);

  // Handle token cleanup when user logs out
  const unregisterToken = useCallback(async (uid: string) => {
    try {
      const token = currentTokenRef.current;
      if (token) {
        // Remove token from Firestore
        await unregisterDeviceToken(uid, token);
        currentTokenRef.current = null;
      }

      // Delete the FCM token
      await deleteFCMToken();
      console.log("Push notifications cleaned up");
    } catch (error) {
      console.error("Error cleaning up push notifications:", error);
    }
  }, []);

  // Handle auth state changes
  useEffect(() => {
    const currentUid = user?.uid ?? null;
    const previousUid = previousUserRef.current;

    // User logged in
    if (currentUid && !previousUid) {
      registerToken(currentUid);
    }

    // User logged out
    if (!currentUid && previousUid) {
      unregisterToken(previousUid);
    }

    // Update previous user reference
    previousUserRef.current = currentUid;
  }, [user?.uid, registerToken, unregisterToken]);

  // Handle token refresh
  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribe = onTokenRefresh(async (newToken) => {
      console.log("FCM token refreshed");

      // Remove old token if exists
      const oldToken = currentTokenRef.current;
      if (oldToken && user.uid) {
        try {
          await unregisterDeviceToken(user.uid, oldToken);
        } catch {
          // Ignore errors removing old token
        }
      }

      // Register new token
      currentTokenRef.current = newToken;
      await registerDeviceToken(user.uid, newToken);
    });

    return unsubscribe;
  }, [user?.uid]);

  // Handle foreground notifications
  useEffect(() => {
    const unsubscribe = onForegroundMessage((notification) => {
      console.log("Foreground notification received:", notification.title);

      // Show alert if enabled
      if (showForegroundAlert) {
        showNotificationAlert(notification);
      }

      // Call custom handler
      onNotificationReceived?.(notification);
    });

    return unsubscribe;
  }, [onNotificationReceived, showForegroundAlert]);

  // Handle notification opened from background
  useEffect(() => {
    const unsubscribe = onNotificationOpenedApp((notification) => {
      console.log("Notification opened from background:", notification.title);
      onNotificationPressed?.(notification);
    });

    return unsubscribe;
  }, [onNotificationPressed]);

  // Check for initial notification (app opened from killed state)
  useEffect(() => {
    async function checkInitialNotification() {
      const notification = await getInitialNotification();
      if (notification) {
        console.log(
          "App opened from notification (killed state):",
          notification.title,
        );
        onNotificationPressed?.(notification);
      }
    }

    checkInitialNotification();
  }, [onNotificationPressed]);
}

/**
 * Register the background message handler.
 * Call this at the app entry point (before any React rendering).
 */
export function registerBackgroundHandler(): void {
  setBackgroundMessageHandler(async (notification) => {
    console.log("Background notification received:", notification.title);
    // Background notifications are typically handled by the system
    // Custom logic can be added here if needed
  });
}
