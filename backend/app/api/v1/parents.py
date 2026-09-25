import uuid
from typing import List, Any, Optional
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.api.deps import get_current_family, get_current_user
from app.models.family import Family
from app.models.user import User
from app.schemas.parent import ParentCreate, ParentUpdate, ParentOut, ParentAdherenceDay
from app.schemas.invite import InviteOut
from app.services.parent_service import parent_service
from app.services.invite_service import invite_service

router = APIRouter(prefix="/parents", tags=["Parents"])

@router.get("", response_model=List[ParentOut])
def list_parents(
    family: Family = Depends(get_current_family),
    db: Session = Depends(get_db),
):
    return parent_service.list_parents(db, family.id)

@router.post("", status_code=status.HTTP_201_CREATED)
def create_parent(
    parent_in: ParentCreate,
    family: Family = Depends(get_current_family),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    parent, invite = parent_service.create_parent(
        db=db,
        family_id=family.id,
        user_id=current_user.id,
        parent_in=parent_in,
    )
    return {
        "id": str(parent.id),
        "name": parent.name,
        "relationship": parent.relationship,
        "initials": parent.initials,
        "color": parent.color,
        "lastActivity": "Invite pending",
        "completion": 100,
        "invite_token": invite.token,
        "short_code": invite.code,
        "invite_code": f"carecircle://join/{invite.token}",
    }

@router.get("/{parent_id}", response_model=ParentOut)
def get_parent(
    parent_id: str,
    family: Family = Depends(get_current_family),
    db: Session = Depends(get_db),
):
    return parent_service.get_parent_by_id(db, uuid.UUID(parent_id))

@router.put("/{parent_id}", response_model=ParentOut)
def update_parent(
    parent_id: str,
    parent_in: ParentUpdate,
    family: Family = Depends(get_current_family),
    db: Session = Depends(get_db),
):
    return parent_service.update_parent(db, uuid.UUID(parent_id), family.id, parent_in)

@router.delete("/{parent_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_parent(
    parent_id: str,
    family: Family = Depends(get_current_family),
    db: Session = Depends(get_db),
):
    parent_service.delete_parent(db, uuid.UUID(parent_id), family.id)
    return None

@router.get("/{parent_id}/invite", response_model=InviteOut)
def get_parent_invite(
    parent_id: str,
    family: Family = Depends(get_current_family),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pid = uuid.UUID(parent_id)
    parent = parent_service.get_parent_by_id(db, pid)
    invite = invite_service.get_active_invite_for_parent(db, pid)
    if not invite:
        invite = invite_service.create_invite_for_parent(
            db=db,
            parent_profile_id=pid,
            created_by_user_id=current_user.id,
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

@router.get("/{parent_id}/adherence", response_model=List[ParentAdherenceDay])
def get_parent_adherence(
    parent_id: str,
    range: str = "week",
    year: Optional[int] = None,
    month: Optional[int] = None,
    db: Session = Depends(get_db),
):
    return parent_service.get_adherence(db, parent_id, range_type=range, year=year, month=month)
