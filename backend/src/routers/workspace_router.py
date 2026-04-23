import logging
from fastapi import APIRouter, Depends, Request, UploadFile, HTTPException, Header
from sqlalchemy.orm import Session
from typing import Optional
import json
import math
from src.cache.cache import (
    cache_get, cache_set, cache_delete,
    key_cross_pdf_links, key_workspace_groups, key_workspace_list
)
from src.utils.case_context import build_case_context, apply_case_context_to_model

logger = logging.getLogger(__name__)
# Repository Imports
from src.repo.workspace_repo import WorkspaceRepo
from src.repo.snippet_repo import SnippetRepo
from src.repo.box_repo import BoxRepo
from src.repo.line_repo import LineRepo
from src.repo.connection_repo import ConnectionRepo

# Database and Models
from src.db.db import get_db
from src.models.snippet_model import Snippet
from src.models.box_model import Box
from src.models.line_model import Line
from src.models.connection_model import Connection
from src.models.workspace_model import Workspace
from src.models.workspace_group_model import WorkspaceGroup

# Request Models
from src.request.snippet_request import SnippetCreate
from src.request.box_request import BoxCreate, BoxUpdate
from src.request.line_request import LineCreate, LineUpdate
from src.request.connection_request import ConnectionCreate, ConnectionUpdate

router = APIRouter(prefix="/workspace", tags=["workspace"])

# ----------------------------
# HELPERS
# ----------------------------
def safe_float(value, default=0.0):
    try:
        val = float(value)
        if math.isnan(val) or math.isinf(val):
            return default
        return val
    except (TypeError, ValueError):
        return default

def safe_int(value, default=0):
    try:
        if value is None or value == "": return default
        return int(value)
    except (TypeError, ValueError):
        return default

def resolve_connection_endpoint_id(raw_value, id_map):
    mapped_id = id_map.get(str(raw_value))
    if mapped_id:
        return mapped_id

    candidate = safe_int(raw_value)
    # Workspace object IDs come from SERIAL/INTEGER-backed tables.
    # Very large numeric values are almost always client-side temporary IDs
    # (for example Date.now()), so never persist them as real connection endpoints.
    if 0 < candidate <= 2147483647:
        return candidate
    return 0

def get_obj_id(obj):
    if obj is None: return None
    if isinstance(obj, dict): return obj.get("id")
    return getattr(obj, "id", None)

def extract_index_and_key(path: str):
    parts = path.split("[")
    idx = parts[1].split("]")[0]
    key = parts[2].split("]")[0]
    return idx, key


def resolve_request_user_id(
    x_user_id: Optional[str],
    x_case_no: Optional[str],
    x_case_year: Optional[str],
    x_case_type: Optional[str],
) -> str:
    if x_user_id:
        return x_user_id
    return (
        f"case_no={(x_case_no or '').strip()}"
        f"|case_year={(x_case_year or '').strip()}"
        f"|case_type={(x_case_type or '1').strip()}"
    )


def assert_workspace_access(ws: Workspace, request_user_id: str) -> None:
    if ws.user_id in (request_user_id, "legacy_user"):
        return
    logger.warning("Workspace access denied: workspace.user_id=%s request_user_id=%s", ws.user_id, request_user_id)
    raise HTTPException(status_code=403, detail="Not authorized to access this workspace")

# ----------------------------
# SAVE WORKSPACE ENDPOINT
# ----------------------------
@router.get("/list/{pdf_id}")
async def list_workspaces(pdf_id: int, db: Session = Depends(get_db), x_user_id: Optional[str] = Header(None)):
    cache_key = key_workspace_list(x_user_id, pdf_id)
    cached = cache_get(cache_key)
    if cached is not None:
        return cached

    workspaces = WorkspaceRepo.get_by_pdf(db, pdf_id, user_id=x_user_id)
    serialized = [
        {
            "id": ws.id,
            "pdf_id": ws.pdf_id,
            "user_id": ws.user_id,
            "case_no": ws.case_no,
            "case_year": ws.case_year,
            "case_type": ws.case_type,
            "name": ws.name,
            "created_at": ws.created_at.isoformat() if ws.created_at else None,
            "updated_at": ws.updated_at.isoformat() if ws.updated_at else None,
            "cross_pdf_links_json": ws.cross_pdf_links_json,
        }
        for ws in workspaces
    ]
    cache_set(cache_key, serialized)
    return workspaces
