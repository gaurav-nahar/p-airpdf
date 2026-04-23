from pydantic import BaseModel, validator
from typing import Optional, List, Union
from datetime import datetime
import json

class PdfDrawingLineBase(BaseModel):
    pdf_id: int
    page_num: int
    points: Union[str, List[float]]
    color: Optional[str] = "black"
    stroke_width: Optional[float] = 2.0

class PdfDrawingLineCreate(PdfDrawingLineBase):
    pass

class PdfDrawingLineResponse(PdfDrawingLineBase):
    id: int
    created_at: datetime
    class Config:
        from_attributes = True