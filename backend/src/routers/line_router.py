from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import List, Optional

from src.db.db import get_db
from src.request.line_request import LineCreate, LineUpdate, LineResponse
from src.repo.line_repo import LineRepo

router = APIRouter()

@router.post("/", response_model=LineResponse)
def create_line(data: LineCreate, db: Session = Depends(get_db), x_user_id: str = Header(...)) -> LineResponse:
    return LineRepo.create(db, data.pdf_id, data.workspace_id, data, user_id=x_user_id)

@router.get("/pdf/{pdf_id}/{workspace_id}", response_model=List[LineResponse])
def get_lines(pdf_id: int, workspace_id: int, db: Session = Depends(get_db), x_user_id: str = Header(...)) -> List[LineResponse]:
    try:
        return LineRepo.get_by_pdf(db, pdf_id, workspace_id, user_id=x_user_id)
    except Exception as e:
        import traceback
        print(f"Error fetching lines for pdf_id={pdf_id}: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/workspace/{workspace_id}", response_model=List[LineResponse])
def get_lines_by_workspace(workspace_id: int, db: Session = Depends(get_db), x_user_id: str = Header(...)) -> List[LineResponse]:
    return LineRepo.get_by_workspace(db, workspace_id, user_id=x_user_id)


@router.put("/update/{line_id}", response_model=LineResponse)
def update_line(line_id: int, data: LineUpdate, db: Session = Depends(get_db), x_user_id: str = Header(...)) -> LineResponse:
    updated = LineRepo.update(db, line_id, data, user_id=x_user_id)
    if not updated:
        raise HTTPException(status_code=404, detail="Line not found")
    return updated

@router.delete("/delete/{line_id}")
def delete_line(line_id: int, db: Session = Depends(get_db), x_user_id: str = Header(...)) -> dict:
    """
    Delete a Line by ID.
    """
    ok = LineRepo.delete(db, line_id, user_id=x_user_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Line not found")
    return {"deleted": True}
