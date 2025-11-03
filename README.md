# Job-Chrome-Extension

This is a Chrome extension that helps users see how well their resume matches any job posting online. You upload your resume once, browse listings, and get instant compatibility insights powered by AI embeddings. 
This repository represents the initial development phase and outlines planned features prior to the first Chrome Web Store publication.

## Features
- Upload a PDF resume directly through the extension
- Uses AI embeddings to compare your resume and job descriptions
- Displays a match score in real time as you browse
- Simple, lightweight interface built for Chrome

## How It Works
1. The backend processes your uploaded resume and generates vector embeddings.
2. When you view a job posting, the extension scrapes the job description text.
3. That text is sent to the backend for comparison using cosine similarity.
4. The match score and feedback are shown directly in the extension.

## Tech Stack
**Frontend**
- JavaScript, HTML, CSS
- Chrome Extension APIs (Manifest v3)

**Backend**
- Python (Flask or FastAPI)
- OpenAI Embeddings API
- PDF parsing with PyPDF2 or pdfplumber

Currently Supports: Indeed
Soon to be supported: Glassdoor, LiknedIN, ZipRecruiter


