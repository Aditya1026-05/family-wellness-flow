import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.parent import ParentProfile
from app.schemas.invite import InviteCreate, InviteOut, InviteAccept, InviteAcceptOut
from app.services.invite_service import invite_service

router = APIRouter(prefix="/invites", tags=["Invites"])

@router.post("", response_model=InviteOut, status_code=status.HTTP_201_CREATED)
def create_invite(
    invite_in: InviteCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    invite = invite_service.create_invite_for_parent(
        db=db,
        parent_profile_id=uuid.UUID(invite_in.parent_profile_id),
        created_by_user_id=current_user.id,
        expires_in_hours=invite_in.expires_in_hours or 48,
    )
    return InviteOut(
        id=str(invite.id),
        token=invite.token,
        code=invite.code,
        qr_value=f"carecircle://join/{invite.token}",
        expires_at=invite.expires_at,
        is_used=invite.is_used,
        parent_profile_id=str(invite.parent_profile_id),
        parent_name=invite.parent_profile.name if invite.parent_profile else None,
        family_id=str(invite.family_id),
    )

@router.get("/parent/{parent_id}", response_model=InviteOut)
def get_parent_invite(
    parent_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        p_uuid = uuid.UUID(parent_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid parent ID.")

    parent = db.get(ParentProfile, p_uuid)
    if not parent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent not found.")

    invite = invite_service.get_active_invite_for_parent(db, parent.id)
    if not invite:
        invite = invite_service.create_invite_for_parent(
            db=db,
            parent_profile_id=parent.id,
            created_by_user_id=current_user.id,
            expires_in_hours=48,
        )

    return InviteOut(
        id=str(invite.id),
        token=invite.token,
        code=invite.code,
        qr_value=f"carecircle://join/{invite.token}",
        expires_at=invite.expires_at,
        is_used=invite.is_used,
        parent_profile_id=str(invite.parent_profile_id),
        parent_name=parent.name,
        family_id=str(invite.family_id),
    )

@router.post("/parent/{parent_id}/regenerate", response_model=InviteOut)
def regenerate_parent_invite(
    parent_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        p_uuid = uuid.UUID(parent_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid parent ID.")

    parent = db.get(ParentProfile, p_uuid)
    if not parent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent not found.")

    invite = invite_service.create_invite_for_parent(
        db=db,
        parent_profile_id=parent.id,
        created_by_user_id=current_user.id,
        expires_in_hours=48,
    )

    return InviteOut(
        id=str(invite.id),
        token=invite.token,
        code=invite.code,
        qr_value=f"carecircle://join/{invite.token}",
        expires_at=invite.expires_at,
        is_used=invite.is_used,
        parent_profile_id=str(invite.parent_profile_id),
        parent_name=parent.name,
        family_id=str(invite.family_id),
    )

@router.post("/accept", response_model=InviteAcceptOut)
def accept_invite(
    accept_in: InviteAccept,
    db: Session = Depends(get_db),
):
    return invite_service.accept_invite(
        db=db,
        raw_code=accept_in.code,
        device_name=accept_in.device_name,
        device_token=accept_in.device_token,
        platform=accept_in.platform,
    )
