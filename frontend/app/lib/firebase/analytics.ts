"use client";

import type { Analytics } from "firebase/analytics";
import {
  getAnalytics,
  isSupported,
  logEvent as firebaseLogEvent,
  setAnalyticsCollectionEnabled as firebaseSetAnalyticsCollectionEnabled,
  setUserId as firebaseSetUserId,
  setUserProperties as firebaseSetUserProperties,
} from "firebase/analytics";

import app from "./config";

/**
 * Non-blocking analytics helper functions for Firebase/Google Analytics
 * All functions catch errors silently to prevent analytics from affecting app performance
 */

let analyticsInstance: Analytics | null = null;

/** Initialize analytics (call once on app load) */
export const initAnalytics = async (): Promise<Analytics | null> => {
  try {
    if (typeof window === "undefined") return null;
    const supported = await isSupported();
    if (supported) {
      analyticsInstance = getAnalytics(app);
      return analyticsInstance;
    }
  } catch {
    // Analytics not supported or blocked
  }
  return null;
};

/** Get analytics instance (may be null if not initialized or unsupported) */
export const getAnalyticsInstance = (): Analytics | null => analyticsInstance;

/** Log a custom event */
export const logEvent = (
  eventName: string,
  params?: Record<string, string | number | boolean>,
): void => {
  if (!analyticsInstance) return;
  try {
    firebaseLogEvent(analyticsInstance, eventName, params);
  } catch {
    // Silently fail
  }
};

/** Log page view */
export const logPageView = (
  pagePath: string,
  pageTitle?: string,
  pageLocation?: string,
): void => {
  if (!analyticsInstance) return;
  try {
    firebaseLogEvent(analyticsInstance, "page_view", {
      page_path: pagePath,
      page_title: pageTitle,
      page_location: pageLocation ?? window.location.href,
    });
  } catch {
    // Silently fail
  }
};

/** Set user ID for analytics */
export const setUserId = (userId: string | null): void => {
  if (!analyticsInstance) return;
  try {
    firebaseSetUserId(analyticsInstance, userId);
  } catch {
    // Silently fail
  }
};

/** Set user properties */
export const setUserProperties = (
  properties: Record<string, string | null>,
): void => {
  if (!analyticsInstance) return;
  try {
    firebaseSetUserProperties(analyticsInstance, properties);
  } catch {
    // Silently fail
  }
};

/** Log login event */
export const logLogin = (method: string): void => {
  if (!analyticsInstance) return;
  try {
    firebaseLogEvent(analyticsInstance, "login", { method });
  } catch {
    // Silently fail
  }
};

/** Log sign up event */
export const logSignUp = (method: string): void => {
  if (!analyticsInstance) return;
  try {
    firebaseLogEvent(analyticsInstance, "sign_up", { method });
  } catch {
    // Silently fail
  }
};

/** Log search event */
export const logSearch = (searchTerm: string): void => {
  if (!analyticsInstance) return;
  try {
    firebaseLogEvent(analyticsInstance, "search", { search_term: searchTerm });
  } catch {
    // Silently fail
  }
};

/** Log select content event */
export const logSelectContent = (contentType: string, itemId: string): void => {
  if (!analyticsInstance) return;
  try {
    firebaseLogEvent(analyticsInstance, "select_content", {
      content_type: contentType,
      item_id: itemId,
    });
  } catch {
    // Silently fail
  }
};

/** Log share event */
export const logShare = (
  contentType: string,
  itemId: string,
  method: string,
): void => {
  if (!analyticsInstance) return;
  try {
    firebaseLogEvent(analyticsInstance, "share", {
      content_type: contentType,
      item_id: itemId,
      method,
    });
  } catch {
    // Silently fail
  }
};

/** Enable/disable analytics collection */
export const setAnalyticsCollectionEnabled = (enabled: boolean): void => {
  if (!analyticsInstance) return;
  try {
    firebaseSetAnalyticsCollectionEnabled(analyticsInstance, enabled);
  } catch {
    // Silently fail
  }
};
