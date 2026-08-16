# Legal Document Ingestion & RAG Backend

This repository provides a modular, production-ready FastAPI backend for document ingestion, page-aware extraction (PDF & DOCX), legal section chunking, and embedding storage in PostgreSQL with `pgvector`.

> [!NOTE]
> This backend is built cleanly in `backend/` and operates independently of the CUAD repository and model checkpoints in `cuad/`.

---

## 📁 Files Created & Modular Architecture

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                # FastAPI app initialization, CORS, lifespan handler
│   ├── config.py              # Environment configuration & Pydantic settings
│   ├── database.py            # SQLAlchemy engine, session maker, pgvector extension initialization
│   ├── models/                # Database ORM models
│   │   ├── __init__.py
│   │   ├── document.py        # Document model with state machine (uploaded -> processing -> completed / failed)
│   │   └── chunk.py           # Chunk model with pgvector (Vector 384) embedding column
│   ├── schemas/               # Pydantic schemas (V2)
│   │   ├── __init__.py
│   │   ├── document.py        # DocumentUploadResponse, DocumentResponse, DocumentDetail
│   │   ├── chunk.py           # ChunkResponse
│   │   └── page.py            # PageContent, DocumentPagesResponse
│   ├── services/              # Business logic & Pipeline Services
│   │   ├── __init__.py
│   │   ├── extractor.py       # PyMuPDF (PDF) and python-docx (DOCX) page-aware extraction
│   │   ├── chunker.py         # Legal section-aware chunker with page tracking & overlap
│   │   ├── embedder.py        # Local SentenceTransformer embedding generator (all-MiniLM-L6-v2)
│   │   └── document_service.py# File saving, background processing pipeline & DB operations
│   └── routes/                # API Endpoints
│       ├── __init__.py
│       └── documents.py       # Upload, GET, GET by ID, DELETE, GET /pages endpoints
├── uploads/                   # Stored uploaded files
├── requirements.txt           # Independent Python dependencies
├── README.md                  # Instructions and API documentation
└── tests/
    └── test_api.py            # Pytest test suite for extraction, chunking, embeddings & APIs
```

---

## 🛠️ Environment Setup & Commands

### 1. Database Setup (PostgreSQL + pgvector)

Ensure PostgreSQL with `pgvector` extension is running.

```bash
# Create database in PostgreSQL
createdb rag_db

# Connect to PostgreSQL and enable pgvector extension
psql -d rag_db -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### 2. Environment Variables

Create a `.env` file in `backend/`:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/rag_db
UPLOAD_DIR=uploads
EMBEDDING_MODEL_NAME=sentence-transformers/all-MiniLM-L6-v2
```

### 3. Running the Backend Server

```bash
cd backend
source .venv/bin/activate
PYTHONPATH=. uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Interactive API documentation (Swagger UI) will be available at:
`http://localhost:8000/docs`

### 4. Running Tests

```bash
cd backend
PYTHONPATH=. .venv/bin/pytest -v tests/test_api.py
```

---

## 🚀 API Documentation & Test Examples

### 1. Upload Document (`POST /documents/upload`)
Upload a PDF or DOCX file. File processing and embedding generation execute automatically in the background.

```bash
curl -X 'POST' \
  'http://localhost:8000/documents/upload' \
  -H 'accept: application/json' \
  -H 'Content-Type: multipart/form-data' \
  -F 'file=@/path/to/sample_contract.pdf'
```

**Response (201 Created):**
```json
{
  "message": "Document uploaded successfully. Processing started in background.",
  "document": {
    "filename": "sample_contract.pdf",
    "file_type": "pdf",
    "file_size": 1048576,
    "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "status": "uploaded",
    "error_message": null,
    "total_pages": 0,
    "meta_info": {},
    "created_at": "2026-08-16T00:00:00",
    "updated_at": "2026-08-16T00:00:00"
  }
}
```

---

### 2. List All Documents (`GET /documents`)

```bash
curl -X 'GET' 'http://localhost:8000/documents' -H 'accept: application/json'
```

**Response (200 OK):**
```json
[
  {
    "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "filename": "sample_contract.pdf",
    "file_type": "pdf",
    "file_size": 1048576,
    "status": "completed",
    "error_message": null,
    "total_pages": 12,
    "meta_info": {},
    "created_at": "2026-08-16T00:00:00",
    "updated_at": "2026-08-16T00:05:00"
  }
]
```

---

### 3. Get Document Details & Chunks (`GET /documents/{id}`)

```bash
curl -X 'GET' 'http://localhost:8000/documents/7c9e6679-7425-40de-944b-e07fc1f90ae7' -H 'accept: application/json'
```

**Response (200 OK):**
```json
{
  "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "filename": "sample_contract.pdf",
  "file_type": "pdf",
  "file_size": 1048576,
  "status": "completed",
  "total_pages": 12,
  "total_chunks": 45,
  "chunks": [
    {
      "chunk_index": 0,
      "text": "SECTION 1. DEFINITIONS...",
      "page_number": 1,
      "section_heading": "SECTION 1. DEFINITIONS",
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "document_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      "has_embedding": true,
      "created_at": "2026-08-16T00:05:00"
    }
  ]
}
```

---

### 4. Get Document Pages (`GET /documents/{id}/pages`)

```bash
curl -X 'GET' 'http://localhost:8000/documents/7c9e6679-7425-40de-944b-e07fc1f90ae7/pages' -H 'accept: application/json'
```

**Response (200 OK):**
```json
{
  "document_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "total_pages": 2,
  "pages": [
    {
      "page_number": 1,
      "text": "MASTER SERVICES AGREEMENT...",
      "word_count": 350,
      "sections_detected": ["SECTION 1. TERM AND TERMINATION"]
    }
  ]
}
```

---

### 5. Delete Document (`DELETE /documents/{id}`)

```bash
curl -X 'DELETE' 'http://localhost:8000/documents/7c9e6679-7425-40de-944b-e07fc1f90ae7' -H 'accept: application/json'
```

**Response (200 OK):**
```json
{
  "message": "Document '7c9e6679-7425-40de-944b-e07fc1f90ae7' deleted successfully"
}
```