# ➕ Naya workspace create karne ke liye
@router.post("/create/{pdf_id}")
async def create_workspace(
    pdf_id: int,
    name: str,
    db: Session = Depends(get_db),
    x_user_id: Optional[str] = Header(None),
    x_case_no: Optional[str] = Header(None),
    x_case_year: Optional[str] = Header(None),
    x_case_type: Optional[str] = Header(None),
):
    case_context = build_case_context(x_case_no, x_case_year, x_case_type)
    request_user_id = resolve_request_user_id(x_user_id, x_case_no, x_case_year, x_case_type)
    normalized_pdf_id = None if pdf_id <= 0 and any(case_context.values()) else pdf_id
    workspace = WorkspaceRepo.create(db, normalized_pdf_id, name, user_id=request_user_id, case_context=case_context)
    if normalized_pdf_id is not None:
        cache_delete(key_workspace_list(request_user_id, normalized_pdf_id))
    return workspace

@router.post("/save/{pdf_id}/{workspace_id}")
async def save_workspace(
    pdf_id: int,
    workspace_id: int,
    request: Request,
    db: Session = Depends(get_db),
    x_user_id: Optional[str] = Header(None),
    x_case_no: Optional[str] = Header(None),
    x_case_year: Optional[str] = Header(None),
    x_case_type: Optional[str] = Header(None),
):
    logger.debug(f"save_workspace: pdf_id={pdf_id}, workspace_id={workspace_id}, user={x_user_id}")
    case_context = build_case_context(x_case_no, x_case_year, x_case_type)
    request_user_id = resolve_request_user_id(x_user_id, x_case_no, x_case_year, x_case_type)
    # Verify workspace belongs to user
    ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")

    assert_workspace_access(ws, request_user_id)
    if ws.user_id == 'legacy_user':
        logger.info(f"User {request_user_id} accessing legacy workspace {workspace_id}")
    apply_case_context_to_model(ws, case_context)

    form = await request.form()
    
    # 1. PARSE FORM-DATA INTO OBJECTS
    snippets_raw = {}
    boxes_raw = {}
    lines_raw = {}
    connections_raw = {}
    groups_raw = {}

    cross_pdf_links_json = "[]"

    for key, value in form.items():
        if key == "cross_pdf_links":
            cross_pdf_links_json = value
        elif key.startswith("snippets"):
            idx, field = extract_index_and_key(key)
            snippets_raw.setdefault(idx, {})[field] = value
        elif key.startswith("boxes"):
            idx, field = extract_index_and_key(key)
            boxes_raw.setdefault(idx, {})[field] = value
        elif key.startswith("lines"):
            idx, field = extract_index_and_key(key)
            lines_raw.setdefault(idx, {})[field] = value
        elif key.startswith("connections"):
            idx, field = extract_index_and_key(key)
            connections_raw.setdefault(idx, {})[field] = value
        elif key.startswith("groups"):
            idx, field = extract_index_and_key(key)
            groups_raw.setdefault(idx, {})[field] = value

    for key, val in form.items():
        if isinstance(val, UploadFile):
            idx, _ = extract_index_and_key(key)
            snippets_raw.setdefault(idx, {})["file"] = val

    # 2. ID TRACKING & MAPPING
    id_map = {}
    touched_snippet_ids = []
    touched_box_ids = []
    touched_line_ids = []
    touched_connection_ids = []

    # 3. UPSERT SNIPPETS
    for s_dict in snippets_raw.values():
        frontend_id = s_dict.get("id")
        # Use snippet's own source_pdf_id if provided (multi-PDF workspace), else fall back to URL pdf_id
        s_dict["pdf_id"] = safe_int(s_dict.get("source_pdf_id") or s_dict.get("pdf_id")) or pdf_id
        s_dict["workspace_id"] = workspace_id
        s_type = s_dict.get("type")
        
        update_data = {
            "type": s_type,
            "x": safe_float(s_dict.get("x")),
            "y": safe_float(s_dict.get("y")),
            "width": safe_float(s_dict.get("width")),
            "height": safe_float(s_dict.get("height")),
            "page": safe_int(s_dict.get("page")),
            "content": s_dict.get("content", "image" if s_type == "image" else ""),
            "x_pct": safe_float(s_dict.get("xPct")),
            "y_pct": safe_float(s_dict.get("yPct")),
            "width_pct": safe_float(s_dict.get("widthPct")),
            "height_pct": safe_float(s_dict.get("heightPct"))
        }

        file_obj: Optional[UploadFile] = s_dict.get("file")
        db_id = safe_int(frontend_id)
        
        # Read file binary once if it exists
        file_binary = None
        if file_obj:
            file_binary = await file_obj.read()

        if db_id > 0:
            # TRY UPDATE
            existing = SnippetRepo.update(db, db_id, update_data, user_id=request_user_id, file_binary=file_binary, case_context=case_context)
            if existing:
                s_id = get_obj_id(existing)
                touched_snippet_ids.append(s_id)
                id_map[str(frontend_id)] = s_id
                continue

        # CREATE
        req = SnippetCreate(
            pdf_id=pdf_id,
            workspace_id=workspace_id,
            type=update_data["type"],
            x=update_data["x"],
            y=update_data["y"],
            width=update_data["width"],
            height=update_data["height"],
            page=update_data["page"],
            content=update_data["content"],
            x_pct=update_data["x_pct"],
            y_pct=update_data["y_pct"],
            width_pct=update_data["width_pct"],
            height_pct=update_data["height_pct"]
        )
        new_snippet = SnippetRepo.create(
            db, pdf_id, workspace_id, req, 
            user_id=request_user_id, 
            file_binary=file_binary,
            case_context=case_context,
        )
        new_id = get_obj_id(new_snippet)
        touched_snippet_ids.append(new_id)
        if frontend_id: id_map[str(frontend_id)] = new_id

    # 4. UPSERT BOXES
    for b_dict in boxes_raw.values():
        frontend_id = b_dict.get("id")
        b_dict["pdf_id"] = pdf_id
        b_dict["workspace_id"] = workspace_id
        db_id = safe_int(frontend_id)

        if db_id > 0:
            existing = BoxRepo.update(db, db_id, BoxUpdate(**b_dict), user_id=request_user_id, case_context=case_context)
            if existing:
                b_id = get_obj_id(existing)
                touched_box_ids.append(b_id)
                id_map[str(frontend_id)] = b_id
                continue

        new_box = BoxRepo.create(db, pdf_id, workspace_id, BoxCreate(**b_dict), user_id=request_user_id, case_context=case_context)
        nb_id = get_obj_id(new_box)
        touched_box_ids.append(nb_id)
        if frontend_id: id_map[str(frontend_id)] = nb_id

    # 5. UPSERT LINES
    for l_dict in lines_raw.values():
        frontend_id = l_dict.get("id")
        l_dict["pdf_id"] = pdf_id
        l_dict["workspace_id"] = workspace_id
        if "points" in l_dict:
            try:
                l_dict["points"] = json.loads(l_dict["points"])
            except:
                continue
        l_dict["stroke_width"] = safe_float(l_dict.get("stroke_width", 2.0))
        db_id = safe_int(frontend_id)

        if db_id > 0:
            existing = LineRepo.update(db, db_id, LineUpdate(**l_dict), user_id=request_user_id, case_context=case_context)
            if existing:
                new_id = get_obj_id(existing)
                touched_line_ids.append(new_id)
                if frontend_id: id_map[str(frontend_id)] = new_id
                continue
                
        new_line = LineRepo.create(db, pdf_id, workspace_id, LineCreate(**l_dict), user_id=request_user_id, case_context=case_context)
        new_id = get_obj_id(new_line)
        touched_line_ids.append(new_id)
        if frontend_id: id_map[str(frontend_id)] = new_id

    # 6. UPSERT CONNECTIONS
    for c_dict in connections_raw.values():
        frontend_id = c_dict.get("id")
        c_dict["pdf_id"] = pdf_id
        c_dict["workspace_id"] = workspace_id
        f_src, f_tgt = str(c_dict.get("source_id")), str(c_dict.get("target_id"))
        src_id = resolve_connection_endpoint_id(f_src, id_map)
        tgt_id = resolve_connection_endpoint_id(f_tgt, id_map)

        if src_id > 0 and tgt_id > 0:
            c_dict["source_id"], c_dict["target_id"] = src_id, tgt_id
            db_id = safe_int(frontend_id)
            if db_id > 0:
                existing = ConnectionRepo.update(db, db_id, ConnectionUpdate(**c_dict), user_id=request_user_id, case_context=case_context)
                if existing:
                    conn_id = get_obj_id(existing)
                    touched_connection_ids.append(conn_id)
                    if frontend_id: id_map[str(frontend_id)] = conn_id
                    continue
            
            new_conn = ConnectionRepo.create(db, pdf_id, workspace_id, ConnectionCreate(**c_dict), user_id=request_user_id, case_context=case_context)
            nc_id = get_obj_id(new_conn)
            touched_connection_ids.append(nc_id)
            if frontend_id: id_map[str(frontend_id)] = nc_id
        else:
            logger.warning(
                "Skipping unresolved connection save: frontend_id=%s source_id=%s target_id=%s workspace_id=%s",
                frontend_id,
                f_src,
                f_tgt,
                workspace_id,
            )

    # 7. DELETE ORPHANS
    db.query(Snippet).filter(Snippet.workspace_id == workspace_id, Snippet.user_id == request_user_id, ~Snippet.id.in_(touched_snippet_ids)).delete(synchronize_session=False)
    db.query(Box).filter(Box.workspace_id == workspace_id, Box.user_id == request_user_id, ~Box.id.in_(touched_box_ids)).delete(synchronize_session=False)
    db.query(Line).filter(Line.workspace_id == workspace_id, Line.user_id == request_user_id, ~Line.id.in_(touched_line_ids)).delete(synchronize_session=False)
    db.query(Connection).filter(Connection.workspace_id == workspace_id, Connection.user_id == request_user_id, ~Connection.id.in_(touched_connection_ids)).delete(synchronize_session=False)

    # 8. UPSERT GROUPS
    touched_group_client_ids = []
    for g_dict in groups_raw.values():
        client_id = g_dict.get("client_id", "")
        if not client_id:
            continue
        touched_group_client_ids.append(client_id)
        item_ids_raw = g_dict.get("item_ids", "[]")
        try:
            item_ids = json.loads(item_ids_raw) if isinstance(item_ids_raw, str) else item_ids_raw
        except Exception:
            item_ids = []
        existing_group = db.query(WorkspaceGroup).filter(
            WorkspaceGroup.workspace_id == workspace_id,
            WorkspaceGroup.client_id == client_id
        ).first()
        if existing_group:
            existing_group.name = g_dict.get("name", existing_group.name)
            existing_group.color = g_dict.get("color", existing_group.color)
            existing_group.item_ids = item_ids
            existing_group.collapsed = g_dict.get("collapsed", "false").lower() == "true"
        else:
            new_group = WorkspaceGroup(
                workspace_id=workspace_id,
                client_id=client_id,
                name=g_dict.get("name", ""),
                color=g_dict.get("color", "#e0e7ff"),
                item_ids=item_ids,
                collapsed=g_dict.get("collapsed", "false").lower() == "true",
            )
            db.add(new_group)
    # Delete groups that were removed
    if touched_group_client_ids:
        db.query(WorkspaceGroup).filter(
            WorkspaceGroup.workspace_id == workspace_id,
            ~WorkspaceGroup.client_id.in_(touched_group_client_ids)
        ).delete(synchronize_session=False)
    else:
        # No groups sent → clear all groups for this workspace
        db.query(WorkspaceGroup).filter(WorkspaceGroup.workspace_id == workspace_id).delete(synchronize_session=False)

    # Save cross-PDF links JSON with remapped snippet/box endpoint IDs.
    try:
        raw_cross_links = json.loads(cross_pdf_links_json or "[]")
    except Exception:
        raw_cross_links = []

    def remap_cross_link_endpoint(endpoint):
        if not isinstance(endpoint, dict):
            return endpoint
        if endpoint.get("type") != "snippet":
            return endpoint
        mapped_id = id_map.get(str(endpoint.get("snippetId")))
        if mapped_id is None:
            return endpoint
        return {**endpoint, "snippetId": mapped_id}

    normalized_cross_links = []
    for link in raw_cross_links if isinstance(raw_cross_links, list) else []:
        if not isinstance(link, dict):
            continue
        normalized_cross_links.append({
            **link,
            "from": remap_cross_link_endpoint(link.get("from")),
            "to": remap_cross_link_endpoint(link.get("to")),
        })

    ws.cross_pdf_links_json = json.dumps(normalized_cross_links)

    db.commit()
    logger.info(f"Workspace {workspace_id} saved for user {request_user_id}")
    # Invalidate caches for this workspace
    cache_delete(key_cross_pdf_links(workspace_id))
    cache_delete(key_workspace_groups(workspace_id))

    return {"message": "Workspace saved successfully", "id_map": id_map}


