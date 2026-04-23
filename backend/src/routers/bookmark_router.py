from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from src.db.db import get_db
from src.repo.bookmark_repo import BookmarkRepo
from src.request.bookmark_request import BookmarkCreate, BookmarkOut
from src.models.bookmark_model import Bookmark
from src.utils.case_context import build_case_context

class BookmarkRename(BaseModel):
    name: str

router = APIRouter(prefix="/bookmarks", tags=["bookmarks"])


@router.get("/pdf/{pdf_id}", response_model=List[BookmarkOut])
def list_bookmarks(pdf_id: int, db: Session = Depends(get_db), x_user_id: Optional[str] = Header(None)):
    user_id = x_user_id or "user123"
    return BookmarkRepo.get_by_pdf(db, pdf_id, user_id)


@router.post("/pdf/{pdf_id}", response_model=BookmarkOut)
def create_bookmark(
    pdf_id: int,
    req: BookmarkCreate,
    db: Session = Depends(get_db),
    x_user_id: Optional[str] = Header(None),
    x_case_no: Optional[str] = Header(None),
    x_case_year: Optional[str] = Header(None),
    x_case_type: Optional[str] = Header(None),
):
    user_id = x_user_id or "user123"
    case_context = build_case_context(x_case_no, x_case_year, x_case_type)
    return BookmarkRepo.create(db, pdf_id, user_id, req.page_num, req.name or "", case_context=case_context)


@router.patch("/{bookmark_id}", response_model=BookmarkOut)
def rename_bookmark(bookmark_id: int, req: BookmarkRename, db: Session = Depends(get_db), x_user_id: Optional[str] = Header(None)):
    user_id = x_user_id or "user123"
    bm = db.query(Bookmark).filter(Bookmark.id == bookmark_id, Bookmark.user_id == user_id).first()
    if not bm:
        raise HTTPException(status_code=404, detail="Bookmark not found")
    bm.name = req.name
    db.commit()
    db.refresh(bm)
    return bm


@router.delete("/{bookmark_id}")
def delete_bookmark(bookmark_id: int, db: Session = Depends(get_db), x_user_id: Optional[str] = Header(None)):
    user_id = x_user_id or "user123"
    bm = BookmarkRepo.delete(db, bookmark_id, user_id)
    if not bm:
        raise HTTPException(status_code=404, detail="Bookmark not found")
    return {"ok": True}
