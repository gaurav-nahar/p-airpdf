from sqlalchemy import Column, Integer, BigInteger, String, Text, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from src.db.db import Base


class DocumentationPage(Base):
    __tablename__ = "documentation_pages"

    id = Column(String, primary_key=True)  # client-generated UUID
    workspace_id = Column(Integer, ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String, nullable=False, index=True)
    title = Column(String, nullable=False, default="Untitled")
    content = Column(Text, nullable=True)  # Lexical editor JSON state
    sort_order = Column(BigInteger, nullable=False, default=0)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    workspace = relationship("Workspace", back_populates="documentation_pages")
