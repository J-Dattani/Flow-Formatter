from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from typing import Optional
from passlib.context import CryptContext
from ..supabase_client import get_supabase

router = APIRouter(prefix="/auth", tags=["auth"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    name: Optional[str] = None
    role: Optional[str] = "user"

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

@router.post("/signup")
async def signup(payload: SignupRequest):
    sb = get_supabase()
    # If no users exist yet, allow first signup to be admin by default
    try:
        existing_any = sb.table("users").select("id", count="exact").limit(1).execute()
        if getattr(existing_any, "count", 0) == 0:
            if not payload.role:
                payload.role = "admin"
    except Exception:
        pass
    # Check if exists
    existing = sb.table("users").select("id,email").eq("email", payload.email).limit(1).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Store password as provided (no hashing) per simplified requirements
    to_insert = {
        "email": payload.email,
        "name": payload.name or payload.email,
        "role": payload.role or "admin",
        "password": payload.password,
    }
    try:
        inserted = sb.table("users").insert(to_insert).select("id,email,name,role").single().execute()
        user = inserted.data
        if not user:
            raise HTTPException(status_code=500, detail="Failed to create user")
    except Exception as e:
        # Fallback: if 'password' column doesn't exist, store password in 'bio'
        try:
            to_insert_alt = {
                "email": payload.email,
                "name": payload.name or payload.email,
                "role": payload.role or "admin",
                "bio": payload.password,
            }
            inserted = sb.table("users").insert(to_insert_alt).select("id,email,name,role").single().execute()
            user = inserted.data
            if not user:
                raise HTTPException(status_code=500, detail="Failed to create user (no password column)")
        except Exception as e2:
            raise HTTPException(status_code=500, detail=f"Signup failed: {str(e2)}")

    # Return a simple token placeholder for frontend compatibility
    return {"success": True, "data": {"token": "signup-token", "user": user}}

@router.post("/login")
async def login(payload: LoginRequest):
    sb = get_supabase()
    res = sb.table("users").select("id,email,name,role,password,bio").eq("email", payload.email).limit(1).execute()
    rows = res.data or []
    if not rows:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user_row = rows[0]
    stored_pw = user_row.get("password") or user_row.get("bio") or ""
    # Accept login if plain-text matches, or legacy bcrypt hash verifies
    plain_ok = (stored_pw == payload.password)
    legacy_ok = False
    try:
        legacy_ok = pwd_context.verify(payload.password, stored_pw)
    except Exception:
        legacy_ok = False
    if not (plain_ok or legacy_ok):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user = {k: user_row[k] for k in ("id","email","name","role") if k in user_row}
    return {"success": True, "data": {"token": "mock-token", "user": user}}
