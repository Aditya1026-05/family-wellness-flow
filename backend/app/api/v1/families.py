from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.api.deps import get_current_family, get_current_user
from app.models.family import Family
from app.models.user import User
from app.schemas.family import FamilyOut

router = APIRouter(prefix="/families", tags=["Families"])

@router.get("/current", response_model=FamilyOut)
def get_current_user_family(
    family: Family = Depends(get_current_family),
):
    return FamilyOut(
        id=family.id,
        name=family.name,
        owner_id=family.owner_id,
        created_at=family.created_at,
        members_count=len(family.members),
    )
