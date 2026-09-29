import google.generativeai as genai
from app.config import settings

class LLMService:
    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY
        if self.api_key:
            genai.configure(api_key=self.api_key)
            self.model = genai.GenerativeModel('gemini-2.5-flash')
        else:
            self.model = None

    def generate_legal_answer(self, query: str, exact_evidence: str, chunks_text: str) -> str:
        """
        Uses Gemini to synthesize a structured legal answer based strictly on the provided evidence.
        """
        if not self.model:
            return exact_evidence or "LLM integration is not configured. Please add GEMINI_API_KEY to .env."

        evidence_section = f"CONTRACT EVIDENCE (Exact Clause):\n{exact_evidence}" if exact_evidence else "CONTRACT EVIDENCE: No exact clause was extracted by the model."

        system_prompt = f"""You are a legal contract intelligence assistant.

Answer the user's question based strictly on the provided contract context.

Rules:
- Give a direct, accurate answer first.
- If the contract does NOT contain terms or provisions related to the question (for example, no payment terms, no indemnification, or no renewal clause), explicitly state that this contract does not contain such provisions. Explain briefly what type of contract this is (e.g. Non-Disclosure Agreement, Software License, etc.).
- Never invent clauses, terms, numbers, or dates that are not in the contract.
- If a relevant clause is present, explain its key legal implications in clear, professional language.
- Do not mention chunks, embeddings, vector search, or internal processing.
- Keep the response concise, authoritative, and helpful for a legal reviewer.

USER QUESTION:
{query}

{evidence_section}

ADDITIONAL CONTEXT (Contract Text):
{chunks_text}
"""

        try:
            response = self.model.generate_content(system_prompt)
            return response.text.strip()
        except Exception as e:
            print(f"Error calling Gemini API: {e}")
            if exact_evidence:
                return f"Relevant clause extracted from contract:\n\n\"{exact_evidence}\""
            return f"No provisions or clauses regarding '{query}' were identified in this document."

llm_service = LLMService()
