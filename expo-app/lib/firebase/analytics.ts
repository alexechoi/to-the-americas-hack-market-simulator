import analytics from "@react-native-firebase/analytics";

/**
 * Non-blocking analytics helper functions
 * All functions catch errors silently to prevent analytics from affecting app performance
 */

/** Log a custom event */
export const logEvent = (
  eventName: string,
  params?: Record<string, string | number | boolean>,
): void => {
  analytics()
    .logEvent(eventName, params)
    .catch(() => {});
};

/** Log screen view */
export const logScreenView = (
  screenName: string,
  screenClass?: string,
): void => {
  analytics()
    .logScreenView({ screen_name: screenName, screen_class: screenClass })
    .catch(() => {});
};

/** Set user ID for analytics */
export const setUserId = (userId: string | null): void => {
  analytics()
    .setUserId(userId)
    .catch(() => {});
};

/** Set user property */
export const setUserProperty = (name: string, value: string | null): void => {
  analytics()
    .setUserProperty(name, value)
    .catch(() => {});
};

/** Log login event */
export const logLogin = (method: string): void => {
  analytics()
    .logLogin({ method })
    .catch(() => {});
};

/** Log sign up event */
export const logSignUp = (method: string): void => {
  analytics()
    .logSignUp({ method })
    .catch(() => {});
};

/** Log select content event */
export const logSelectContent = (contentType: string, itemId: string): void => {
  analytics()
    .logSelectContent({ content_type: contentType, item_id: itemId })
    .catch(() => {});
};

/** Log share event */
export const logShare = (
  contentType: string,
  itemId: string,
  method: string,
): void => {
  analytics()
    .logShare({ content_type: contentType, item_id: itemId, method })
    .catch(() => {});
};

/** Log search event */
export const logSearch = (searchTerm: string): void => {
  analytics()
    .logSearch({ search_term: searchTerm })
    .catch(() => {});
};

/** Enable/disable analytics collection */
export const setAnalyticsCollectionEnabled = (enabled: boolean): void => {
  analytics()
    .setAnalyticsCollectionEnabled(enabled)
    .catch(() => {});
};
