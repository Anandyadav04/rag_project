import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "Legal Document RAG Backend"
    VERSION: str = "1.0.0"
    API_PREFIX: str = ""

    # Database Settings
    DATABASE_URL: str = "sqlite:///./legal_rag.db"

    # LLM Settings
    GEMINI_API_KEY: str = ""

    # Upload Settings
    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_SIZE_MB: int = 50
    ALLOWED_EXTENSIONS: set = {".pdf", ".docx", ".txt"}

    # Chunking & Embedding Settings
    EMBEDDING_MODEL_NAME: str = "sentence-transformers/all-MiniLM-L6-v2"
    EMBEDDING_DIMENSION: int = 384
    CHUNK_SIZE: int = 1200      # Target characters per chunk (clause-aware)
    CHUNK_OVERLAP: int = 150    # Overlap characters between chunks

    model_config = SettingsConfigDict(env_file=".env", extra="ignore", env_file_encoding="utf-8")

settings = Settings()

os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
