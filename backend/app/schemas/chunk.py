from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime

class ChunkBase(BaseModel):
    chunk_index: int
    text: str
    page_number: int
    section_heading: Optional[str] = None

class ChunkResponse(ChunkBase):
    id: str
    document_id: str
    has_embedding: bool = False
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
