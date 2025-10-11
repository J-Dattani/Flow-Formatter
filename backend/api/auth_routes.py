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
    role: Optional[str] = "admin"

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

    hashed = pwd_context.hash(payload.password)
    to_insert = {
        "email": payload.email,
        "name": payload.name or payload.email,
        "role": payload.role or "admin",
        "password": hashed,
    }
    inserted = sb.table("users").insert(to_insert).select("id,email,name,role").single().execute()
    user = inserted.data
    if not user:
        raise HTTPException(status_code=500, detail="Failed to create user")

    # Return a simple token placeholder for frontend compatibility
    return {"success": True, "data": {"token": "signup-token", "user": user}}

@router.post("/login")
async def login(payload: LoginRequest):
    sb = get_supabase()
    res = sb.table("users").select("id,email,name,role,password").eq("email", payload.email).limit(1).execute()
    rows = res.data or []
    if not rows:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user_row = rows[0]
    if not pwd_context.verify(payload.password, user_row.get("password") or ""):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user = {k: user_row[k] for k in ("id","email","name","role") if k in user_row}
    return {"success": True, "data": {"token": "mock-token", "user": user}}
