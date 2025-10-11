from fastapi import APIRouter
from typing import Any, Dict, List

from ..supabase_client import get_supabase

router = APIRouter(prefix="/authors", tags=["authors"])


@router.get("")
def list_authors() -> Dict[str, Any]:
	try:
		sb = get_supabase()

		users_res = (
			sb.table("users")
			.select("id,name,email,role,department,status,bio,created_at,last_active")
			.neq("role", "admin")
			.neq("email", "admin@example.com")
			.order("created_at", desc=True)
			.execute()
		)
		users = users_res.data or []

		if not users:
			return {"success": True, "data": []}

		user_ids = [u.get("id") for u in users if u.get("id")]

		docs_map: Dict[str, List[Dict[str, Any]]] = {}
		if user_ids:
			docs_res = (
				sb.table("documents")
				.select("created_by,status")
				.in_("created_by", user_ids)
				.execute()
			)
			for d in docs_res.data or []:
				uid = str(d.get("created_by"))
				docs_map.setdefault(uid, []).append(d)

		shaped: List[Dict[str, Any]] = []
		for u in users:
			uid = str(u.get("id"))
			u_docs = docs_map.get(uid, [])
			documents_count = len(u_docs)
			completed_count = sum(1 for d in u_docs if str(d.get("status", "")).lower() in ("completed", "published"))
			pending_count = max(0, documents_count - completed_count)
			shaped.append(
				{
					"id": u.get("id"),
					"name": u.get("name") or u.get("email"),
					"email": u.get("email"),
					"role": u.get("role") or "contributor",
					"department": u.get("department") or "",
					"status": u.get("status") or "active",
					"bio": u.get("bio") or "",
					"documents_count": documents_count,
					"pending_count": pending_count,
					"completed_count": completed_count,
					"created_at": u.get("created_at"),
					"last_active": u.get("last_active"),
				}
			)

		return {"success": True, "data": shaped}
	except Exception as e:
		return {"success": False, "error": str(e)}

