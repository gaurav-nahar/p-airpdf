from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class BookmarkCreate(BaseModel):
    page_num: int
    name: Optional[str] = ""


class BookmarkOut(BaseModel):
    id: int
    pdf_id: int
    user_id: str
    page_num: int
    name: str
    created_at: datetime

    class Config:
        from_attributes = True
