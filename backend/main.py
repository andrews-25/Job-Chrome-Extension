from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class JobRequest(BaseModel):
    title: str
    company: str
    location: str
    description: str

class JobResponse:
    score: float
    feedback: str