@router.get("/cross_pdf_links/{workspace_id}")
def get_cross_pdf_links(workspace_id: int, db: Session = Depends(get_db), x_user_id: Optional[str] = Header(None)):
    cache_key = key_cross_pdf_links(workspace_id)
    cached = cache_get(cache_key)
    if cached is not None:
        return cached

    ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not ws:
        return []
    if x_user_id and ws.user_id != x_user_id and ws.user_id != 'legacy_user':
        raise HTTPException(status_code=403, detail="Not authorized to access this workspace")
    raw = ws.cross_pdf_links_json or "[]"
    try:
        result = json.loads(raw)
        cache_set(cache_key, result)
        return result
    except Exception:
        return []


@router.get("/case")
def get_or_create_case_workspace(
    db: Session = Depends(get_db),
    x_user_id: Optional[str] = Header(None),
    x_case_no: Optional[str] = Header(None),
    x_case_year: Optional[str] = Header(None),
    x_case_type: Optional[str] = Header(None),
):
    """Get or create the single shared workspace for a diary case."""
    case_no = (x_case_no or "").strip() or None
    case_year = (x_case_year or "").strip() or None
    case_type = (x_case_type or "").strip() or "1"
    user_id = x_user_id or f"case_no={case_no}|case_year={case_year}|case_type={case_type}"
    ws = WorkspaceRepo.get_or_create_for_case(db, case_no, case_year, case_type, user_id)
    return {
        "id": ws.id,
        "name": ws.name,
        "pdf_id": ws.pdf_id,
        "user_id": ws.user_id,
        "case_no": ws.case_no,
        "case_year": ws.case_year,
        "case_type": ws.case_type,
        "cross_pdf_links_json": ws.cross_pdf_links_json,
        "created_at": ws.created_at,
        "updated_at": ws.updated_at,
    }


