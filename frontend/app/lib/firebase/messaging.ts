/**
 * Firebase Cloud Messaging for Web
 *
 * Handles web push notifications including permission requests,
 * token management, and foreground message handling.
 */

import type { MessagePayload, Messaging } from "firebase/messaging";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

import app from "./config";

// Messaging instance - only available in browser
let messaging: Messaging | null = null;

/**
 * Get the Firebase Messaging instance.
 * Only available in browser environment.
 */
function getMessagingInstance(): Messaging | null {
  if (typeof window === "undefined") {
    return null;
  }

  if (!messaging) {
    try {
      messaging = getMessaging(app);
    } catch (error) {
      console.error("Error initializing Firebase Messaging:", error);
      return null;
    }
  }

  return messaging;
}

/**
 * Check if the browser supports push notifications.
 */
export function isPushNotificationSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

/**
 * Get the current notification permission status.
 */
export function getNotificationPermission(): NotificationPermission | null {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return null;
  }
  return Notification.permission;
}

/**
 * Request permission to show notifications.
 *
 * @returns Whether permission was granted
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!isPushNotificationSupported()) {
    console.warn("Push notifications are not supported in this browser");
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    const granted = permission === "granted";

    if (granted) {
      console.log("Notification permission granted");
    } else {
      console.log("Notification permission denied");
    }

    return granted;
  } catch (error) {
    console.error("Error requesting notification permission:", error);
    return false;
  }
}

/**
 * Get Firebase config from environment variables.
 */
function getFirebaseConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
}

/**
 * Send Firebase config to the service worker and cache it.
 */
async function sendConfigToServiceWorker(
  registration: ServiceWorkerRegistration,
): Promise<void> {
  const config = getFirebaseConfig();

  // Cache the config for when service worker starts independently
  try {
    const cache = await caches.open("firebase-config");
    await cache.put(
      "config",
      new Response(JSON.stringify(config), {
        headers: { "Content-Type": "application/json" },
      }),
    );
  } catch (e) {
    console.warn("Could not cache Firebase config:", e);
  }

  // Send config to active service worker
  const sw =
    registration.active || registration.waiting || registration.installing;
  if (sw) {
    sw.postMessage({ type: "FIREBASE_CONFIG", config });
  }
}

/**
 * Register the service worker for FCM.
 * Must be called before getting the FCM token.
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js",
      { scope: "/" },
    );
    console.log("Service worker registered:", registration.scope);

    // Wait for service worker to be ready
    await navigator.serviceWorker.ready;

    // Send Firebase config to service worker
    await sendConfigToServiceWorker(registration);

    return registration;
  } catch (error) {
    console.error("Service worker registration failed:", error);
    return null;
  }
}

/**
 * Get the FCM token for this browser.
 *
 * @param vapidKey - The VAPID key from Firebase Console
 * @returns FCM token or null if unavailable
 */
export async function getFCMToken(vapidKey: string): Promise<string | null> {
  const messagingInstance = getMessagingInstance();
  if (!messagingInstance) {
    console.warn("Firebase Messaging not available");
    return null;
  }

  // Check permission
  if (Notification.permission !== "granted") {
    console.warn("Notification permission not granted");
    return null;
  }

  try {
    // Ensure service worker is registered
    const registration = await registerServiceWorker();
    if (!registration) {
      console.error("Service worker not registered");
      return null;
    }

    const token = await getToken(messagingInstance, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });

    if (token) {
      console.log("FCM Token obtained:", token.substring(0, 20) + "...");
      return token;
    } else {
      console.warn("No FCM token available");
      return null;
    }
  } catch (error) {
    console.error("Error getting FCM token:", error);
    return null;
  }
}

/**
 * Delete the current FCM token.
 * Call this on logout.
 */
export async function deleteFCMToken(): Promise<void> {
  // For web, we just need to unregister the service worker
  // The token will be invalidated when a new one is requested
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations) {
      if (registration.active?.scriptURL.includes("firebase-messaging-sw.js")) {
        await registration.unregister();
        console.log("FCM service worker unregistered");
      }
    }
  } catch (error) {
    console.error("Error deleting FCM token:", error);
  }
}

export interface NotificationData {
  messageId?: string;
  title?: string;
  body?: string;
  data?: Record<string, string>;
}

/**
 * Subscribe to foreground messages.
 * These are messages received while the app is in the foreground.
 *
 * @param callback Function to call when a message is received
 * @returns Unsubscribe function
 */
export function onForegroundMessage(
  callback: (notification: NotificationData) => void,
): (() => void) | null {
  const messagingInstance = getMessagingInstance();
  if (!messagingInstance) {
    return null;
  }

  return onMessage(messagingInstance, (payload: MessagePayload) => {
    const notification: NotificationData = {
      messageId: payload.messageId,
      title: payload.notification?.title,
      body: payload.notification?.body,
      data: payload.data,
    };
    callback(notification);
  });
}

/**
 * Show a browser notification.
 * Used for foreground notifications since FCM doesn't auto-show them.
 */
export function showNotification(
  title: string,
  options?: NotificationOptions,
): void {
  if (Notification.permission !== "granted") {
    return;
  }

  new Notification(title, {
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    ...options,
  });
}
