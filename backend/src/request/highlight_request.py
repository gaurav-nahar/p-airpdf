from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class HighlightCreate(BaseModel):
    pdf_id: int
    page_num: int
    color: str
    x_pct: float
    y_pct: float
    width_pct: float
    height_pct: float
    content: Optional[str] = None # 📝 Trimmed text contents

class HighlightOut(HighlightCreate):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True