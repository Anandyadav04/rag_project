from sqlalchemy import Column, Integer, String, Float, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base

class ExtractedClause(Base):
    __tablename__ = "extracted_clauses"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(String(36), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    chunk_id = Column(String(36), ForeignKey("chunks.id", ondelete="CASCADE"), nullable=True, index=True)
    category = Column(String, index=True, nullable=False)
    extracted_text = Column(Text, nullable=False)
    page_number = Column(Integer, nullable=True)
    confidence = Column(Float, nullable=False)

    # Relationships
    document = relationship("Document", backref="extracted_clauses")
    chunk = relationship("Chunk", backref="extracted_clauses")
