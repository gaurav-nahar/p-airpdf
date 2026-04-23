from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import List

from src.db.db import get_db
from src.repo.documentation_repo import DocumentationRepo
from src.request.documentation_request import DocPageCreate, DocPageUpdate, DocPageOut

router = APIRouter()


# ---------------------------------------------------------
# GET ALL PAGES FOR A WORKSPACE
# ---------------------------------------------------------
@router.get("/workspace/{workspace_id}", response_model=List[DocPageOut])
def get_pages(workspace_id: int, db: Session = Depends(get_db), x_user_id: str = Header(...)):
    return DocumentationRepo.get_by_workspace(db, workspace_id, user_id=x_user_id)


# ---------------------------------------------------------
# CREATE A PAGE
# ---------------------------------------------------------
@router.post("/workspace/{workspace_id}", response_model=DocPageOut)
def create_page(workspace_id: int, req: DocPageCreate, db: Session = Depends(get_db), x_user_id: str = Header(...)):
    return DocumentationRepo.create(db, workspace_id, user_id=x_user_id, req=req)


# ---------------------------------------------------------
# UPDATE A PAGE (title, content, sort_order)
# ---------------------------------------------------------
@router.put("/{doc_id}", response_model=DocPageOut)
def update_page(doc_id: str, req: DocPageUpdate, db: Session = Depends(get_db), x_user_id: str = Header(...)):
    page = DocumentationRepo.update(db, doc_id, user_id=x_user_id, req=req)
    if not page:
        raise HTTPException(status_code=404, detail="Page not found or unauthorized")
    return page


# ---------------------------------------------------------
# DELETE A PAGE
# ---------------------------------------------------------
@router.delete("/{doc_id}")
def delete_page(doc_id: str, db: Session = Depends(get_db), x_user_id: str = Header(...)):
    ok = DocumentationRepo.delete(db, doc_id, user_id=x_user_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Page not found or unauthorized")
    return {"message": "Deleted successfully"}
