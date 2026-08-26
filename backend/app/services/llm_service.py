import google.generativeai as genai
from app.config import settings

class LLMService:
    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY
        if self.api_key:
            genai.configure(api_key=self.api_key)
            self.model = genai.GenerativeModel('gemini-1.5-pro')
        else:
            self.model = None

    def generate_legal_answer(self, query: str, exact_evidence: str, chunks_text: str) -> str:
        """
        Uses Gemini to synthesize a structured legal answer based strictly on the provided evidence.
        """
        if not self.model:
            return exact_evidence or "LLM integration is not configured. Please add GEMINI_API_KEY to .env."

        system_prompt = f"""You are a legal contract analysis assistant.

Answer the user's question using ONLY the provided contract evidence and verified legal references.

Rules:
- Give a direct answer first.
- Explain the relevant clause in simple language.
- Mention important conditions, exceptions, fees, penalties, or hidden obligations when relevant.
- If a legal Act/Section is provided, explain its relevance briefly.
- Never invent facts, clauses, Acts, or section numbers.
- Do not call something illegal, fraudulent, or a scam unless the evidence clearly establishes it.
- If the evidence is insufficient, say so clearly.
- Do not mention retrieval, embeddings, chunks, JSON, or internal processing.
- Do not output JSON.
- Use concise paragraphs and bullet points only when useful.

USER QUESTION:
{query}

CONTRACT EVIDENCE (Exact Clause):
{exact_evidence}

ADDITIONAL CONTEXT (Surrounding Text):
{chunks_text}
"""

        try:
            response = self.model.generate_content(system_prompt)
            return response.text
        except Exception as e:
            print(f"Error calling Gemini API: {e}")
            return exact_evidence or "Error generating response from LLM."

llm_service = LLMService()
