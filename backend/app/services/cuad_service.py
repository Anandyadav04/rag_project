import os
import torch
from transformers import pipeline

class CUADService:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(CUADService, cls).__new__(cls)
            cls._instance._initialize()
        return cls._instance

    def _initialize(self):
        # Resolve the path to the CUAD model
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        model_path = os.path.join(base_dir, "../cuad/train_models/cuad-roberta-base/")
        model_path = os.path.abspath(model_path)
        
        # Determine the best device
        if torch.cuda.is_available():
            device = "cuda"
        elif torch.backends.mps.is_available():
            device = "mps"
        else:
            device = "cpu"
            
        print(f"Loading CUAD RoBERTa model from {model_path} on {device}...")
        try:
            self.qa_pipeline = pipeline(
                "question-answering", 
                model=model_path, 
                tokenizer=model_path, 
                device=device,
                handle_impossible_answer=True
            )
            print("CUAD model loaded successfully.")
        except Exception as e:
            print(f"Failed to load CUAD model: {e}")
            self.qa_pipeline = None

    def extract_answer(self, question: str, context: str):
        """
        Extracts the answer from the context given a question.
        Returns a dict with 'score', 'start', 'end', 'answer' if successful, else None.
        """
        if not self.qa_pipeline:
            return None
            
        try:
            # handle_impossible_answer=True might return empty string for 'answer' if no answer is found
            result = self.qa_pipeline(question=question, context=context)
            if isinstance(result, list):
                result = result[0] # Take the best one if multiple returned
                
            return result
        except Exception as e:
            print(f"Error during extraction: {e}")
            return None

cuad_service = CUADService()
