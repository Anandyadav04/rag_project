from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.document import DocumentResponse, DocumentDetail, DocumentUploadResponse
from app.schemas.page import DocumentPagesResponse
from app.schemas.chunk import ChunkResponse
from app.services.document_service import DocumentService

router = APIRouter(prefix="/documents", tags=["Documents"])

@router.post("/upload", response_model=DocumentUploadResponse, status_code=status.HTTP_201_CREATED)
def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Upload PDF or DOCX file.
    Creates document record with status 'uploaded' and triggers processing in background.
    """
    file_path, file_type, file_size = DocumentService.save_upload_file(file)
    doc = DocumentService.create_document(db, file.filename, file_path, file_type, file_size)
    
    # Trigger background ingestion task
    background_tasks.add_task(DocumentService.process_document, db, doc.id)

    return DocumentUploadResponse(
        message="Document uploaded successfully. Processing started in background.",
        document=DocumentResponse.model_validate(doc)
    )

@router.get("", response_model=List[DocumentResponse])
def list_documents(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Retrieve list of all uploaded documents."""
    docs = DocumentService.list_documents(db, skip=skip, limit=limit)
    return [DocumentResponse.model_validate(d) for d in docs]

@router.get("/{document_id}", response_model=DocumentDetail)
def get_document(
    document_id: str,
    db: Session = Depends(get_db)
):
    """Retrieve document details along with chunk counts and chunk records."""
    doc = DocumentService.get_document(db, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    chunks_response = [
        ChunkResponse(
            id=c.id,
            document_id=c.document_id,
            chunk_index=c.chunk_index,
            text=c.text,
            page_number=c.page_number,
            section_heading=c.section_heading,
            has_embedding=c.embedding is not None,
            created_at=c.created_at
        )
        for c in doc.chunks
    ]

    doc_detail = DocumentDetail(
        id=doc.id,
        filename=doc.filename,
        file_type=doc.file_type,
        file_size=doc.file_size,
        status=doc.status,
        error_message=doc.error_message,
        total_pages=doc.total_pages,
        meta_info=doc.meta_info or {},
        created_at=doc.created_at,
        updated_at=doc.updated_at,
        total_chunks=len(doc.chunks),
        chunks=chunks_response
    )
    return doc_detail

@router.delete("/{document_id}", status_code=status.HTTP_200_OK)
def delete_document(
    document_id: str,
    db: Session = Depends(get_db)
):
    """Delete document by ID along with stored chunks and raw files."""
    success = DocumentService.delete_document(db, document_id)
    if not success:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"message": f"Document '{document_id}' deleted successfully"}

@router.get("/{document_id}/pages", response_model=DocumentPagesResponse)
def get_document_pages(
    document_id: str,
    db: Session = Depends(get_db)
):
    """Retrieve page-by-page extracted text content and section info."""
    pages_resp = DocumentService.get_document_pages(db, document_id)
    if not pages_resp:
        raise HTTPException(status_code=404, detail="Document pages not found")
    return pages_resp
