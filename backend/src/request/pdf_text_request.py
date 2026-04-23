from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class PdfTextCreate(BaseModel):
    pdf_id: int
    page_num: int
    text: str
    x_pct: float
    y_pct: float

class PdfTextOut(PdfTextCreate):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True