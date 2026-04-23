from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from src.db.db import Base


class Bookmark(Base):
    __tablename__ = "bookmarks"

    id = Column(Integer, primary_key=True, index=True)
    pdf_id = Column(Integer, ForeignKey("pdf_files.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String, nullable=False)
    case_no = Column(String, nullable=True, index=True)
    case_year = Column(String, nullable=True, index=True)
    case_type = Column(String, nullable=True, index=True)
    page_num = Column(Integer, nullable=False)
    name = Column(String, default="")
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    pdf = relationship("PDFFile", back_populates="bookmarks")
