from fastapi import APIRouter
from typing import Any, Dict, List

from ..supabase_client import get_supabase

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _safe_count(res) -> int:
	try:
		# supabase-py v2 returns count on the response object
		if hasattr(res, "count") and isinstance(res.count, int):
			return res.count
		# fallback: if data list is returned and small, use its length
		data = getattr(res, "data", None)
		if isinstance(data, list):
			return len(data)
	except Exception:
		pass
	return 0


@router.get("/stats")
def get_stats() -> Dict[str, Any]:
	try:
		supa = get_supabase()

		# templates count
		t = supa.table("templates").select("id", count="exact").execute()
		templates = _safe_count(t)

		# authors count (roles author/editor/reviewer)
		a = (
			supa.table("users")
			.select("id", count="exact")
			.in_("role", ["author", "editor", "reviewer"])
			.execute()
		)
		authors = _safe_count(a)

		# pending submissions (not drafts and progress < 100)
		p = (
			supa.table("form_submissions")
			.select("id", count="exact")
			.eq("is_draft", False)
			.lt("progress_percentage", 100)
			.execute()
		)
		pending = _safe_count(p)

		# generated documents (completed or published)
		g = (
			supa.table("documents")
			.select("id", count="exact")
			.in_("status", ["completed", "published"])
			.execute()
		)
		generated = _safe_count(g)

		return {
			"success": True,
			"data": {
				"templates": templates,
				"authors": authors,
				"pendingSubmissions": pending,
				"generatedDocuments": generated,
			},
		}
	except Exception as e:
		return {"success": False, "error": str(e)}


@router.get("/recent-documents")
def get_recent_documents() -> Dict[str, Any]:
	try:
		supa = get_supabase()

		# latest 10 documents
		docs_res = (
			supa.table("documents")
			.select("id,title,status,created_at,created_by,template_id")
			.order("created_at", desc=True)
			.limit(10)
			.execute()
		)
		docs = docs_res.data or []
		if not docs:
			return {"success": True, "data": []}

		user_ids = list({d.get("created_by") for d in docs if d.get("created_by")})
		tpl_ids = list({d.get("template_id") for d in docs if d.get("template_id")})

		users_map: Dict[str, Dict[str, Any]] = {}
		if user_ids:
			users_res = (
				supa.table("users")
				.select("id,name,email")
				.in_("id", user_ids)
				.execute()
			)
			for u in users_res.data or []:
				users_map[str(u.get("id"))] = u

		tpls_map: Dict[str, Dict[str, Any]] = {}
		if tpl_ids:
			tpls_res = (
				supa.table("templates")
				.select("id,name")
				.in_("id", tpl_ids)
				.execute()
			)
			for t in tpls_res.data or []:
				tpls_map[str(t.get("id"))] = t

		shaped: List[Dict[str, Any]] = []
		for d in docs:
			uid = str(d.get("created_by")) if d.get("created_by") is not None else ""
			tid = str(d.get("template_id")) if d.get("template_id") is not None else ""
			u = users_map.get(uid)
			t = tpls_map.get(tid)
			shaped.append(
				{
					"authorName": (u.get("name") if u and u.get("name") else (u.get("email") if u else "Unknown")),
					"templateName": (t.get("name") if t and t.get("name") else "Untitled"),
					"submittedAt": d.get("created_at"),
					"status": d.get("status") or "pending",
				}
			)

		return {"success": True, "data": shaped}
	except Exception as e:
		return {"success": False, "error": str(e)}

