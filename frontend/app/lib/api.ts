/**
 * API client for making authenticated requests to the backend.
 *
 * This module provides a simple way to make API requests with Firebase
 * authentication tokens automatically attached.
 */

import { auth } from "./firebase/config";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * Get the current user's Firebase ID token.
 *
 * @param forceRefresh - Force refresh the token even if not expired
 * @returns The ID token or null if not authenticated
 */
export async function getAuthToken(
  forceRefresh = false,
): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) {
    return null;
  }

  try {
    return await user.getIdToken(forceRefresh);
  } catch (error) {
    console.error("Failed to get auth token:", error);
    return null;
  }
}

/**
 * Make an authenticated API request.
 *
 * Automatically attaches the Firebase ID token to the Authorization header.
 *
 * @param endpoint - API endpoint (e.g., "/me", "/protected")
 * @param options - Fetch options (method, body, etc.)
 * @returns The fetch Response
 */
export async function apiRequest(
  endpoint: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = await getAuthToken();

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  const url = endpoint.startsWith("http")
    ? endpoint
    : `${API_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  return fetch(url, {
    ...options,
    headers,
  });
}

/**
 * Make an authenticated GET request.
 *
 * @param endpoint - API endpoint
 * @returns Parsed JSON response
 */
export async function apiGet<T = unknown>(endpoint: string): Promise<T> {
  const response = await apiRequest(endpoint, { method: "GET" });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: "Request failed" }));
    throw new Error(
      error.detail || `Request failed with status ${response.status}`,
    );
  }

  return response.json();
}

/**
 * Make an authenticated POST request.
 *
 * @param endpoint - API endpoint
 * @param data - Request body data
 * @returns Parsed JSON response
 */
export async function apiPost<T = unknown>(
  endpoint: string,
  data?: unknown,
): Promise<T> {
  const response = await apiRequest(endpoint, {
    method: "POST",
    body: data ? JSON.stringify(data) : undefined,
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: "Request failed" }));
    throw new Error(
      error.detail || `Request failed with status ${response.status}`,
    );
  }

  return response.json();
}

/**
 * Make an authenticated PUT request.
 *
 * @param endpoint - API endpoint
 * @param data - Request body data
 * @returns Parsed JSON response
 */
export async function apiPut<T = unknown>(
  endpoint: string,
  data?: unknown,
): Promise<T> {
  const response = await apiRequest(endpoint, {
    method: "PUT",
    body: data ? JSON.stringify(data) : undefined,
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: "Request failed" }));
    throw new Error(
      error.detail || `Request failed with status ${response.status}`,
    );
  }

  return response.json();
}

/**
 * Make an authenticated DELETE request.
 *
 * @param endpoint - API endpoint
 * @returns Parsed JSON response
 */
export async function apiDelete<T = unknown>(endpoint: string): Promise<T> {
  const response = await apiRequest(endpoint, { method: "DELETE" });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: "Request failed" }));
    throw new Error(
      error.detail || `Request failed with status ${response.status}`,
    );
  }

  return response.json();
}
