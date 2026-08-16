from app.services.cuad_service import cuad_service

print("Testing CUAD service...")
res = cuad_service.extract_answer(
    question="Highlight the parts (if any) of this contract related to \"Document Name\" that should be reviewed by a lawyer.",
    context="This SUPPLY CONTRACT (the \"Agreement\") is made as of Jan 1, 2020."
)
print("Result:", res)
