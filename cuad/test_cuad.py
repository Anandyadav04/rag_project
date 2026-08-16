import json
import torch
from transformers import AutoTokenizer, AutoModelForQuestionAnswering

MODEL_PATH = "./train_models/cuad-roberta-base"
DATA_PATH = "./data/CUADv1.json"

# Load model
tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
model = AutoModelForQuestionAnswering.from_pretrained(MODEL_PATH)
model.eval()

# Load CUAD dataset
with open(DATA_PATH, "r", encoding="utf-8") as f:
    dataset = json.load(f)

# First contract
contract = dataset["data"][0]
paragraph = contract["paragraphs"][0]
context = paragraph["context"]

# Use one of CUAD's actual questions
question = paragraph["qas"][7]["question"]

print("\nQUESTION:")
print(question)

# Tokenize
inputs = tokenizer(
    question,
    context,
    return_tensors="pt",
    truncation=True,
    max_length=512
)

with torch.no_grad():
    outputs = model(**inputs)

# Find best start/end positions
start = torch.argmax(outputs.start_logits)
end = torch.argmax(outputs.end_logits)

if end < start:
    end = start

answer_tokens = inputs["input_ids"][0][start:end + 1]
answer = tokenizer.decode(answer_tokens, skip_special_tokens=True)

print("\nANSWER:")
print(answer)

print("\nContract:")
print(contract.get("title", "Unknown"))
