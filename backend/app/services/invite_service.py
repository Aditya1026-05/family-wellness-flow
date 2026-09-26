import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import select, or_
from fastapi import HTTPException, status
from app.models.invite import FamilyInvite
from app.models.parent import ParentProfile
from app.models.family import Family, FamilyMember
from app.models.user import User
from app.models.device_token import DeviceToken
from app.utils.tokens import generate_secure_invite_token, generate_short_code
from app.core.security import create_access_token
from app.services.notification_service import notification_service
from app.schemas.invite import InviteOut, InviteAcceptOut

class InviteService:
    def create_invite_for_parent(
        self,
        db: Session,
        parent_profile_id: uuid.UUID,
        created_by_user_id: uuid.UUID,
        expires_in_hours: int = 48,
    ) -> FamilyInvite:
        parent = db.get(ParentProfile, parent_profile_id)
        if not parent:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent profile not found.")

        # Invalidate any previous unused invites
        existing = db.scalars(
            select(FamilyInvite).where(
                FamilyInvite.parent_profile_id == parent_profile_id,
                FamilyInvite.is_used == False,
            )
        ).all()
        for inv in existing:
            inv.is_used = True

        token = generate_secure_invite_token()
        code = generate_short_code()
        expires_at = datetime.now(timezone.utc) + timedelta(hours=expires_in_hours)

        invite = FamilyInvite(
            family_id=parent.family_id,
            parent_profile_id=parent.id,
            token=token,
            code=code,
            expires_at=expires_at,
            is_used=False,
            created_by_user_id=created_by_user_id,
        )
        db.add(invite)
        db.commit()
        db.refresh(invite)
        return invite

    def get_active_invite_for_parent(self, db: Session, parent_profile_id: uuid.UUID) -> Optional[FamilyInvite]:
        now = datetime.now(timezone.utc)
        return db.scalar(
            select(FamilyInvite).where(
                FamilyInvite.parent_profile_id == parent_profile_id,
                FamilyInvite.is_used == False,
                FamilyInvite.expires_at > now,
            ).order_by(FamilyInvite.created_at.desc())
        )

    def accept_invite(
        self,
        db: Session,
        raw_code: str,
        device_name: Optional[str] = None,
        device_token: Optional[str] = None,
        platform: Optional[str] = "ios",
    ) -> InviteAcceptOut:
        # Extract code from URL or scheme if passed
        cleaned = raw_code.strip()
        if "://" in cleaned:
            cleaned = cleaned.split("/")[-1].split("?")[0]
        if "/" in cleaned:
            cleaned = cleaned.split("/")[-1].split("?")[0]

        now = datetime.now(timezone.utc)
        # Search by token or 6-char code
        invite = db.scalar(
            select(FamilyInvite).where(
                or_(
                    FamilyInvite.token == cleaned,
                    FamilyInvite.code == cleaned.upper(),
                )
            )
        )

        if not invite:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Invite code is invalid or does not exist.",
            )

        if invite.is_used:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This invite code has already been used.",
            )

        exp_at = invite.expires_at
        if exp_at.tzinfo is None:
            exp_at = exp_at.replace(tzinfo=timezone.utc)

        if exp_at < now:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This invite code has expired. Please ask your family for a new invite.",
            )

        parent = db.get(ParentProfile, invite.parent_profile_id)
        if not parent:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Associated parent profile not found.")

        family = db.get(Family, invite.family_id)

        # Create or link user account for the parent
        if parent.user_id:
            parent_user = db.get(User, parent.user_id)
        else:
            parent_user = User(
                email=f"parent_{parent.id.hex[:10]}@carecircle.internal",
                full_name=parent.name,
                role="parent",
            )
            db.add(parent_user)
            db.flush()
            parent.user_id = parent_user.id

            # Add family membership
            membership = FamilyMember(
                family_id=invite.family_id,
                user_id=parent_user.id,
                role="parent",
            )
            db.add(membership)

        # Mark invite as used
        invite.is_used = True
        invite.used_at = now
        db.commit()

        # If device_token was passed (e.g. mobile app accepting invite), link hardware device token
        if device_token:
            token_clean = device_token.strip()
            dev = db.scalar(select(DeviceToken).where(DeviceToken.token == token_clean))
            if dev:
                dev.parent_profile_id = parent.id
                dev.user_id = parent_user.id
                dev.is_active = True
                dev.last_seen_at = now
            else:
                dev = DeviceToken(
                    parent_profile_id=parent.id,
                    user_id=parent_user.id,
                    token=token_clean,
                    provider="expo",
                    platform=platform or "ios",
                    device_name=device_name,
                    is_active=True,
                    created_at=now,
                    last_seen_at=now,
                )
                db.add(dev)
            db.commit()

        # Send alert/notification to child owner
        notification_service.create_notification(
            db=db,
            family_id=invite.family_id,
            title=f"{parent.name} connected",
            message=f"{parent.name} successfully joined your family circle!",
            notification_type="system",
            recipient_user_id=family.owner_id if family else None,
            parent_profile_id=parent.id,
        )

        # Issue parent session token
        token = create_access_token(
            subject=str(parent_user.id),
            extra_claims={
                "role": "parent",
                "parent_profile_id": str(parent.id),
                "family_id": str(invite.family_id),
            },
        )

        return InviteAcceptOut(
            access_token=token,
            token_type="bearer",
            parent_profile_id=str(parent.id),
            parent_name=parent.name,
            relationship=parent.relationship,
            family_id=str(invite.family_id),
            family_name=family.name if family else "Family Circle",
            user_id=str(parent_user.id),
        )

invite_service = InviteService()
