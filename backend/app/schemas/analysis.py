from pydantic import BaseModel, ConfigDict
from typing import List, Optional

class ExtractedClauseResponse(BaseModel):
    id: int
    category: str
    extracted_text: str
    page_number: Optional[int] = None
    chunk_id: Optional[str] = None
    confidence: float

    model_config = ConfigDict(from_attributes=True)

class AnalysisResponse(BaseModel):
    document_id: str
    total_categories_analyzed: int
    extracted_clauses: List[ExtractedClauseResponse]
