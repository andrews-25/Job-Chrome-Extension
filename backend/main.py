# main.py
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

# Define the shape of the request (data sent from the extension)
class JobRequest(BaseModel):
    title: str
    company: str
    location: str
    description: str

# Define the shape of the response
class JobResponse(BaseModel):
    score: int
    feedback: str

@app.post("/getscore", response_model=JobResponse)
def score_job(job: JobRequest):
    # Temporary local scoring logic
    keywords = ["finance", "data", "analysis", "energy", "trading", "python", "sql", "market"]
    desc_lower = job.description.lower()

    match_count = sum(1 for word in keywords if word in desc_lower)
    score = min(10, round(match_count / len(keywords) * 10)) or 5

    if score > 8:
        feedback = "Strong match! This role fits your likely skill set well."
    elif score > 5:
        feedback = "Moderate match. Some overlap, but review the details."
    else:
        feedback = "Weak match. Probably not ideal for your profile."

    return JobResponse(score=score, feedback=feedback)
