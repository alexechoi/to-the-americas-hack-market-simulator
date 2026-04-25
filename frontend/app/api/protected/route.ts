/**
 * Example protected API route.
 *
 * GET /api/protected
 * Requires: Authorization: Bearer <firebase-id-token>
 */

import { withAuth } from "@/app/lib/auth";

export const GET = withAuth(async (request, user) => {
  return Response.json({
    message: `Hello, ${user.name || user.email || "user"}!`,
    userId: user.uid,
  });
});
