from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class DocPageCreate(BaseModel):
    id: str           # client-generated UUID
    title: str = "Untitled"
    content: Optional[str] = None
    sort_order: int = 0

    class Config:
        extra = "ignore"


class DocPageUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    sort_order: Optional[int] = None

    class Config:
        extra = "ignore"


class DocPageOut(BaseModel):
    id: str
    workspace_id: int
    title: str
    content: Optional[str]
    sort_order: int
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        orm_mode = True
