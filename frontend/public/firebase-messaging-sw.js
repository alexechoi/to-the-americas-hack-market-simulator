/**
 * Firebase Messaging Service Worker
 *
 * Handles background push notifications for the web app.
 * The Firebase config is passed from the main app during service worker registration.
 */

// Import Firebase scripts for service worker
importScripts(
  "https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js",
);
importScripts(
  "https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js",
);

// Firebase messaging instance - will be initialized when config is received
let messaging = null;

// Initialize Firebase and set up messaging
function initializeFirebase(config) {
  if (firebase.apps.length) {
    return; // Already initialized
  }

  try {
    firebase.initializeApp(config);
    messaging = firebase.messaging();

    // Set up background message handler
    messaging.onBackgroundMessage((payload) => {
      console.log(
        "[firebase-messaging-sw.js] Background message received:",
        payload,
      );

      const notificationTitle =
        payload.notification?.title || "New Notification";
      const notificationOptions = {
        body: payload.notification?.body || "",
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        data: payload.data,
      };

      self.registration.showNotification(
        notificationTitle,
        notificationOptions,
      );
    });

    console.log("[firebase-messaging-sw.js] Firebase initialized successfully");
  } catch (error) {
    console.error("[firebase-messaging-sw.js] Firebase init error:", error);
  }
}

// Listen for config from the main app
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "FIREBASE_CONFIG") {
    console.log("[firebase-messaging-sw.js] Received config from app");
    initializeFirebase(event.data.config);
  }
});

// Try to initialize from cache (for when SW starts independently)
async function initFromCache() {
  try {
    const cache = await caches.open("firebase-config");
    const response = await cache.match("config");
    if (response) {
      const config = await response.json();
      console.log("[firebase-messaging-sw.js] Found cached config");
      initializeFirebase(config);
    }
  } catch (e) {
    console.log("[firebase-messaging-sw.js] No cached config found");
  }
}

// Initialize from cache on service worker start
initFromCache();

// Handle notification click
self.addEventListener("notificationclick", (event) => {
  console.log("[firebase-messaging-sw.js] Notification clicked:", event);

  event.notification.close();

  // Open the app or focus if already open
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // If a window is already open, focus it
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            return client.focus();
          }
        }
        // Otherwise, open a new window
        if (clients.openWindow) {
          return clients.openWindow("/");
        }
      }),
  );
});
