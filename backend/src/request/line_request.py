from pydantic import BaseModel,validator
from typing import Optional, List, Union
from datetime import datetime
import json

class LineBase(BaseModel):
    pdf_id: int
    workspace_id: int
    points: Union[str, List[float]]
    color: Optional[str] = None
    stroke_width: Optional[float] = None

    class Config:
        extra = "ignore"

    @validator("points", pre=True)
    def parse_points(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception as e:
                raise ValueError(f"Invalid JSON for points: {e}")
        return v

class LineCreate(LineBase):
    pass

class LineUpdate(BaseModel):
    points: Optional[Union[str, List[float]]] = None
    color: Optional[str] = None
    stroke_width: Optional[float] = None

    class Config:
        extra = "ignore"

    @validator("points", pre=True, always=True)
    def parse_points(cls, v):
        if v is None:
            return v
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception as e:
                raise ValueError(f"Invalid JSON for points: {e}")
        return v

class LineResponse(LineBase):
    id: int
    workspace_id: int
    created_at: datetime  # <-- change from str to datetime
    updated_at: datetime  # <-- change from str to datetime

    class Config:
        from_attributes = True
