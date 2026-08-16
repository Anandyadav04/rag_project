from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.document import Document
from app.schemas.analysis import AnalysisResponse, ExtractedClauseResponse
from app.schemas.query import QueryRequest, QueryResponse
from app.services.analysis import analysis_service, CUAD_CATEGORIES

router = APIRouter(prefix="/documents", tags=["Analysis & Query"])

@router.post("/{document_id}/analyze", response_model=AnalysisResponse)
def analyze_document(document_id: str, db: Session = Depends(get_db)):
    """
    Analyzes the document against all 41 CUAD legal categories.
    """
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
        
    extracted_clauses = analysis_service.analyze_document(db, document_id)
    
    return AnalysisResponse(
        document_id=document_id,
        total_categories_analyzed=len(CUAD_CATEGORIES),
        extracted_clauses=extracted_clauses
    )

@router.post("/{document_id}/query", response_model=QueryResponse)
def query_document(document_id: str, request: QueryRequest, db: Session = Depends(get_db)):
    """
    Queries a document using hybrid retrieval and CUAD extraction.
    """
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
        
    result = analysis_service.query_document(db, document_id, request.query)
    
    return QueryResponse(**result)
