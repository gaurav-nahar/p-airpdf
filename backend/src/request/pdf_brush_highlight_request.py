from pydantic import BaseModel
from typing import List, Optional

class PathPoint(BaseModel):
    xPct: float
    yPct: float

class BrushHighlightCreate(BaseModel):
    page_num: int
    path_data: List[PathPoint]
    color: str = "#FFEB3B"
    brush_width: float = 20.0

class BrushHighlightSyncItem(BaseModel):
    id: Optional[int] = None  # Existing server ID
    page_num: int
    path_data: List[PathPoint]
    color: str
    brush_width: float

class BrushHighlightResponse(BaseModel):
    id: int
    pdf_id: int
    page_num: int
    path_data: List[dict]
    color: str
    brush_width: float

    class Config:
        from_attributes = True