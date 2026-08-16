import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import Base, get_db
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker
from app.models.document import Document, DocumentStatus
from app.models.chunk import Chunk
from app.models.extracted_clause import ExtractedClause
from app.services.embedder import embedder

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

def test_rag_query():
    # 1. Insert dummy document and chunks
    db = TestingSessionLocal()
    doc = Document(
        filename="test_contract.txt",
        file_path="/tmp/test_contract.txt",
        file_type="txt",
        file_size=1024,
        status=DocumentStatus.COMPLETED
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    
    # 2. Insert chunks
    chunk_text = "This SUPPLY CONTRACT (the \"Agreement\") is made as of Jan 1, 2020."
    embedding = embedder.generate_embedding(chunk_text)
    chunk = Chunk(
        document_id=doc.id,
        chunk_index=0,
        text=chunk_text,
        page_number=1,
        embedding=embedding
    )
    db.add(chunk)
    db.commit()
    db.refresh(chunk)
    doc_id = doc.id
    db.close()
    
    # 3. Test RAG query endpoint
    response = client.post(
        f"/documents/{doc_id}/query",
        json={"query": "Document Name"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert "answer" in data
    assert "SUPPLY CONTRACT" in data["answer"]
    assert data["confidence"] > 0.0

def test_rag_analyze():
    # 1. Insert dummy document and chunks
    db = TestingSessionLocal()
    doc = Document(
        filename="test_contract.txt",
        file_path="/tmp/test_contract.txt",
        file_type="txt",
        file_size=1024,
        status=DocumentStatus.COMPLETED
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    
    # 2. Insert chunks
    chunk_text = "This SUPPLY CONTRACT (the \"Agreement\") is made as of Jan 1, 2020."
    embedding = embedder.generate_embedding(chunk_text)
    chunk = Chunk(
        document_id=doc.id,
        chunk_index=0,
        text=chunk_text,
        page_number=1,
        embedding=embedding
    )
    db.add(chunk)
    db.commit()
    db.refresh(chunk)
    doc_id = doc.id
    db.close()
    
    # 3. Test analysis endpoint
    response = client.post(f"/documents/{doc_id}/analyze")
    assert response.status_code == 200
    data = response.json()
    assert data["document_id"] == str(doc_id)
    assert data["total_categories_analyzed"] == 41
    # Check if Document Name was extracted
    extracted = data["extracted_clauses"]
    doc_name_clauses = [c for c in extracted if c["category"] == "Document Name"]
    assert len(doc_name_clauses) > 0
    assert "SUPPLY CONTRACT" in doc_name_clauses[0]["extracted_text"]

def test_rag_query_term_of_agreement_rejects_title_answer():
    db = TestingSessionLocal()
    doc = Document(
        filename="test_contract.txt",
        file_path="/tmp/test_contract.txt",
        file_type="txt",
        file_size=1024,
        status=DocumentStatus.COMPLETED
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    chunk_text = (
        "This SOFTWARE DEVELOPMENT SERVICES AGREEMENT (the \"Agreement\") "
        "is made as of Jan 1, 2020. "
        "The initial term of this Agreement shall be two (2) years."
    )
    embedding = embedder.generate_embedding(chunk_text)
    chunk = Chunk(
        document_id=doc.id,
        chunk_index=0,
        text=chunk_text,
        page_number=1,
        embedding=embedding
    )
    db.add(chunk)
    db.commit()
    db.refresh(chunk)
    doc_id = doc.id
    db.close()

    response = client.post(
        f"/documents/{doc_id}/query",
        json={"query": "What is the term of the agreement?"}
    )

    assert response.status_code == 200
    data = response.json()
    assert "answer" in data
    assert "SOFTWARE DEVELOPMENT SERVICES AGREEMENT" not in data["answer"]
    assert "two (2) years" in data["answer"]
