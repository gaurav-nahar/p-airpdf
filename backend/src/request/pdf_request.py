from pydantic import BaseModel
from typing import List, Optional
from src.request.highlight_request import HighlightOut
from src.request.pdf_text_request import PdfTextOut
from src.request.pdf_drawing_line_request import PdfDrawingLineResponse
from src.request.pdf_brush_highlight_request import BrushHighlightResponse

class PdfCreate(BaseModel):
    name: str
    path: str


class PdfOut(PdfCreate):
    id: int
    version: int
    highlights: List[HighlightOut] = []
    pdf_texts: List[PdfTextOut] = []
    pdf_drawing_lines: List[PdfDrawingLineResponse] = []
    brush_highlights: List[BrushHighlightResponse] = []

    class Config:
        orm_mode = True
        from_attributes = True
