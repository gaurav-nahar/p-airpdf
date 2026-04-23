from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import Optional

from src.db.db import get_db
from src.repo.connection_repo import ConnectionRepo
from src.request.connection_request import (
    ConnectionCreate,
    ConnectionUpdate,
    ConnectionOut
)

router = APIRouter()


# Create connection
@router.post("/", response_model=ConnectionOut)
def add_connection(req: ConnectionCreate, db: Session = Depends(get_db), x_user_id: str = Header(...)):
    return ConnectionRepo.create(db, req.pdf_id, req.workspace_id, req, user_id=x_user_id)


# Get all connections for a PDF
@router.get("/pdf/{pdf_id}/{workspace_id}", response_model=list[ConnectionOut])
def list_connections(pdf_id: int, workspace_id: int, db: Session = Depends(get_db), x_user_id: str = Header(...)):
    return ConnectionRepo.get_by_pdf(db, pdf_id, workspace_id, user_id=x_user_id)


# Get all connections by workspace only (multi-PDF)
@router.get("/workspace/{workspace_id}", response_model=list[ConnectionOut])
def list_connections_by_workspace(workspace_id: int, db: Session = Depends(get_db), x_user_id: str = Header(...)):
    return ConnectionRepo.get_by_workspace(db, workspace_id, user_id=x_user_id)


# Update connection
@router.put("/update/{conn_id}", response_model=ConnectionOut)
def edit_connection(conn_id: int, req: ConnectionUpdate, db: Session = Depends(get_db), x_user_id: str = Header(...)):
    updated = ConnectionRepo.update(db, conn_id, req, user_id=x_user_id)
    if not updated:
        raise HTTPException(status_code=404, detail="Connection not found")
    return updated


# Delete connection
@router.delete("/delete/{conn_id}")
def remove_connection(conn_id: int, db: Session = Depends(get_db), x_user_id: str = Header(...)):
    deleted = ConnectionRepo.delete(db, conn_id, user_id=x_user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Connection not found")
    return {"deleted": True}
