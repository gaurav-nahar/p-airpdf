from sqlalchemy import Column, BigInteger, String, Text, DateTime, ForeignKey, func, Boolean
from src.db.db import Base


class WorkspacePdf(Base):
    __tablename__ = "workspace_pdfs"

    id = Column(BigInteger, primary_key=True, index=True)
    workspace_id = Column(BigInteger, ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    pdf_id = Column(BigInteger, ForeignKey("pdf_files.id", ondelete="CASCADE"), nullable=False)
    pdf_name = Column(String, nullable=True)
    pdf_url = Column(Text, nullable=True)
    is_active = Column(Boolean, server_default="true", nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
