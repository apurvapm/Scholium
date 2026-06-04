"""
Research Paper Assistant — FastAPI Backend
Run: uvicorn main:app --reload --port 8000
"""
import os
import base64
import asyncio
from typing import Optional

from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

from services import llm_service, arxiv_service, pdf_service, rag_service

app = FastAPI(title="Research Paper Assistant API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_paper_store: dict[str, bytes] = {}
_text_store: dict[str, str] = {}
_meta_store: dict[str, dict] = {}
_rag_ready: dict[str, bool] = {}

CURRENT_PAPER_KEY = "current"


# ── Models ───────────────────────────────────────────────────────────────────

class ArxivLoadRequest(BaseModel):
    url_or_id: str

class QuestionRequest(BaseModel):
    question: str

class SelectionQuestionRequest(BaseModel):
    selected_text: str
    question: str
    context: Optional[str] = None

class RecommendRequest(BaseModel):
    title: str
    abstract: str
    topics: list[str] = []

class SurveyRequest(BaseModel):
    papers: list[dict]
    topic: str

class SearchRequest(BaseModel):
    query: str
    max_results: int = 10


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_paper_text() -> str:
    text = _text_store.get(CURRENT_PAPER_KEY)
    if not text:
        raise HTTPException(status_code=400, detail="No paper loaded.")
    return text

async def _build_rag_index(text: str):
    """Build RAG index in the background after a paper is loaded."""
    try:
        _rag_ready[CURRENT_PAPER_KEY] = False
        n = await rag_service.build_index(text)
        _rag_ready[CURRENT_PAPER_KEY] = True
        print(f"RAG index built: {n} chunks")
    except Exception as e:
        print(f"RAG index build failed (Q&A will fall back to full text): {e}")
        _rag_ready[CURRENT_PAPER_KEY] = False


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "rag_ready": _rag_ready.get(CURRENT_PAPER_KEY, False)}


@app.post("/upload")
async def upload_pdf(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    pdf_bytes = await file.read()
    text = pdf_service.extract_text(pdf_bytes)

    _paper_store[CURRENT_PAPER_KEY] = pdf_bytes
    _text_store[CURRENT_PAPER_KEY] = text
    _meta_store[CURRENT_PAPER_KEY] = {
        "filename": file.filename,
        "page_count": pdf_service.get_page_count(pdf_bytes),
        "source": "upload",
    }

    # Build RAG index in background so upload returns immediately
    background_tasks.add_task(_build_rag_index, text)

    return {
        "message": "PDF loaded successfully",
        "filename": file.filename,
        "page_count": _meta_store[CURRENT_PAPER_KEY]["page_count"],
        "pdf_base64": base64.b64encode(pdf_bytes).decode(),
        "rag_indexing": True,
    }


@app.post("/load-arxiv")
async def load_arxiv(background_tasks: BackgroundTasks, req: ArxivLoadRequest):
    try:
        arxiv_id = arxiv_service.extract_arxiv_id(req.url_or_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    try:
        meta = arxiv_service.get_paper_metadata(arxiv_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    pdf_bytes = await arxiv_service.download_pdf(meta["pdf_url"])
    text = pdf_service.extract_text(pdf_bytes)

    _paper_store[CURRENT_PAPER_KEY] = pdf_bytes
    _text_store[CURRENT_PAPER_KEY] = text
    _meta_store[CURRENT_PAPER_KEY] = {**meta, "source": "arxiv", "page_count": pdf_service.get_page_count(pdf_bytes)}

    background_tasks.add_task(_build_rag_index, text)

    return {
        "message": "Paper loaded from ArXiv",
        "metadata": _meta_store[CURRENT_PAPER_KEY],
        "pdf_base64": base64.b64encode(pdf_bytes).decode(),
        "rag_indexing": True,
    }


@app.get("/rag-status")
def rag_status():
    return {
        "ready": _rag_ready.get(CURRENT_PAPER_KEY, False),
        "chunks": rag_service.index_size(),
    }


@app.get("/paper-info")
def paper_info():
    meta = _meta_store.get(CURRENT_PAPER_KEY)
    if not meta:
        raise HTTPException(status_code=404, detail="No paper loaded.")
    return meta


@app.post("/summarize")
async def summarize():
    text = _get_paper_text()
    truncated = pdf_service.chunk_text(text)
    summary = await llm_service.generate(
        f"Please summarize the following research paper:\n\n{truncated}",
        system=llm_service.SUMMARIZE_SYSTEM
    )
    return {"summary": summary}


@app.post("/qa")
async def qa(req: QuestionRequest):
    """Answer using RAG if index is ready, otherwise fall back to full text."""
    _get_paper_text()  # ensure paper is loaded

    if _rag_ready.get(CURRENT_PAPER_KEY):
        # RAG path: retrieve relevant chunks, answer from them
        chunks = await rag_service.retrieve(req.question)
        if chunks:
            context = "\n\n---\n\n".join([
                f"[Chunk {i+1} | relevance: {c['score']:.2f}]\n{c['text']}"
                for i, c in enumerate(chunks)
            ])
            prompt = (
                f"Relevant passages from the paper:\n\n{context}\n\n"
                f"---\nQuestion: {req.question}"
            )
            answer = await llm_service.generate(prompt, system=llm_service.RAG_QA_SYSTEM)
            return {"answer": answer, "rag": True, "chunks_used": len(chunks)}

    # Fallback: full text
    text = _get_paper_text()
    prompt = f"Paper text:\n{pdf_service.chunk_text(text)}\n\n---\nQuestion: {req.question}"
    answer = await llm_service.generate(prompt, system=llm_service.QA_SYSTEM)
    return {"answer": answer, "rag": False}


@app.post("/qa-selection")
async def qa_selection(req: SelectionQuestionRequest):
    context_block = f"\n\nSurrounding context:\n{req.context}" if req.context else ""
    prompt = (
        f"Selected text:\n\"{req.selected_text}\""
        f"{context_block}\n\nQuestion: {req.question}"
    )
    answer = await llm_service.generate(prompt, system=llm_service.SELECTION_QA_SYSTEM)
    return {"answer": answer}


@app.post("/recommend")
async def recommend(req: RecommendRequest):
    topics_str = ", ".join(req.topics) if req.topics else "not specified"
    prompt = (
        f"Paper Title: {req.title}\n\nAbstract: {req.abstract}\n\n"
        f"Key Topics: {topics_str}\n\nRecommend 5 highly relevant papers."
    )
    recommendations = await llm_service.generate(prompt, system=llm_service.RECOMMEND_SYSTEM)
    return {"recommendations": recommendations}


@app.post("/literature-survey")
async def literature_survey(req: SurveyRequest):
    papers_text = "\n\n".join([
        f"[{i+1}] {p.get('title', 'Unknown')}\nAbstract: {p.get('abstract', '')}\nSummary: {p.get('summary', '')}"
        for i, p in enumerate(req.papers)
    ])
    prompt = f"Topic: {req.topic}\n\nPapers:\n{papers_text}\n\nGenerate a literature survey."
    survey = await llm_service.generate(prompt, system=llm_service.SURVEY_SYSTEM)
    return {"survey": survey}


@app.post("/search-arxiv")
async def search_arxiv(req: SearchRequest):
    results = arxiv_service.search_papers(req.query, max_results=req.max_results)
    return {"results": results}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
