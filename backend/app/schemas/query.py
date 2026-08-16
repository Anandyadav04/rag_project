from pydantic import BaseModel, ConfigDict
from typing import List, Optional

class QueryRequest(BaseModel):
    query: str

class QueryResponse(BaseModel):
    answer: str
    exact_evidence_text: str
    page_numbers: List[int]
    supporting_chunk_ids: List[str]
    confidence: float
