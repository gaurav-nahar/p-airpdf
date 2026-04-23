from pydantic import BaseModel
from datetime import datetime


class BoxCreate(BaseModel):
    pdf_id: int
    workspace_id: int
    text: str | None = None
    x: float = 0.0
    y: float = 0.0
    width: float = 100.0
    height: float = 50.0

    class Config:
        extra = "ignore"


class BoxUpdate(BaseModel):
    text: str | None = None
    x: float | None = None
    y: float | None = None
    width: float | None = None
    height: float | None = None

    class Config:
        extra = "ignore"


class BoxResponse(BaseModel):
    id: int
    pdf_id: int
    workspace_id: int
    text: str | None
    x: float
    y: float
    width: float
    height: float
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True
