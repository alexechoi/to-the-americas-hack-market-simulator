/**
 * Converts Firebase error codes to user-friendly messages
 */
export function getFirebaseErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return "An unexpected error occurred. Please try again.";
  }

  const message = error.message;

  // Firebase Auth error codes
  if (message.includes("auth/email-already-in-use")) {
    return "This email is already registered. Please sign in instead.";
  }
  if (message.includes("auth/invalid-email")) {
    return "Please enter a valid email address.";
  }
  if (message.includes("auth/operation-not-allowed")) {
    return "This sign-in method is not enabled. Please contact support.";
  }
  if (message.includes("auth/weak-password")) {
    return "Password is too weak. Please use at least 6 characters.";
  }
  if (message.includes("auth/user-disabled")) {
    return "This account has been disabled. Please contact support.";
  }
  if (message.includes("auth/user-not-found")) {
    return "No account found with this email. Please sign up first.";
  }
  if (message.includes("auth/wrong-password")) {
    return "Incorrect password. Please try again.";
  }
  if (message.includes("auth/invalid-credential")) {
    return "Invalid email or password. Please check your credentials.";
  }
  if (message.includes("auth/too-many-requests")) {
    return "Too many failed attempts. Please try again later.";
  }
  if (message.includes("auth/network-request-failed")) {
    return "Network error. Please check your connection and try again.";
  }
  if (message.includes("auth/popup-closed-by-user")) {
    return "Sign-in was cancelled. Please try again.";
  }
  if (message.includes("auth/popup-blocked")) {
    return "Pop-up was blocked by your browser. Please allow pop-ups and try again.";
  }
  if (message.includes("auth/account-exists-with-different-credential")) {
    return "An account already exists with this email using a different sign-in method.";
  }
  if (message.includes("auth/requires-recent-login")) {
    return "Please sign in again to complete this action.";
  }

  // Firestore error codes
  if (message.includes("permission-denied")) {
    return "You don't have permission to perform this action.";
  }
  if (message.includes("unavailable")) {
    return "Service is temporarily unavailable. Please try again later.";
  }

  // Return the original message if no match found
  return message;
}
