import json
from sqlalchemy import Column, Integer, Float, String, Text, ForeignKey, DateTime, func
from sqlalchemy.orm import relationship
from src.db.db import Base

class Line(Base):
    __tablename__ = "lines"

    id = Column(Integer, primary_key=True, index=True)
    pdf_id = Column(Integer, ForeignKey("pdf_files.id", ondelete="CASCADE"), nullable=False, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String, index=True, nullable=False) # Mandatory for user isolation
    case_no = Column(String, nullable=True, index=True)
    case_year = Column(String, nullable=True, index=True)
    case_type = Column(String, nullable=True, index=True)
    _points = Column("points", Text, nullable=False)  # Text column in DB

    color = Column(Text, nullable=True)
    stroke_width = Column(Float, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    pdf = relationship("PDFFile", back_populates="lines")
    workspace = relationship("Workspace", back_populates="lines")

    @property
    def points(self):
        if not self._points:
            return []
        try:
            return json.loads(self._points)
        except Exception as e:
            print(f"Error parsing points JSON: {e}")
            return []

    @points.setter
    def points(self, value):
        if isinstance(value, list):
            self._points = json.dumps(value)
        elif isinstance(value, str):
            # Validate string is valid JSON
            try:
                json.loads(value)
                self._points = value
            except json.JSONDecodeError:
                raise ValueError("Invalid JSON string assigned to points")
        elif value is None:
            self._points = json.dumps([])
        else:
            raise ValueError("points must be a list, JSON string, or None")

    def __repr__(self):
        return f"<Line id={self.id} pdf_id={self.pdf_id} points={self.points}>"
