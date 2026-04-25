/**
 * Firebase Admin SDK initialization for server-side operations.
 *
 * This module initializes Firebase Admin for use in Next.js API routes
 * and Server Components. It supports the same credential options as the
 * Python backend for consistency.
 *
 * Environment Variables:
 * - GOOGLE_APPLICATION_CREDENTIALS: Path to service account JSON file
 * - FIREBASE_SERVICE_ACCOUNT_JSON: Service account JSON as a string
 * - FIREBASE_PROJECT_ID: Project ID (for application default credentials)
 */

import {
  type App,
  cert,
  getApp,
  getApps,
  initializeApp,
  type ServiceAccount,
} from "firebase-admin/app";
import { type DecodedIdToken, getAuth } from "firebase-admin/auth";

let adminApp: App | null = null;

/**
 * Initialize Firebase Admin SDK.
 *
 * Tries to initialize in the following order:
 * 1. FIREBASE_SERVICE_ACCOUNT_JSON environment variable (JSON string)
 * 2. GOOGLE_APPLICATION_CREDENTIALS environment variable (file path - handled by SDK)
 * 3. Application default credentials (for GCP environments)
 */
function initializeFirebaseAdmin(): App {
  // Return existing app if already initialized
  if (getApps().length > 0) {
    return getApp();
  }

  // Option 1: Service account JSON string (for containerized deployments)
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (serviceAccountJson) {
    try {
      const serviceAccount = JSON.parse(serviceAccountJson) as ServiceAccount;
      adminApp = initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.projectId,
      });
      console.log(
        "[Firebase Admin] Initialized with service account JSON string",
      );
      return adminApp;
    } catch (error) {
      console.error(
        "[Firebase Admin] Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:",
        error,
      );
      throw new Error("Invalid FIREBASE_SERVICE_ACCOUNT_JSON");
    }
  }

  // Option 2 & 3: GOOGLE_APPLICATION_CREDENTIALS file path or default credentials
  // The SDK automatically handles GOOGLE_APPLICATION_CREDENTIALS
  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  adminApp = initializeApp({
    projectId,
  });
  console.log(
    "[Firebase Admin] Initialized with application default credentials",
  );
  return adminApp;
}

/**
 * Get the Firebase Admin app instance.
 */
export function getAdminApp(): App {
  if (!adminApp && getApps().length === 0) {
    return initializeFirebaseAdmin();
  }
  return adminApp || getApp();
}

/**
 * Verify a Firebase ID token.
 *
 * @param idToken - The Firebase ID token from the client
 * @returns Decoded token containing user info (uid, email, etc.)
 * @throws Error if token is invalid or expired
 */
export async function verifyIdToken(idToken: string): Promise<DecodedIdToken> {
  const app = getAdminApp();
  const auth = getAuth(app);

  try {
    const decodedToken = await auth.verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    const firebaseError = error as { code?: string; message?: string };

    if (firebaseError.code === "auth/id-token-expired") {
      throw new Error("Authentication token has expired");
    }

    if (firebaseError.code === "auth/id-token-revoked") {
      throw new Error("Authentication token has been revoked");
    }

    if (firebaseError.code === "auth/argument-error") {
      throw new Error("Invalid authentication token");
    }

    console.error("[Firebase Admin] Token verification failed:", error);
    throw new Error("Token verification failed");
  }
}

/**
 * Extract and verify the Bearer token from an Authorization header.
 *
 * @param authHeader - The Authorization header value (e.g., "Bearer <token>")
 * @returns Decoded token if valid
 * @throws Error if token is missing, malformed, or invalid
 */
export async function verifyAuthHeader(
  authHeader: string | null,
): Promise<DecodedIdToken> {
  if (!authHeader) {
    throw new Error("Missing authentication token");
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
    throw new Error("Invalid authentication token format");
  }

  const token = parts[1];
  return verifyIdToken(token);
}
