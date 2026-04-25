"""
Firebase Admin SDK service for token verification and push notifications.

This service initializes Firebase Admin and provides methods to verify
Firebase ID tokens sent from frontend/mobile clients, as well as send
push notifications via Firebase Cloud Messaging (FCM).
"""

import logging
import os
from functools import lru_cache
from typing import Any

import firebase_admin
from firebase_admin import auth, credentials, firestore, messaging

logger = logging.getLogger(__name__)


class FirebaseService:
    """Singleton service for Firebase Admin operations."""

    _initialized: bool = False
    _app: firebase_admin.App | None = None

    @classmethod
    def initialize(cls) -> None:
        """
        Initialize Firebase Admin SDK.

        Tries to initialize in the following order:
        1. GOOGLE_APPLICATION_CREDENTIALS environment variable (path to service account JSON)
        2. FIREBASE_SERVICE_ACCOUNT_JSON environment variable (JSON string)
        3. Default credentials (for Cloud Run, Cloud Functions, etc.)
        """
        if cls._initialized:
            logger.debug("Firebase already initialized")
            return

        try:
            # Option 1: Service account file path
            cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
            if cred_path and os.path.exists(cred_path):
                cred = credentials.Certificate(cred_path)
                cls._app = firebase_admin.initialize_app(cred)
                cls._initialized = True
                logger.info("Firebase initialized with service account file")
                return

            # Option 2: Service account JSON string (useful for containerized deployments)
            import json

            cred_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
            if cred_json:
                cred_dict = json.loads(cred_json)
                cred = credentials.Certificate(cred_dict)
                cls._app = firebase_admin.initialize_app(cred)
                cls._initialized = True
                logger.info("Firebase initialized with service account JSON")
                return

            # Option 3: Default credentials (GCP environments)
            cred = credentials.ApplicationDefault()
            cls._app = firebase_admin.initialize_app(cred)
            cls._initialized = True
            logger.info("Firebase initialized with application default credentials")

        except Exception as e:
            logger.error(f"Failed to initialize Firebase: {e}")
            raise RuntimeError(f"Firebase initialization failed: {e}") from e

    @classmethod
    def verify_token(cls, id_token: str) -> dict:
        """
        Verify a Firebase ID token.

        Args:
            id_token: The Firebase ID token from the client

        Returns:
            Decoded token containing user info (uid, email, etc.)

        Raises:
            RuntimeError: If Firebase is not initialized
            ValueError: If token is invalid or expired
        """
        if not cls._initialized:
            raise RuntimeError(
                "Firebase is not initialized. Call FirebaseService.initialize() first."
            )

        try:
            decoded_token = auth.verify_id_token(id_token)
            logger.info(f"Token verified for user: {decoded_token.get('uid')}")
            return decoded_token

        except auth.InvalidIdTokenError as e:
            logger.warning(f"Invalid token: {e}")
            raise ValueError("Invalid authentication token") from e

        except auth.ExpiredIdTokenError as e:
            logger.warning(f"Expired token: {e}")
            raise ValueError("Authentication token has expired") from e

        except auth.RevokedIdTokenError as e:
            logger.warning(f"Revoked token: {e}")
            raise ValueError("Authentication token has been revoked") from e

        except auth.CertificateFetchError as e:
            logger.error(f"Certificate fetch error: {e}")
            raise ValueError("Unable to verify token at this time") from e

        except Exception as e:
            logger.error(f"Token verification failed: {e}")
            raise ValueError("Token verification failed") from e

    @classmethod
    def get_firestore_client(cls):
        """Get the Firestore client."""
        if not cls._initialized:
            raise RuntimeError(
                "Firebase is not initialized. Call FirebaseService.initialize() first."
            )
        return firestore.client()

    @classmethod
    def get_user_device_tokens(cls, user_id: str) -> list[str]:
        """
        Get device tokens for a user from Firestore.

        Args:
            user_id: The user's Firebase UID

        Returns:
            List of FCM device tokens
        """
        if not cls._initialized:
            raise RuntimeError(
                "Firebase is not initialized. Call FirebaseService.initialize() first."
            )

        try:
            db = cls.get_firestore_client()
            user_doc = db.collection("users").document(user_id).get()

            if not user_doc.exists:
                logger.warning(f"User document not found for user: {user_id}")
                return []

            data = user_doc.to_dict()
            tokens = data.get("deviceTokens", [])
            return tokens if isinstance(tokens, list) else []

        except Exception as e:
            logger.error(f"Error fetching device tokens for user {user_id}: {e}")
            return []

    @classmethod
    def remove_device_token(cls, user_id: str, token: str) -> None:
        """
        Remove an invalid device token from a user's document.

        Args:
            user_id: The user's Firebase UID
            token: The FCM token to remove
        """
        if not cls._initialized:
            raise RuntimeError(
                "Firebase is not initialized. Call FirebaseService.initialize() first."
            )

        try:
            db = cls.get_firestore_client()
            user_ref = db.collection("users").document(user_id)
            user_ref.update({"deviceTokens": firestore.ArrayRemove([token])})
            logger.info(f"Removed invalid token from user {user_id}")
        except Exception as e:
            logger.error(f"Error removing device token: {e}")

    @classmethod
    def send_to_device(
        cls,
        token: str,
        title: str,
        body: str,
        data: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        """
        Send a push notification to a specific device.

        Args:
            token: FCM device token
            title: Notification title
            body: Notification body
            data: Optional data payload

        Returns:
            Result dict with success status and message_id
        """
        if not cls._initialized:
            raise RuntimeError(
                "Firebase is not initialized. Call FirebaseService.initialize() first."
            )

        try:
            message = messaging.Message(
                notification=messaging.Notification(title=title, body=body),
                data=data or {},
                token=token,
            )

            response = messaging.send(message)
            logger.info(f"Notification sent successfully: {response}")
            return {"success": True, "message_id": response}

        except messaging.UnregisteredError:
            logger.warning(f"Token is unregistered: {token[:20]}...")
            return {"success": False, "error": "unregistered", "token": token}

        except messaging.SenderIdMismatchError:
            logger.error(f"Sender ID mismatch for token: {token[:20]}...")
            return {"success": False, "error": "sender_id_mismatch", "token": token}

        except Exception as e:
            logger.error(f"Failed to send notification: {e}")
            return {"success": False, "error": str(e)}

    @classmethod
    def send_to_user(
        cls,
        user_id: str,
        title: str,
        body: str,
        data: dict[str, str] | None = None,
        auto_cleanup_invalid_tokens: bool = True,
    ) -> dict[str, Any]:
        """
        Send a push notification to all of a user's devices.

        Args:
            user_id: The user's Firebase UID
            title: Notification title
            body: Notification body
            data: Optional data payload
            auto_cleanup_invalid_tokens: Whether to remove invalid tokens automatically

        Returns:
            Result dict with success_count, failure_count, and failed_tokens
        """
        tokens = cls.get_user_device_tokens(user_id)

        if not tokens:
            logger.warning(f"No device tokens found for user: {user_id}")
            return {
                "success_count": 0,
                "failure_count": 0,
                "message": "No device tokens registered",
            }

        return cls.send_multicast(
            tokens=tokens,
            title=title,
            body=body,
            data=data,
            user_id=user_id,
            auto_cleanup_invalid_tokens=auto_cleanup_invalid_tokens,
        )

    @classmethod
    def send_multicast(
        cls,
        tokens: list[str],
        title: str,
        body: str,
        data: dict[str, str] | None = None,
        user_id: str | None = None,
        auto_cleanup_invalid_tokens: bool = True,
    ) -> dict[str, Any]:
        """
        Send a push notification to multiple devices.

        Args:
            tokens: List of FCM device tokens (max 500)
            title: Notification title
            body: Notification body
            data: Optional data payload
            user_id: Optional user ID for token cleanup
            auto_cleanup_invalid_tokens: Whether to remove invalid tokens automatically

        Returns:
            Result dict with success_count, failure_count, and failed_tokens
        """
        if not cls._initialized:
            raise RuntimeError(
                "Firebase is not initialized. Call FirebaseService.initialize() first."
            )

        if not tokens:
            return {"success_count": 0, "failure_count": 0, "failed_tokens": []}

        # FCM has a limit of 500 tokens per multicast
        if len(tokens) > 500:
            logger.warning(f"Token count ({len(tokens)}) exceeds 500, truncating")
            tokens = tokens[:500]

        try:
            message = messaging.MulticastMessage(
                notification=messaging.Notification(title=title, body=body),
                data=data or {},
                tokens=tokens,
            )

            response = messaging.send_each_for_multicast(message)

            success_count = response.success_count
            failure_count = response.failure_count
            failed_tokens = []

            # Collect failed tokens for cleanup
            for idx, send_response in enumerate(response.responses):
                if not send_response.success:
                    failed_token = tokens[idx]
                    failed_tokens.append(failed_token)

                    # Check if token is invalid and should be removed
                    if send_response.exception:
                        error_code = getattr(send_response.exception, "code", None)
                        if error_code in [
                            "messaging/registration-token-not-registered",
                            "messaging/invalid-registration-token",
                        ]:
                            logger.warning(
                                f"Invalid token detected: {failed_token[:20]}..."
                            )

            # Auto-cleanup invalid tokens
            if auto_cleanup_invalid_tokens and failed_tokens and user_id:
                for token in failed_tokens:
                    cls.remove_device_token(user_id, token)

            logger.info(
                f"Multicast sent: {success_count} success, {failure_count} failed"
            )

            return {
                "success_count": success_count,
                "failure_count": failure_count,
                "failed_tokens": failed_tokens,
                "message": f"Notification sent to {success_count} device(s)",
            }

        except Exception as e:
            logger.error(f"Failed to send multicast notification: {e}")
            return {
                "success_count": 0,
                "failure_count": len(tokens),
                "failed_tokens": tokens,
                "error": str(e),
            }


@lru_cache
def get_firebase_service() -> type[FirebaseService]:
    """Get the Firebase service singleton."""
    FirebaseService.initialize()
    return FirebaseService


# Initialize on import if credentials are available
def auto_initialize() -> None:
    """Auto-initialize Firebase if credentials are available."""
    try:
        get_firebase_service()
    except RuntimeError:
        logger.warning(
            "Firebase not auto-initialized. Set GOOGLE_APPLICATION_CREDENTIALS or "
            "FIREBASE_SERVICE_ACCOUNT_JSON environment variable."
        )
