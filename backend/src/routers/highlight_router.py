from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from src.db.db import get_db
from src.request.highlight_request import HighlightCreate, HighlightOut
from src.repo.highlight_repo import HighlightRepo
from src.cache.cache import cache_get, cache_set, cache_delete_pattern, key_highlights
from typing import List, Optional

router = APIRouter()

@router.post("/", response_model=HighlightOut)
def save_highlight(req: HighlightCreate, db: Session = Depends(get_db), x_user_id: str = Header(...)):
    result = HighlightRepo.create(db, req, user_id=x_user_id)
    cache_delete_pattern(key_highlights(x_user_id, req.pdf_id))
    return result

@router.get("/pdf/{pdf_id}", response_model=List[HighlightOut])
def get_highlights(pdf_id: int, db: Session = Depends(get_db), x_user_id: str = Header(...)):
    cache_key = key_highlights(x_user_id, pdf_id)
    cached = cache_get(cache_key)
    if cached is not None:
        return cached
    result = HighlightRepo.get_by_pdf(db, pdf_id, user_id=x_user_id)
    serialized = [HighlightOut.model_validate(item).model_dump() for item in result]
    cache_set(cache_key, serialized)
    return result

@router.delete("/{hl_id}")
def delete_highlight(hl_id: int, db: Session = Depends(get_db), x_user_id: str = Header(...)):
    if not HighlightRepo.delete(db, hl_id, user_id=x_user_id):
        raise HTTPException(status_code=404, detail="Highlight not found or unauthorized")
    cache_delete_pattern(f"highlights:{x_user_id}:*")
    return {"ok": True}