@router.get("/{workspace_id}/pdfs")
def list_workspace_pdfs(
    workspace_id: int,
    db: Session = Depends(get_db),
    x_user_id: Optional[str] = Header(None),
    x_case_no: Optional[str] = Header(None),
    x_case_year: Optional[str] = Header(None),
    x_case_type: Optional[str] = Header(None),
):
    """List all PDFs registered with a workspace."""
    from src.models.workspace_pdf_model import WorkspacePdf
    request_user_id = resolve_request_user_id(x_user_id, x_case_no, x_case_year, x_case_type)
    ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")
    assert_workspace_access(ws, request_user_id)
    items = db.query(WorkspacePdf).filter(WorkspacePdf.workspace_id == workspace_id).all()
    return [
        {
            "id": item.id,
            "workspace_id": item.workspace_id,
            "pdf_id": item.pdf_id,
            "pdf_name": item.pdf_name,
            "pdf_url": item.pdf_url,
            "is_active": item.is_active,
            "created_at": item.created_at,
        }
        for item in items
    ]


@router.post("/{workspace_id}/pdfs")
def add_pdf_to_workspace(
    workspace_id: int,
    pdf_id: int,
    pdf_name: Optional[str] = None,
    pdf_url: Optional[str] = None,
    db: Session = Depends(get_db),
    x_user_id: Optional[str] = Header(None),
    x_case_no: Optional[str] = Header(None),
    x_case_year: Optional[str] = Header(None),
    x_case_type: Optional[str] = Header(None),
):
    """Register a PDF with a workspace (upsert)."""
    from src.models.workspace_pdf_model import WorkspacePdf
    request_user_id = resolve_request_user_id(x_user_id, x_case_no, x_case_year, x_case_type)
    ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")
    assert_workspace_access(ws, request_user_id)
    existing = db.query(WorkspacePdf).filter(
        WorkspacePdf.workspace_id == workspace_id,
        WorkspacePdf.pdf_id == pdf_id,
    ).first()
    if existing:
        if pdf_name is not None:
            existing.pdf_name = pdf_name
        if pdf_url is not None:
            existing.pdf_url = pdf_url
        existing.is_active = True
        db.commit()
        db.refresh(existing)
        return {"id": existing.id, "workspace_id": existing.workspace_id, "pdf_id": existing.pdf_id, "pdf_name": existing.pdf_name, "pdf_url": existing.pdf_url, "is_active": existing.is_active}
    item = WorkspacePdf(workspace_id=workspace_id, pdf_id=pdf_id, pdf_name=pdf_name, pdf_url=pdf_url, is_active=True)
    db.add(item)
    db.commit()
    db.refresh(item)
    return {"id": item.id, "workspace_id": item.workspace_id, "pdf_id": item.pdf_id, "pdf_name": item.pdf_name, "pdf_url": item.pdf_url, "is_active": item.is_active}


