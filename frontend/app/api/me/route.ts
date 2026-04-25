/**
 * Protected API route that returns the current user's info.
 *
 * GET /api/me
 * Requires: Authorization: Bearer <firebase-id-token>
 */

import { withAuth } from "@/app/lib/auth";

export const GET = withAuth(async (request, user) => {
  return Response.json({
    uid: user.uid,
    email: user.email,
    emailVerified: user.emailVerified,
    name: user.name,
    picture: user.picture,
  });
});
