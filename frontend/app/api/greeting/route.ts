/**
 * Example API route with optional authentication.
 *
 * GET /api/greeting
 * Optional: Authorization: Bearer <firebase-id-token>
 */

import { withOptionalAuth } from "@/app/lib/auth";

export const GET = withOptionalAuth(async (request, user) => {
  if (user) {
    const name = user.name || user.email || "user";
    return Response.json({ message: `Welcome back, ${name}!` });
  }
  return Response.json({ message: "Hello, guest!" });
});