@router.delete("/{workspace_id}/pdfs/{pdf_id}/close")
def close_pdf_in_workspace(
    workspace_id: int,
    pdf_id: int,
    db: Session = Depends(get_db),
    x_user_id: Optional[str] = Header(None),
    x_case_no: Optional[str] = Header(None),
    x_case_year: Optional[str] = Header(None),
    x_case_type: Optional[str] = Header(None),
):
    """Mark a PDF as closed (inactive) in a workspace."""
    from src.models.workspace_pdf_model import WorkspacePdf
    request_user_id = resolve_request_user_id(x_user_id, x_case_no, x_case_year, x_case_type)
    ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")
    assert_workspace_access(ws, request_user_id)
    
    existing = db.query(WorkspacePdf).filter(
        WorkspacePdf.workspace_id == workspace_id,
        WorkspacePdf.pdf_id == pdf_id,
    ).first()
    
    if existing:
        existing.is_active = False
        db.commit()
        return {"success": True}
    return {"success": False, "message": "PDF not found in workspace"}


@router.get("/groups/{workspace_id}")
def get_workspace_groups(workspace_id: int, db: Session = Depends(get_db)):
    cache_key = key_workspace_groups(workspace_id)
    cached = cache_get(cache_key)
    if cached is not None:
        return cached

    groups = db.query(WorkspaceGroup).filter(WorkspaceGroup.workspace_id == workspace_id).all()
    result = [
        {
            "id": g.id,
            "client_id": g.client_id,
            "name": g.name,
            "color": g.color,
            "item_ids": g.item_ids,
            "collapsed": g.collapsed,
        }
        for g in groups
    ]
    cache_set(cache_key, result)
    return result
