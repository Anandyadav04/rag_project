from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime
from app.models.document import DocumentStatus
from app.schemas.chunk import ChunkResponse

class DocumentBase(BaseModel):
    filename: str
    file_type: str
    file_size: int

class DocumentResponse(DocumentBase):
    id: str
    status: DocumentStatus
    error_message: Optional[str] = None
    total_pages: int
    meta_info: Optional[Dict[str, Any]] = {}
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class DocumentDetail(DocumentResponse):
    total_chunks: int = 0
    chunks: List[ChunkResponse] = []

class DocumentUploadResponse(BaseModel):
    message: str
    document: DocumentResponse
