# main.py
from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI
import PyPDF2
import io
import numpy as np
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = OpenAI()
EMBEDDING_PATH = "resume_embedding.npy"

# ---- Upload resume and save embedding ----
@app.post("/upload_resume")
async def upload_resume(file: UploadFile = File(...)):
    pdf_bytes = await file.read()
    pdf_reader = PyPDF2.PdfReader(io.BytesIO(pdf_bytes))
    resume_text = ""
    for page in pdf_reader.pages:
        resume_text += page.extract_text() or ""

    # Create embedding and save locally
    resume_embedding = client.embeddings.create(
        model="text-embedding-3-small",
        input=resume_text
    ).data[0].embedding

    np.save(EMBEDDING_PATH, np.array(resume_embedding))
    return {"message": "Resume embedding saved successfully."}


# ---- Compare stored embedding to job description
@app.post("/getscore")
async def get_score(job_description: str = Form(...)):
    if not os.path.exists(EMBEDDING_PATH):
        return {"error": "No stored resume embedding found. Please upload your resume first."}

    # Load the stored resume embedding
    resume_embedding = np.load(EMBEDDING_PATH)

    # Create embedding for job description
    job_embedding = client.embeddings.create(
        model="text-embedding-3-small",
        input=job_description
    ).data[0].embedding

    # Compute cosine similarity
    def cosine_similarity(a, b):
        a, b = np.array(a), np.array(b)
        return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

    score = cosine_similarity(resume_embedding, job_embedding)
    score_percent = round(score * 100, 2)
    feedback = f"Your resume matches this job posting by approximately {score_percent}%."

    return {"score": score_percent, "feedback": feedback}
