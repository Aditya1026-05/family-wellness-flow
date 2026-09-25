import uuid
from typing import Generator, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.security import decode_access_token
from app.models.user import User
from app.models.family import Family, FamilyMember
from app.models.parent import ParentProfile

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)

def get_current_user(
    db: Session = Depends(get_db),
    token: Optional[str] = Depends(oauth2_scheme),
) -> User:
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token is missing.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(token)
    if not payload or not payload.get("sub"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user_id = uuid.UUID(payload["sub"])
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload.")

    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    return user

def get_current_child(
    current_user: User = Depends(get_current_user),
) -> User:
    if current_user.role not in ("child", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to child family members.",
        )
    return current_user

def get_current_family(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Family:
    # Check owned family
    family = db.query(Family).filter(Family.owner_id == current_user.id).first()
    if family:
        return family

    # Check member of family
    member = db.query(FamilyMember).filter(FamilyMember.user_id == current_user.id).first()
    if member:
        family = db.get(Family, member.family_id)
        if family:
            return family

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Family circle not found.")

def get_current_parent_profile(
    db: Session = Depends(get_db),
    token: Optional[str] = Depends(oauth2_scheme),
) -> ParentProfile:
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token is missing.",
        )

    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token.")

    parent_profile_id = payload.get("parent_profile_id")
    if parent_profile_id:
        try:
            profile = db.get(ParentProfile, uuid.UUID(parent_profile_id))
            if profile:
                return profile
        except ValueError:
            pass

    # If sub is parent user, check parent_profile
    user_id = payload.get("sub")
    if user_id:
        try:
            profile = db.query(ParentProfile).filter(ParentProfile.user_id == uuid.UUID(user_id)).first()
            if profile:
                return profile
        except ValueError:
            pass

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Parent profile credentials required.")

def get_caller_identity(
    token: Optional[str] = Depends(oauth2_scheme),
) -> dict:
    if not token:
        return {"role": "anonymous"}
    payload = decode_access_token(token)
    if not payload:
        return {"role": "anonymous"}
    role = payload.get("role", "child")
    parent_profile_id = payload.get("parent_profile_id")
    return {"role": role, "parent_profile_id": parent_profile_id, "sub": payload.get("sub")}
