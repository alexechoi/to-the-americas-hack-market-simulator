"""
Notifications Router

API endpoints for sending push notifications via Firebase Cloud Messaging.
"""

import logging
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from auth import FirebaseUser
from firebase_service import get_firebase_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/notifications", tags=["notifications"])


class NotificationPayload(BaseModel):
    """Notification content to send."""

    title: str = Field(
        ..., description="Notification title", min_length=1, max_length=100
    )
    body: str = Field(
        ..., description="Notification body", min_length=1, max_length=500
    )
    data: dict[str, str] | None = Field(
        default=None,
        description="Optional custom data payload (key-value pairs of strings)",
    )


class SendNotificationResponse(BaseModel):
    """Response from sending a notification."""

    success_count: int
    failure_count: int
    message: str
    failed_tokens: list[str] | None = None


class SendToUserRequest(BaseModel):
    """Request to send notification to a specific user."""

    user_id: str = Field(..., description="Target user's Firebase UID")
    notification: NotificationPayload


@router.post("/send", response_model=SendNotificationResponse)
async def send_notification_to_self(
    payload: NotificationPayload,
    user: FirebaseUser,
) -> dict[str, Any]:
    """
    Send a notification to the authenticated user's devices.

    This endpoint sends a push notification to all devices registered
    by the currently authenticated user.
    """
    user_id = user.get("uid")
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not found in token")

    firebase = get_firebase_service()

    result = firebase.send_to_user(
        user_id=user_id,
        title=payload.title,
        body=payload.body,
        data=payload.data,
    )

    if result.get("error"):
        raise HTTPException(
            status_code=500,
            detail=f"Failed to send notification: {result.get('error')}",
        )

    return {
        "success_count": result.get("success_count", 0),
        "failure_count": result.get("failure_count", 0),
        "message": result.get("message", "Notification processed"),
        "failed_tokens": result.get("failed_tokens"),
    }


@router.post("/send/{user_id}", response_model=SendNotificationResponse)
async def send_notification_to_user(
    user_id: str,
    payload: NotificationPayload,
    _user: FirebaseUser,  # Require authentication
) -> dict[str, Any]:
    """
    Send a notification to a specific user's devices.

    This endpoint can be used to send notifications to any user by their UID.
    Requires authentication. In production, you may want to add additional
    authorization checks (e.g., admin role).
    """
    firebase = get_firebase_service()

    result = firebase.send_to_user(
        user_id=user_id,
        title=payload.title,
        body=payload.body,
        data=payload.data,
    )

    if result.get("error"):
        raise HTTPException(
            status_code=500,
            detail=f"Failed to send notification: {result.get('error')}",
        )

    return {
        "success_count": result.get("success_count", 0),
        "failure_count": result.get("failure_count", 0),
        "message": result.get("message", "Notification processed"),
        "failed_tokens": result.get("failed_tokens"),
    }


@router.post("/test")
async def test_notification(
    user: FirebaseUser,
) -> dict[str, Any]:
    """
    Send a test notification to the authenticated user.

    Useful for testing push notification setup.
    """
    user_id = user.get("uid")
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not found in token")

    firebase = get_firebase_service()

    # Get token count for feedback
    tokens = firebase.get_user_device_tokens(user_id)

    if not tokens:
        return {
            "success": False,
            "message": "No device tokens registered. Make sure the app has notification permissions.",
            "token_count": 0,
        }

    result = firebase.send_to_user(
        user_id=user_id,
        title="Test Notification",
        body="If you see this, push notifications are working!",
        data={"type": "test", "timestamp": str(int(__import__("time").time()))},
    )

    return {
        "success": result.get("success_count", 0) > 0,
        "message": result.get("message", "Test notification sent"),
        "token_count": len(tokens),
        "success_count": result.get("success_count", 0),
        "failure_count": result.get("failure_count", 0),
    }
