"use client";

/**
 * Push Notification Provider
 *
 * Initializes web push notifications and provides context for notification state.
 * Wrap your app with this component after AuthProvider.
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";

import {
  deleteFCMToken,
  getFCMToken,
  getNotificationPermission,
  isPushNotificationSupported,
  type NotificationData,
  onForegroundMessage,
  requestNotificationPermission,
  showNotification,
} from "@/app/lib/firebase/messaging";
import {
  registerDeviceToken,
  unregisterDeviceToken,
} from "@/app/lib/firebase/notifications";

import { useAuth } from "./AuthProvider";

interface PushNotificationContextType {
  isSupported: boolean;
  permission: NotificationPermission | null;
  isEnabled: boolean;
  enableNotifications: () => Promise<boolean>;
  disableNotifications: () => Promise<void>;
}

const PushNotificationContext = createContext<PushNotificationContextType>({
  isSupported: false,
  permission: null,
  isEnabled: false,
  enableNotifications: async () => false,
  disableNotifications: async () => {},
});

export function usePushNotifications() {
  return useContext(PushNotificationContext);
}

// Simple external store for token state to avoid effect setState issues
function createTokenStore() {
  let token: string | null = null;
  const listeners = new Set<() => void>();

  return {
    getToken: () => token,
    setToken: (newToken: string | null) => {
      token = newToken;
      listeners.forEach((l) => l());
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

interface PushNotificationProviderProps {
  children: React.ReactNode;
  vapidKey?: string;
  onNotificationReceived?: (notification: NotificationData) => void;
}

export function PushNotificationProvider({
  children,
  vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || "",
  onNotificationReceived,
}: PushNotificationProviderProps) {
  const { user } = useAuth();
  const previousUserIdRef = useRef<string | null>(null);

  // Use a stable token store
  const tokenStore = useMemo(() => createTokenStore(), []);
  const token = useSyncExternalStore(
    tokenStore.subscribe,
    tokenStore.getToken,
    () => null,
  );

  // Compute these synchronously
  const isSupported =
    typeof window !== "undefined" ? isPushNotificationSupported() : false;
  const permission =
    typeof window !== "undefined" ? getNotificationPermission() : null;

  // Enable notifications
  async function enableNotifications(): Promise<boolean> {
    const userId = user?.uid;
    if (!isSupported || !vapidKey || !userId) {
      console.warn("Cannot enable notifications:", {
        isSupported,
        hasVapidKey: !!vapidKey,
        hasUser: !!userId,
      });
      return false;
    }

    try {
      const granted = await requestNotificationPermission();
      if (!granted) return false;

      const fcmToken = await getFCMToken(vapidKey);
      if (!fcmToken) {
        console.error("Failed to get FCM token");
        return false;
      }

      await registerDeviceToken(userId, fcmToken);
      tokenStore.setToken(fcmToken);
      console.log("Push notifications enabled");
      return true;
    } catch (error) {
      console.error("Error enabling notifications:", error);
      return false;
    }
  }

  // Disable notifications
  async function disableNotifications(): Promise<void> {
    const userId = user?.uid;
    const currentToken = tokenStore.getToken();
    if (!userId || !currentToken) return;

    try {
      await unregisterDeviceToken(userId, currentToken);
      await deleteFCMToken();
      tokenStore.setToken(null);
      console.log("Push notifications disabled");
    } catch (error) {
      console.error("Error disabling notifications:", error);
    }
  }

  // Handle user logout - cleanup tokens
  useEffect(() => {
    const currentUserId = user?.uid ?? null;
    const previousUserId = previousUserIdRef.current;
    const currentToken = tokenStore.getToken();

    if (!currentUserId && previousUserId && currentToken) {
      Promise.all([
        unregisterDeviceToken(previousUserId, currentToken),
        deleteFCMToken(),
      ])
        .then(() => tokenStore.setToken(null))
        .catch(console.error);
    }

    previousUserIdRef.current = currentUserId;
  }, [user?.uid, tokenStore]);

  // Auto-register on login if permission already granted
  useEffect(() => {
    const currentUserId = user?.uid;
    const currentToken = tokenStore.getToken();

    if (
      currentUserId &&
      permission === "granted" &&
      vapidKey &&
      !currentToken &&
      isSupported
    ) {
      // Call enable asynchronously
      (async () => {
        try {
          const granted = await requestNotificationPermission();
          if (!granted) return;

          const fcmToken = await getFCMToken(vapidKey);
          if (!fcmToken) return;

          await registerDeviceToken(currentUserId, fcmToken);
          tokenStore.setToken(fcmToken);
          console.log("Push notifications auto-enabled");
        } catch (error) {
          console.error("Error auto-enabling notifications:", error);
        }
      })();
    }
  }, [user?.uid, permission, vapidKey, isSupported, tokenStore]);

  // Handle foreground messages
  useEffect(() => {
    if (!isSupported) return;

    const unsubscribe = onForegroundMessage((notification) => {
      console.log("Foreground notification:", notification);

      if (notification.title) {
        showNotification(notification.title, {
          body: notification.body,
        });
      }

      onNotificationReceived?.(notification);
    });

    return () => {
      unsubscribe?.();
    };
  }, [isSupported, onNotificationReceived]);

  const value: PushNotificationContextType = {
    isSupported,
    permission,
    isEnabled: !!token,
    enableNotifications,
    disableNotifications,
  };

  return (
    <PushNotificationContext.Provider value={value}>
      {children}
    </PushNotificationContext.Provider>
  );
}
