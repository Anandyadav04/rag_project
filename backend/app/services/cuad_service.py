import os
import re
import torch
from transformers import AutoTokenizer, AutoModelForQuestionAnswering


class CUADService:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(CUADService, cls).__new__(cls)
            cls._instance._initialize()
        return cls._instance

    def _initialize(self):
        # Resolve the path to the CUAD model
        base_dir = os.path.dirname(
            os.path.dirname(
                os.path.dirname(
                    os.path.abspath(__file__)
                )
            )
        )

        local_model_path = os.path.join(
            base_dir,
            "../cuad/train_models/cuad-roberta-base/"
        )

        local_model_path = os.path.abspath(local_model_path)

        # Check if local model exists, otherwise fallback to Hugging Face Hub
        if os.path.exists(local_model_path) and os.listdir(local_model_path):
            model_id_or_path = local_model_path
            print(
                f"Loading local CUAD RoBERTa model from "
                f"{model_id_or_path}..."
            )
        else:
            model_id_or_path = "Rakib/roberta-base-on-cuad"
            print(
                f"Using CUAD model '{model_id_or_path}'..."
            )

        # Determine the best device
        if torch.cuda.is_available():
            self.device = "cuda"
        elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            self.device = "mps"
        else:
            self.device = "cpu"

        print(
            f"Loading CUAD RoBERTa model from "
            f"{model_id_or_path} on {self.device}..."
        )

        try:
            self.tokenizer = AutoTokenizer.from_pretrained(model_id_or_path)
            self.model = AutoModelForQuestionAnswering.from_pretrained(model_id_or_path)
            self.model.to(self.device)
            self.model.eval()
            print("CUAD model loaded successfully.")

        except Exception as e:
            print(f"Failed to load CUAD model: {e}")
            self.tokenizer = None
            self.model = None

    def extract_answer(self, question: str, context: str, max_length: int = 512):
        """
        Extracts the answer from the context given a question using context-constrained span search.

        Returns a dict with:
        'score', 'start', 'end', 'answer', 'diff'

        Returns None if extraction fails.
        """
        if not self.model or not self.tokenizer or not context or not context.strip():
            return None

        try:
            inputs = self.tokenizer(
                question,
                context,
                return_tensors="pt",
                truncation="only_second",
                max_length=max_length
            )

            input_ids = inputs["input_ids"][0]
            # RoBERTa sequence structure: <s> question </s></s> context </s>
            sep_indices = (input_ids == self.tokenizer.sep_token_id).nonzero(as_tuple=True)[0]
            if len(sep_indices) < 2:
                return None

            context_start = sep_indices[1].item() + 1
            context_end = sep_indices[-1].item() - 1

            if context_end < context_start:
                return None

            inputs_device = {k: v.to(self.device) for k, v in inputs.items()}

            with torch.no_grad():
                outputs = self.model(**inputs_device)

            start_logits = outputs.start_logits[0].cpu()
            end_logits = outputs.end_logits[0].cpu()

            null_score = (start_logits[0] + end_logits[0]).item()

            s_logits = start_logits[context_start:context_end + 1]
            e_logits = end_logits[context_start:context_end + 1]

            n = s_logits.size(0)
            span_matrix = s_logits.unsqueeze(1) + e_logits.unsqueeze(0)
            i_indices = torch.arange(n).unsqueeze(1).expand(n, n)
            j_indices = torch.arange(n).unsqueeze(0).expand(n, n)
            mask = (j_indices >= i_indices) & (j_indices - i_indices <= 150)

            span_matrix[~mask] = float('-inf')
            max_val = span_matrix.max()

            if max_val.item() == float('-inf'):
                return None

            best_idx = (span_matrix == max_val).nonzero()[0]
            s_idx = best_idx[0].item() + context_start
            e_idx = best_idx[1].item() + context_start

            span_score = max_val.item()
            diff = span_score - null_score
            confidence = 1.0 / (1.0 + torch.exp(torch.tensor(-diff))).item()

            ans_text = self.tokenizer.decode(input_ids[s_idx:e_idx + 1], skip_special_tokens=True).strip()
            ans_text = re.sub(r'^[,\.\s;:]+', '', ans_text).strip()

            if len(ans_text) < 3 or re.match(r'^[^\w]+$', ans_text):
                return None

            return {
                "score": float(confidence),
                "diff": float(diff),
                "start": s_idx,
                "end": e_idx,
                "answer": ans_text
            }

        except Exception as e:
            print(f"Error during extraction: {e}")
            return None


cuad_service = CUADService()
