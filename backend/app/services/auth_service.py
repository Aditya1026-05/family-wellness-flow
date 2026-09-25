import uuid
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import select
from fastapi import HTTPException, status
from app.models.user import User
from app.models.family import Family, FamilyMember
from app.core.security import get_password_hash, verify_password, create_access_token
from app.schemas.auth import UserRegister, UserLogin, Token, UserOut

class AuthService:
    def register_child(self, db: Session, user_in: UserRegister) -> Tuple[Token, User]:
        # Check if email already registered
        existing = db.scalar(select(User).where(User.email == user_in.email.lower()))
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A user with this email already exists.",
            )

        # Create user
        user = User(
            email=user_in.email.lower(),
            hashed_password=get_password_hash(user_in.password),
            full_name=user_in.full_name,
            role="child",
        )
        db.add(user)
        db.flush()

        # Create child's family
        family_name = f"{user.full_name.split()[0]}'s Family" if user.full_name else "My Family"
        family = Family(
            name=family_name,
            owner_id=user.id,
        )
        db.add(family)
        db.flush()

        # Add family member
        member = FamilyMember(
            family_id=family.id,
            user_id=user.id,
            role="child_owner",
        )
        db.add(member)
        db.commit()
        db.refresh(user)

        # Generate JWT token
        access_token = create_access_token(
            subject=str(user.id),
            extra_claims={"role": user.role, "family_id": str(family.id)},
        )

        return Token(
            access_token=access_token,
            token_type="bearer",
            user=UserOut.model_validate(user),
        ), user

    def login_child(self, db: Session, login_in: UserLogin) -> Tuple[Token, User]:
        user = db.scalar(select(User).where(User.email == login_in.email.lower()))
        if not user or not user.hashed_password:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password.",
            )

        if not verify_password(login_in.password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password.",
            )

        # Find family
        family = db.scalar(select(Family).where(Family.owner_id == user.id))
        family_id_str = str(family.id) if family else None

        access_token = create_access_token(
            subject=str(user.id),
            extra_claims={"role": user.role, "family_id": family_id_str},
        )

        return Token(
            access_token=access_token,
            token_type="bearer",
            user=UserOut.model_validate(user),
        ), user

auth_service = AuthService()
