"""FCM push notification service.

Firebase is initialised lazily on first use.  If FIREBASE_CREDENTIALS_JSON is
empty or invalid the module degrades gracefully — all send functions become
no-ops so missing config never breaks the request path.
"""

import json
import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings

logger = logging.getLogger(__name__)

_firebase_initialised = False


def _messaging() -> Any:
    """Return firebase_admin.messaging if Firebase is configured, else None."""
    global _firebase_initialised
    try:
        cred_data: dict[str, Any] = json.loads(settings.firebase_credentials_json)
        if not cred_data:
            return None
        import firebase_admin
        from firebase_admin import credentials, messaging

        if not _firebase_initialised:
            try:
                cred = credentials.Certificate(cred_data)
                firebase_admin.initialize_app(cred)
            except ValueError:
                # "App already exists" — another worker in this process already initialised it
                pass
            _firebase_initialised = True
        return messaging
    except Exception:  # noqa: BLE001
        return None


async def _get_device_tokens(db: AsyncSession, user_id: object) -> list[str]:
    from app.models.device_token import DeviceToken

    result = await db.execute(
        select(DeviceToken.token).where(DeviceToken.user_id == user_id)
    )
    return list(result.scalars().all())


async def _send(token: str, title: str, body: str, data: dict[str, str]) -> None:
    """Send a single FCM message. Silently skips if Firebase is not configured."""
    msg_mod = _messaging()
    if msg_mod is None:
        return
    try:
        message = msg_mod.Message(
            notification=msg_mod.Notification(title=title, body=body),
            data=data,
            token=token,
        )
        msg_mod.send(message)
    except Exception:  # noqa: BLE001
        logger.warning("FCM send failed for token %s", token[:20])


async def notify_new_report(db: AsyncSession, report: Any) -> None:
    """Notify all MANAGERs when a new report is submitted."""
    from app.models.user import User, UserRole

    managers = (
        await db.execute(select(User).where(User.role == UserRole.MANAGER))
    ).scalars().all()

    for manager in managers:
        for token in await _get_device_tokens(db, manager.id):
            await _send(
                token=token,
                title="New Report",
                body=f"{report.title} — {report.priority}",
                data={"type": "new_report", "reportId": str(report.id)},
            )


async def notify_status_change(db: AsyncSession, report: Any, new_status: str) -> None:
    """Notify the reporter when their report status changes."""
    for token in await _get_device_tokens(db, report.reporter_id):
        await _send(
            token=token,
            title="Report Updated",
            body=f'"{report.title}" is now {new_status.replace("_", " ").title()}',
            data={"type": "status_change", "reportId": str(report.id), "status": new_status},
        )
