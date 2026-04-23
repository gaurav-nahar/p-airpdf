from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import List, Optional

from src.cache.cache import cache_get, cache_set, cache_delete_pattern, key_pdf_drawing_lines
from src.db.db import get_db
from src.request.pdf_drawing_line_request import PdfDrawingLineCreate, PdfDrawingLineResponse
from src.repo.pdf_drawing_line_repo import PdfLineRepo

router = APIRouter()

@router.post("/", response_model=PdfDrawingLineResponse)
def create_pdf_line(data: PdfDrawingLineCreate, db: Session = Depends(get_db), x_user_id: str = Header(...)):
    result = PdfLineRepo.create(db, data.pdf_id, data, user_id=x_user_id)
    cache_delete_pattern(key_pdf_drawing_lines(x_user_id, data.pdf_id))
    return result

@router.get("/pdf/{pdf_id}", response_model=List[PdfDrawingLineResponse])
def get_pdf_lines(pdf_id: int, db: Session = Depends(get_db), x_user_id: str = Header(...)):
    cache_key = key_pdf_drawing_lines(x_user_id, pdf_id)
    cached = cache_get(cache_key)
    if cached is not None:
        return cached
    result = PdfLineRepo.get_by_pdf(db, pdf_id, user_id=x_user_id)
    serialized = [PdfDrawingLineResponse.model_validate(item).model_dump() for item in result]
    cache_set(cache_key, serialized)
    return result

@router.delete("/{line_id}")
def delete_pdf_line(line_id: int, db: Session = Depends(get_db), x_user_id: str = Header(...)):
    if not PdfLineRepo.delete(db, line_id, user_id=x_user_id):
        raise HTTPException(status_code=404, detail="PDF Line not found or unauthorized")
    cache_delete_pattern(f"pdf_drawing_lines:{x_user_id}:*")
    return {"ok": True}

@router.delete("/bulk/pdf/{pdf_id}")
def delete_all_pdf_lines(pdf_id: int, db: Session = Depends(get_db), x_user_id: str = Header(...)):
    PdfLineRepo.sync_lines(db, pdf_id, [], user_id=x_user_id) # Effectively deletes all
    cache_delete_pattern(key_pdf_drawing_lines(x_user_id, pdf_id))
    return {"ok": True}

@router.post("/sync/pdf/{pdf_id}", response_model=List[PdfDrawingLineResponse])
def sync_pdf_lines(pdf_id: int, items: List[dict], db: Session = Depends(get_db), x_user_id: str = Header(...)):
    result = PdfLineRepo.sync_lines(db, pdf_id, items, user_id=x_user_id)
    cache_delete_pattern(key_pdf_drawing_lines(x_user_id, pdf_id))
    return result

@router.get("/health")
def health_check():
    return {"status": "ok", "msg": "PDF Drawing Lines Router is operational"}
