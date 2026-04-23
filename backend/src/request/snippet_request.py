from pydantic import BaseModel
from typing import Optional, Union
from datetime import datetime

# ------------------ HELPER FUNCTIONS ------------------
def safe_float(value, default=0.0):
    try:
        if value is None or value == "":
            return default
        return float(value)
    except (ValueError, TypeError):
        return default

def safe_int(value, default=0):
    try:
        if value is None or value == "":
            return default
        return int(value)
    except (ValueError, TypeError):
        return default


# ---------------------------------------------------------
# CREATE SNIPPET MODEL
# Accepts:
# - text: str
# - image: raw bytes (binary uploaded from FastAPI Form)
# ---------------------------------------------------------
class SnippetCreate(BaseModel):
    pdf_id: int
    workspace_id: int
    content: Optional[Union[str, bytes]] = None   # text OR raw bytes
    type: str                                     # 'text' | 'image'
    x: float = 0.0
    y: float = 0.0
    page: Optional[int] = None
    width: Optional[float] = None
    height: Optional[float] = None

    # New fields for PDF origin position
    x_pct: Optional[float] = None
    y_pct: Optional[float] = None
    width_pct: Optional[float] = None
    height_pct: Optional[float] = None

    def parse_numeric_fields(self):
        self.x = safe_float(self.x)
        self.y = safe_float(self.y)
        self.width = safe_float(self.width)
        self.height = safe_float(self.height)
        self.page = safe_int(self.page) if self.page is not None else None
        
        self.x_pct = safe_float(self.x_pct)
        self.y_pct = safe_float(self.y_pct)
        self.width_pct = safe_float(self.width_pct)
        self.height_pct = safe_float(self.height_pct)

    class Config:
        arbitrary_types_allowed = True   # allow bytes
        extra = "ignore"


# ---------------------------------------------------------
# UPDATE SNIPPET
# Text only — images are usually not updated by PUT
# ---------------------------------------------------------
class SnippetUpdate(BaseModel):
    x: Optional[float] = None
    y: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None
    page: Optional[int] = None
    def parse_numeric_fields(self):
        if self.x is not None:
            self.x = safe_float(self.x)
        if self.y is not None:
            self.y = safe_float(self.y)
        if self.width is not None:
            self.width = safe_float(self.width)
        if self.height is not None:
            self.height = safe_float(self.height)
        if self.page is not None:
            self.page = safe_int(self.page)

    class Config:
        extra = "ignore"


# ---------------------------------------------------------
# SNIPPET OUTPUT MODEL
# Always return:
# - text as string
# - image as BASE64 string
# ---------------------------------------------------------
class SnippetOut(BaseModel):
    id: int
    pdf_id: int
    workspace_id: int
    content: Optional[str] = None       # base64 string (for image)
    type: str
    x: float
    y: float
    page: Optional[int]
    width: Optional[float]
    height: Optional[float]
    x_pct: Optional[float]
    y_pct: Optional[float]
    width_pct: Optional[float]
    height_pct: Optional[float]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]


    class Config:
        orm_mode = True
