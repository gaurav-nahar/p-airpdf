from pydantic import BaseModel
from typing import Optional


class ConnectionCreate(BaseModel):
    pdf_id: int
    workspace_id: int
    source_id: int
    target_id: int
    meta: Optional[str] = None

    class Config:
        extra = "ignore"


class ConnectionUpdate(BaseModel):
    source_id: Optional[int] = None
    target_id: Optional[int] = None
    meta: Optional[str] = None

    class Config:
        extra = "ignore"


class ConnectionOut(BaseModel):
    id: int
    pdf_id: int
    workspace_id: int
    source_id: int
    target_id: int
    meta: Optional[str]

    class Config:
        orm_mode = True
