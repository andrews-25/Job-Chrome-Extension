# main.py
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
# from openai import OpenAI  # Uncomment when ready to use OpenAI
import PyPDF2
import io
import numpy as np
import os
from pydantic import BaseModel

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # allow extension to call
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# client = OpenAI()  # Uncomment when you have your API key
EMBEDDING_PATH = "resume_embedding.npy"

# ---- Upload resume and save embedding ----
@app.post("/upload_resume")
async def upload_resume(file: UploadFile = File(...)):
    pdf_bytes = await file.read()
    pdf_reader = PyPDF2.PdfReader(io.BytesIO(pdf_bytes))
    resume_text = ""
    for page in pdf_reader.pages:
        resume_text += page.extract_text() or ""

    # ---- TEST: fake embedding instead of OpenAI ----
    fake_embedding = np.random.rand(512)
    np.save(EMBEDDING_PATH, fake_embedding)

    return {
        "message": "Resume embedding saved successfully (test vector).",
        "embedding_preview": fake_embedding[:5].tolist(),
    }

class JobRequest(BaseModel):
    job_id: str
    description: str
    resume_embedding: list[float]

@app.post("/getscore")
async def get_score(request: JobRequest):
    desc_length = len(request.description.split())
    embed_sum = sum(request.resume_embedding)
    score = round((desc_length * 0.05 + embed_sum) % 10, 2)

    return {"job_id": request.job_id, "score": score}
