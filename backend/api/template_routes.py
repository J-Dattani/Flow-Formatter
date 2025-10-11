from fastapi import APIRouter, HTTPException
from fastapi import Body
from typing import Any, Dict
from ..supabase_client import get_supabase

router = APIRouter(prefix="/templates", tags=["templates"])


@router.get("")
async def list_templates():
    """Return templates from Supabase (service role) for the admin UI."""
    try:
        supa = get_supabase()
        # Select minimal fields expected by frontend
        res = supa.table('templates').select('id,name,description,category,metadata,version,updated_at').order('updated_at', desc=True).execute()
        data = getattr(res, 'data', None) or []
        return {"success": True, "data": data}
    except Exception as e:
        raise HTTPException(500, f"Failed to load templates: {e}")


@router.get("/{template_id}")
async def get_template_by_id(template_id: str):
    try:
        supa = get_supabase()
        res = supa.table('templates').select('id,name,description,category,metadata,version,created_by,updated_at').eq('id', template_id).limit(1).execute()
        data = (getattr(res, 'data', None) or [])
        if not data:
            raise HTTPException(404, "Template not found")
        return {"success": True, "data": data[0]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Failed to load template: {e}")


@router.delete("/{template_id}")
async def delete_template(template_id: str):
    try:
        supa = get_supabase()
        res = supa.table('templates').delete().eq('id', template_id).execute()
        # Supabase Python returns status in the response; consider no data on delete
        return {"success": True, "data": {"id": template_id}}
    except Exception as e:
        raise HTTPException(500, f"Failed to delete template: {e}")


@router.post("")
async def create_template(payload: Dict[str, Any] = Body(...)):
    """Create a new template. Accepts flexible payload; stores editor content under metadata.editor.content.
    Returns minimal fields needed by UI.
    """
    try:
        supa = get_supabase()
        meta = payload.get('metadata') or {}
        editor = meta.get('editor') or {}
        # Ensure content lands under metadata.editor.content
        if 'content' in payload and 'content' not in editor:
            editor['content'] = payload.get('content')
        meta['editor'] = editor

        # Optional extras that may or may not exist in DB
        extras = {
            'structure': payload.get('structure') or {},
            'chapters': payload.get('chapters') or [],
            'variables': payload.get('variables') or [],
        }

        data = {
            'name': payload.get('name') or 'Untitled Template',
            'description': payload.get('description') or '',
            'category': payload.get('category') or 'general',
            'metadata': meta,
            'created_by': payload.get('created_by'),
            'version': payload.get('version') or 1,
            **extras,
        }

        # First attempt with extras present
        res = supa.table('templates').insert(data).execute()
        if getattr(res, 'data', None) is None and getattr(res, 'error', None):
            raise Exception(res.error)

        # Query back minimal fields (some drivers return inserted rows, but be robust)
        sel = supa.table('templates').select('id,name,category,updated_at,metadata').order('updated_at', desc=True).limit(1).execute()
        created = (getattr(sel, 'data', None) or [None])[0]
        return {"success": True, "data": created}
    except Exception as e:
        # Retry without extras if column mismatch
        try:
            supa = get_supabase()
            meta = payload.get('metadata') or {}
            editor = meta.get('editor') or {}
            if 'content' in payload and 'content' not in editor:
                editor['content'] = payload.get('content')
            meta['editor'] = editor
            data2 = {
                'name': payload.get('name') or 'Untitled Template',
                'description': payload.get('description') or '',
                'category': payload.get('category') or 'general',
                'metadata': meta,
                'created_by': payload.get('created_by'),
                'version': payload.get('version') or 1,
            }
            res2 = supa.table('templates').insert(data2).execute()
            if getattr(res2, 'data', None) is None and getattr(res2, 'error', None):
                raise Exception(res2.error)
            sel = supa.table('templates').select('id,name,category,updated_at,metadata').order('updated_at', desc=True).limit(1).execute()
            created = (getattr(sel, 'data', None) or [None])[0]
            return {"success": True, "data": created}
        except Exception as e2:
            raise HTTPException(500, f"Failed to create template: {e2}")


@router.put("/{template_id}")
async def update_template(template_id: str, payload: Dict[str, Any] = Body(...)):
    """Update a template by ID. Stores editor content in metadata.editor.content; tolerant to optional columns."""
    try:
        supa = get_supabase()
        meta = payload.get('metadata') or {}
        editor = meta.get('editor') or {}
        if 'content' in payload and 'content' not in editor:
            editor['content'] = payload.get('content')
        meta['editor'] = editor

        extras = {
            'structure': payload.get('structure') or {},
            'chapters': payload.get('chapters') or [],
            'variables': payload.get('variables') or [],
        }

        data = {
            'name': payload.get('name'),
            'description': payload.get('description'),
            'category': payload.get('category') or 'general',
            'metadata': meta,
            'version': (payload.get('version') or 1),
            'created_by': payload.get('created_by'),
            **extras,
        }

        res = supa.table('templates').update(data).eq('id', template_id).execute()
        if getattr(res, 'error', None):
            raise Exception(res.error)
        sel = supa.table('templates').select('id,name,category,updated_at,metadata').eq('id', template_id).limit(1).execute()
        item = (getattr(sel, 'data', None) or [None])[0]
        if not item:
            raise Exception('Template not found after update')
        return {"success": True, "data": item}
    except Exception as e:
        # Retry without extras
        try:
            supa = get_supabase()
            meta = payload.get('metadata') or {}
            editor = meta.get('editor') or {}
            if 'content' in payload and 'content' not in editor:
                editor['content'] = payload.get('content')
            meta['editor'] = editor
            data2 = {
                'name': payload.get('name'),
                'description': payload.get('description'),
                'category': payload.get('category') or 'general',
                'metadata': meta,
                'version': (payload.get('version') or 1),
                'created_by': payload.get('created_by'),
            }
            res2 = supa.table('templates').update(data2).eq('id', template_id).execute()
            if getattr(res2, 'error', None):
                raise Exception(res2.error)
            sel = supa.table('templates').select('id,name,category,updated_at,metadata').eq('id', template_id).limit(1).execute()
            item = (getattr(sel, 'data', None) or [None])[0]
            if not item:
                raise Exception('Template not found after update')
            return {"success": True, "data": item}
        except Exception as e2:
            raise HTTPException(500, f"Failed to update template: {e2}")
