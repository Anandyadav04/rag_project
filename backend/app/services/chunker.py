import re
from typing import List, Dict, Any, Optional
from app.config import settings
from app.schemas.page import PageContent

class LegalChunker:
    def __init__(self, target_chunk_size: int = settings.CHUNK_SIZE, overlap: int = settings.CHUNK_OVERLAP):
        self.target_chunk_size = target_chunk_size
        self.overlap = overlap

    def create_chunks(self, pages: List[PageContent]) -> List[Dict[str, Any]]:
        """Processes extracted pages into section-aware legal chunks with page tracking."""
        raw_chunks = []
        chunk_idx = 0

        for page in pages:
            page_number = page.page_number
            text = page.text.strip()
            if not text:
                continue

            # Split text into paragraphs or logical sections
            paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
            if not paragraphs:
                paragraphs = [p.strip() for p in text.split("\n") if p.strip()]

            current_section = page.sections_detected[0] if page.sections_detected else None
            current_buffer = ""

            for p in paragraphs:
                # Check if paragraph is a new section heading
                if self._is_heading(p):
                    current_section = p
                    if current_buffer.strip():
                        # Save current buffer before starting new section
                        chunk_text = current_buffer.strip()
                        raw_chunks.append({
                            "chunk_index": chunk_idx,
                            "text": chunk_text,
                            "page_number": page_number,
                            "section_heading": current_section
                        })
                        chunk_idx += 1
                        current_buffer = ""

                # Append paragraph to buffer
                if len(current_buffer) + len(p) + 1 <= self.target_chunk_size:
                    current_buffer += ("\n" if current_buffer else "") + p
                else:
                    if current_buffer.strip():
                        raw_chunks.append({
                            "chunk_index": chunk_idx,
                            "text": current_buffer.strip(),
                            "page_number": page_number,
                            "section_heading": current_section
                        })
                        chunk_idx += 1
                        
                        # Add overlap from end of current buffer
                        overlap_text = current_buffer[-self.overlap:] if len(current_buffer) > self.overlap else ""
                        current_buffer = overlap_text + ("\n" if overlap_text else "") + p
                    else:
                        # Paragraph itself is longer than chunk size, split by character window
                        sub_chunks = self._sliding_window_split(p)
                        for sub_t in sub_chunks:
                            raw_chunks.append({
                                "chunk_index": chunk_idx,
                                "text": sub_t,
                                "page_number": page_number,
                                "section_heading": current_section
                            })
                            chunk_idx += 1
                        current_buffer = ""

            if current_buffer.strip():
                raw_chunks.append({
                    "chunk_index": chunk_idx,
                    "text": current_buffer.strip(),
                    "page_number": page_number,
                    "section_heading": current_section
                })
                chunk_idx += 1

        return raw_chunks

    def _sliding_window_split(self, text: str) -> List[str]:
        chunks = []
        start = 0
        while start < len(text):
            end = start + self.target_chunk_size
            chunk = text[start:end]
            chunks.append(chunk)
            start += self.target_chunk_size - self.overlap
        return chunks

    def _is_heading(self, line: str) -> bool:
        if len(line) > 120 or len(line) < 3:
            return False
        patterns = [
            r'^(SECTION|ARTICLE|CLAUSE)\s+[\dIVXLC]+',
            r'^\d+(\.\d+)*\s+[A-Z]',
            r'^[A-Z\s]{4,80}$'
        ]
        return any(re.search(pat, line, re.IGNORECASE) for pat in patterns)
