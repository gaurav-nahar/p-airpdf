from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, Header
from sqlalchemy.orm import Session
from typing import List, Optional
import base64
import math

from src.db.db import get_db
from src.repo.snippet_repo import SnippetRepo
from src.request.snippet_request import SnippetCreate, SnippetUpdate, SnippetOut

router = APIRouter()

# ------------------ HELPER FUNCTIONS ------------------
def parse_float(value, default=0.0):
    try:
        if value is None or value == "":
            return default
        val = float(value)
        if math.isnan(val) or math.isinf(val):
            return default
        return val
    except (ValueError, TypeError):
        return default

def parse_int(value, default=0):
    try:
        if value is None or value == "":
            return default
        return int(value)
    except (ValueError, TypeError):
        return default

# ---------------------------------------------------------
# CREATE SNIPPET (TEXT OR IMAGE BINARY)
# ---------------------------------------------------------
@router.post("/", response_model=SnippetOut)
async def create_snippet(
    pdfId: int = Form(...),
    workspaceId: int = Form(...),
    type: str = Form(...),
    x: float = Form(...),
    y: float = Form(...),
    width: Optional[float] = Form(None),
    height: Optional[float] = Form(None),
    page: Optional[int] = Form(None),
    content: Optional[str] = Form(None),
    xPct: Optional[float] = Form(None),
    yPct: Optional[float] = Form(None),
    widthPct: Optional[float] = Form(None),
    heightPct: Optional[float] = Form(None),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    x_user_id: str = Header(...)
):
    req = SnippetCreate(
        pdf_id=pdfId,
        workspace_id=workspaceId,
        type=type,
        x=parse_float(x),
        y=parse_float(y),
        width=parse_float(width),
        height=parse_float(height),
        page=parse_int(page),
        content=content,
        x_pct=parse_float(xPct),
        y_pct=parse_float(yPct),
        width_pct=parse_float(widthPct),
        height_pct=parse_float(heightPct)
    )
    
    file_bytes = None
    if type == "image" and file:
        file_bytes = await file.read()
    
    snippet = SnippetRepo.create(db, pdfId, workspaceId, req, user_id=x_user_id, file_binary=file_bytes)
    
    # Prepare response content
    resp_content = snippet.content
    if snippet.type == "image" and snippet.file_data:
        resp_content = base64.b64encode(snippet.file_data).decode("utf-8")

    return SnippetOut(
        id=snippet.id,
        pdf_id=snippet.pdf_id,
        workspace_id=snippet.workspace_id,
        content=resp_content,
        type=snippet.type,
        x=snippet.x,
        y=snippet.y,
        page=snippet.page,
        width=snippet.width,
        height=snippet.height,
        x_pct=snippet.x_pct,
        y_pct=snippet.y_pct,
        width_pct=snippet.width_pct,
        height_pct=snippet.height_pct,
        created_at=snippet.created_at,
        updated_at=snippet.updated_at
    )

# ---------------------------------------------------------
# GET SNIPPETS BY PDF ID & WORKSPACE ID
# ---------------------------------------------------------
@router.get("/pdf/{pdf_id}/{workspace_id}", response_model=List[SnippetOut])
def get_snippets(pdf_id: int, workspace_id: int, db: Session = Depends(get_db), x_user_id: str = Header(...)):
    snippets = SnippetRepo.get_by_pdf(db, pdf_id, workspace_id, user_id=x_user_id)
    result = []
    for s in snippets:
        resp_content = s.content
        if s.type == "image" and s.file_data:
            resp_content = base64.b64encode(s.file_data).decode("utf-8")
            
        result.append(SnippetOut(
            id=s.id,
            pdf_id=s.pdf_id,
            workspace_id=s.workspace_id,
            content=resp_content,
            type=s.type,
            x=s.x,
            y=s.y,
            page=s.page,
            width=s.width,
            height=s.height,
            x_pct=s.x_pct,
            y_pct=s.y_pct,
            width_pct=s.width_pct,
            height_pct=s.height_pct,
            created_at=s.created_at,
            updated_at=s.updated_at
        ))
    return result

# ---------------------------------------------------------
# GET SNIPPETS BY WORKSPACE ID ONLY (multi-PDF workspaces)
# ---------------------------------------------------------
@router.get("/workspace/{workspace_id}", response_model=List[SnippetOut])
def get_snippets_by_workspace(workspace_id: int, db: Session = Depends(get_db), x_user_id: str = Header(...)):
    snippets = SnippetRepo.get_by_workspace(db, workspace_id, user_id=x_user_id)
    result = []
    for s in snippets:
        resp_content = s.content
        if s.type == "image" and s.file_data:
            resp_content = base64.b64encode(s.file_data).decode("utf-8")
        result.append(SnippetOut(
            id=s.id, pdf_id=s.pdf_id, workspace_id=s.workspace_id,
            content=resp_content, type=s.type,
            x=s.x, y=s.y, page=s.page, width=s.width, height=s.height,
            x_pct=s.x_pct, y_pct=s.y_pct, width_pct=s.width_pct, height_pct=s.height_pct,
            created_at=s.created_at, updated_at=s.updated_at
        ))
    return result

# ---------------------------------------------------------
# UPDATE SNIPPET
# ---------------------------------------------------------
@router.put("/update/{snippet_id}", response_model=SnippetOut)
async def update_snippet(
    snippet_id: int,
    type: str = Form(...),
    x: float = Form(...),
    y: float = Form(...),
    width: Optional[float] = Form(None),
    height: Optional[float] = Form(None),
    page: Optional[int] = Form(None),
    content: Optional[str] = Form(None),
    xPct: Optional[float] = Form(None),
    yPct: Optional[float] = Form(None),
    widthPct: Optional[float] = Form(None),
    heightPct: Optional[float] = Form(None),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    x_user_id: str = Header(...)
):
    update_data = {
        "type": type,
        "x": parse_float(x),
        "y": parse_float(y),
        "width": parse_float(width),
        "height": parse_float(height),
        "page": parse_int(page),
        "content": content,
        "x_pct": parse_float(xPct),
        "y_pct": parse_float(yPct),
        "width_pct": parse_float(widthPct),
        "height_pct": parse_float(heightPct)
    }
    
    file_bytes = None
    if file:
        file_bytes = await file.read()
        
    updated = SnippetRepo.update(db, snippet_id, update_data, user_id=x_user_id, file_binary=file_bytes)
    if not updated:
        raise HTTPException(status_code=404, detail="Snippet not found or unauthorized")
        
    resp_content = updated.content
    if updated.type == "image" and updated.file_data:
        resp_content = base64.b64encode(updated.file_data).decode("utf-8")
        
    return SnippetOut(
        id=updated.id,
        pdf_id=updated.pdf_id,
        workspace_id=updated.workspace_id,
        content=resp_content,
        type=updated.type,
        x=updated.x,
        y=updated.y,
        page=updated.page,
        width=updated.width,
        height=updated.height,
        x_pct=updated.x_pct,
        y_pct=updated.y_pct,
        width_pct=updated.width_pct,
        height_pct=updated.height_pct,
        created_at=updated.created_at,
        updated_at=updated.updated_at
    )

# ---------------------------------------------------------
# DELETE SNIPPET
# ---------------------------------------------------------
@router.delete("/delete/{snippet_id}")
def delete_snippet(snippet_id: int, db: Session = Depends(get_db), x_user_id: str = Header(...)):
    ok = SnippetRepo.delete(db, snippet_id, user_id=x_user_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Snippet not found or unauthorized")
    return {"message": "Deleted successfully"}