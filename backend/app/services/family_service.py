import uuid
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import select
from fastapi import HTTPException, status
from app.models.family import Family, FamilyMember
from app.models.user import User

class FamilyService:
    def get_family_for_user(self, db: Session, user_id: uuid.UUID) -> Family:
        # First check owned family
        family = db.scalar(select(Family).where(Family.owner_id == user_id))
        if family:
            return family

        # Then check membership
        member = db.scalar(select(FamilyMember).where(FamilyMember.user_id == user_id))
        if member:
            family = db.get(Family, member.family_id)
            if family:
                return family

        # If user has no family, create one
        user = db.get(User, user_id)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

        family = Family(
            name=f"{user.full_name}'s Family",
            owner_id=user.id,
        )
        db.add(family)
        db.flush()

        member = FamilyMember(
            family_id=family.id,
            user_id=user.id,
            role="child_owner",
        )
        db.add(member)
        db.commit()
        db.refresh(family)
        return family

family_service = FamilyService()
