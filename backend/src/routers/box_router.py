from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import List, Optional

from src.db.db import get_db
from src.repo.box_repo import BoxRepo
from src.request.box_request import BoxCreate, BoxUpdate, BoxResponse

router = APIRouter()


# Create a new box
@router.post("/", response_model=BoxResponse)
def create_box(data: BoxCreate, db: Session = Depends(get_db), x_user_id: str = Header(...)) -> BoxResponse:
    return BoxRepo.create(db, data.pdf_id, data.workspace_id, data, user_id=x_user_id)


# Get all boxes for a specific PDF
@router.get("/pdf/{pdf_id}/{workspace_id}", response_model=List[BoxResponse])
def get_boxes(pdf_id: int, workspace_id: int, db: Session = Depends(get_db), x_user_id: str = Header(...)) -> List[BoxResponse]:
    return BoxRepo.get_by_pdf(db, pdf_id, workspace_id, user_id=x_user_id)


# Get all boxes by workspace only (multi-PDF)
@router.get("/workspace/{workspace_id}", response_model=List[BoxResponse])
def get_boxes_by_workspace(workspace_id: int, db: Session = Depends(get_db), x_user_id: str = Header(...)) -> List[BoxResponse]:
    return BoxRepo.get_by_workspace(db, workspace_id, user_id=x_user_id)


# Update a box
@router.put("/update/{box_id}", response_model=BoxResponse)
def update_box(box_id: int, req: BoxUpdate, db: Session = Depends(get_db), x_user_id: str = Header(...)) -> BoxResponse:
    box = BoxRepo.update(db, box_id, req, user_id=x_user_id)
    if not box:
        raise HTTPException(404, "Box not found")
    return box


# Delete a box
@router.delete("/delete/{box_id}")
def delete_box(box_id: int, db: Session = Depends(get_db), x_user_id: str = Header(...)) -> dict:
    ok = BoxRepo.delete(db, box_id, user_id=x_user_id)
    if not ok:
        raise HTTPException(404, "Box not found")
    return {"message": "Deleted"}
