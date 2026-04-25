/**
 * Notification Token Management for Web
 *
 * Functions to register and unregister FCM device tokens in Firestore.
 * Uses the same storage format as the mobile app for backend compatibility.
 */

import { arrayRemove, arrayUnion, doc, updateDoc } from "firebase/firestore";

import { db } from "./config";

/**
 * Register a device token for push notifications.
 * Adds the token to the user's deviceTokens array in Firestore.
 *
 * @param uid User's Firebase UID
 * @param token FCM device token
 */
export async function registerDeviceToken(
  uid: string,
  token: string,
): Promise<void> {
  try {
    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, {
      deviceTokens: arrayUnion(token),
    });
    console.log("Device token registered successfully");
  } catch (error) {
    console.error("Error registering device token:", error);
    throw error;
  }
}

/**
 * Unregister a device token.
 * Removes the token from the user's deviceTokens array in Firestore.
 * Call this when the user logs out.
 *
 * @param uid User's Firebase UID
 * @param token FCM device token to remove
 */
export async function unregisterDeviceToken(
  uid: string,
  token: string,
): Promise<void> {
  try {
    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, {
      deviceTokens: arrayRemove(token),
    });
    console.log("Device token unregistered successfully");
  } catch (error) {
    console.error("Error unregistering device token:", error);
    // Don't throw - this is a cleanup operation that shouldn't block logout
  }
}
