/**
 * Authentication utilities for Next.js API routes.
 *
 * Provides helper functions to verify Firebase tokens in API route handlers.
 *
 * Usage:
 *   import { withAuth, getAuthUser } from "@/app/lib/auth";
 *
 *   // Option 1: Wrapper function (recommended)
 *   export const GET = withAuth(async (request, user) => {
 *     return Response.json({ uid: user.uid });
 *   });
 *
 *   // Option 2: Manual verification
 *   export async function GET(request: Request) {
 *     const user = await getAuthUser(request);
 *     if (!user) {
 *       return Response.json({ error: "Unauthorized" }, { status: 401 });
 *     }
 *     return Response.json({ uid: user.uid });
 *   }
 */

import type { DecodedIdToken } from "firebase-admin/auth";
import { type NextRequest, NextResponse } from "next/server";

import { verifyAuthHeader } from "./firebase/admin";

/**
 * User info extracted from a verified Firebase token.
 */
export interface AuthUser {
  uid: string;
  email?: string;
  emailVerified?: boolean;
  name?: string;
  picture?: string;
  /** The full decoded token for advanced use cases */
  token: DecodedIdToken;
}

/**
 * Get the authenticated user from a request.
 *
 * @param request - The incoming request
 * @returns AuthUser if authenticated, null otherwise
 */
export async function getAuthUser(
  request: Request | NextRequest,
): Promise<AuthUser | null> {
  const authHeader = request.headers.get("authorization");

  if (!authHeader) {
    return null;
  }

  try {
    const decodedToken = await verifyAuthHeader(authHeader);
    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
      emailVerified: decodedToken.email_verified,
      name: decodedToken.name,
      picture: decodedToken.picture,
      token: decodedToken,
    };
  } catch {
    return null;
  }
}

/**
 * Require authentication and get the user, or throw an error response.
 *
 * @param request - The incoming request
 * @returns AuthUser if authenticated
 * @throws Response with 401 status if not authenticated
 */
export async function requireAuth(
  request: Request | NextRequest,
): Promise<AuthUser> {
  const authHeader = request.headers.get("authorization");

  if (!authHeader) {
    throw NextResponse.json(
      { error: "Missing authentication token" },
      {
        status: 401,
        headers: { "WWW-Authenticate": "Bearer" },
      },
    );
  }

  try {
    const decodedToken = await verifyAuthHeader(authHeader);
    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
      emailVerified: decodedToken.email_verified,
      name: decodedToken.name,
      picture: decodedToken.picture,
      token: decodedToken,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Authentication failed";
    throw NextResponse.json(
      { error: message },
      {
        status: 401,
        headers: { "WWW-Authenticate": "Bearer" },
      },
    );
  }
}

/**
 * Handler type for authenticated API routes.
 */
type AuthenticatedHandler = (
  request: NextRequest,
  user: AuthUser,
) => Promise<Response> | Response;

/**
 * Wrap an API route handler to require authentication.
 *
 * @param handler - The route handler that receives the authenticated user
 * @returns A wrapped handler that verifies authentication first
 *
 * @example
 * export const GET = withAuth(async (request, user) => {
 *   return Response.json({ message: `Hello ${user.email}` });
 * });
 */
export function withAuth(
  handler: AuthenticatedHandler,
): (request: NextRequest) => Promise<Response> {
  return async (request: NextRequest) => {
    try {
      const user = await requireAuth(request);
      return handler(request, user);
    } catch (error) {
      // requireAuth throws a NextResponse for auth errors
      if (error instanceof Response) {
        return error;
      }
      // Unexpected errors
      console.error("[Auth] Unexpected error:", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
  };
}

/**
 * Handler type for optionally authenticated API routes.
 */
type OptionalAuthHandler = (
  request: NextRequest,
  user: AuthUser | null,
) => Promise<Response> | Response;

/**
 * Wrap an API route handler to support optional authentication.
 *
 * The handler receives the user if authenticated, or null otherwise.
 *
 * @param handler - The route handler that receives the optional user
 * @returns A wrapped handler that attempts authentication
 *
 * @example
 * export const GET = withOptionalAuth(async (request, user) => {
 *   if (user) {
 *     return Response.json({ message: `Hello ${user.email}` });
 *   }
 *   return Response.json({ message: "Hello guest" });
 * });
 */
export function withOptionalAuth(
  handler: OptionalAuthHandler,
): (request: NextRequest) => Promise<Response> {
  return async (request: NextRequest) => {
    try {
      const user = await getAuthUser(request);
      return handler(request, user);
    } catch (error) {
      console.error("[Auth] Unexpected error:", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
  };
}
