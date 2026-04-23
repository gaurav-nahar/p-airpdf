from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from src.db.db import get_db
from src.request.pdf_text_request import PdfTextCreate, PdfTextOut
from src.repo.pdf_text_repo import PdfTextRepo
from src.cache.cache import cache_get, cache_set, cache_delete_pattern, key_pdf_texts
from typing import List, Optional

router = APIRouter()

@router.post("/", response_model=PdfTextOut)
def save_pdf_text(req: PdfTextCreate, db: Session = Depends(get_db), x_user_id: str = Header(...)):
    result = PdfTextRepo.create(db, req, user_id=x_user_id)
    cache_delete_pattern(key_pdf_texts(x_user_id, req.pdf_id))
    return result

@router.get("/pdf/{pdf_id}", response_model=List[PdfTextOut])
def get_pdf_texts(pdf_id: int, db: Session = Depends(get_db), x_user_id: str = Header(...)):
    cache_key = key_pdf_texts(x_user_id, pdf_id)
    cached = cache_get(cache_key)
    if cached is not None:
        return cached
    result = PdfTextRepo.get_by_pdf(db, pdf_id, user_id=x_user_id)
    serialized = [PdfTextOut.model_validate(item).model_dump() for item in result]
    cache_set(cache_key, serialized)
    return result

@router.put("/{text_id}", response_model=PdfTextOut)
def update_pdf_text(text_id: int, req: PdfTextCreate, db: Session = Depends(get_db), x_user_id: str = Header(...)):
    res = PdfTextRepo.update(db, text_id, req, user_id=x_user_id)
    if not res:
        raise HTTPException(status_code=404, detail="Not found")
    cache_delete_pattern(key_pdf_texts(x_user_id, req.pdf_id))
    return res

@router.delete("/{text_id}")
def delete_pdf_text(text_id: int, db: Session = Depends(get_db), x_user_id: str = Header(...)):
    if not PdfTextRepo.delete(db, text_id, user_id=x_user_id):
        raise HTTPException(status_code=404, detail="Annotation not found or unauthorized")
    cache_delete_pattern(f"pdf_texts:{x_user_id}:*")
    return {"ok": True}
