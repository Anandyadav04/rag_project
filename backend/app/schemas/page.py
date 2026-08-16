from pydantic import BaseModel
from typing import List, Optional

class PageContent(BaseModel):
    page_number: int
    text: str
    word_count: int
    sections_detected: List[str] = []

class DocumentPagesResponse(BaseModel):
    document_id: str
    total_pages: int
    pages: List[PageContent]
