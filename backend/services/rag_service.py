"""
RAG Service — chunk, embed, and retrieve relevant passages from a paper.

Pipeline:
  1. chunk_document()  — split PDF text into overlapping chunks
  2. build_index()     — embed all chunks using Google text-embedding-004
  3. retrieve()        — embed a query, return top-k most similar chunks

Uses a simple in-memory cosine similarity store (numpy only, no extra deps).
"""

import os
import asyncio
import numpy as np
from dotenv import load_dotenv

load_dotenv()

CHUNK_SIZE = 1500       # characters per chunk
CHUNK_OVERLAP = 200     # overlap between chunks
EMBED_MODEL = "text-embedding-004"
TOP_K = 5               # chunks returned per query


# ── In-memory vector store ───────────────────────────────────────────────────

class VectorStore:
    def __init__(self):
        self.chunks: list[str] = []
        self.embeddings: list[list[float]] = []

    def add(self, chunks: list[str], embeddings: list[list[float]]):
        self.chunks.extend(chunks)
        self.embeddings.extend(embeddings)

    def query(self, query_embedding: list[float], top_k: int = TOP_K) -> list[dict]:
        if not self.embeddings:
            return []
        q = np.array(query_embedding)
        matrix = np.array(self.embeddings)
        # Cosine similarity
        scores = matrix @ q / (np.linalg.norm(matrix, axis=1) * np.linalg.norm(q) + 1e-9)
        top_indices = np.argsort(scores)[-top_k:][::-1]
        return [
            {"text": self.chunks[i], "score": float(scores[i])}
            for i in top_indices
            if scores[i] > 0.1   # filter out very low similarity
        ]

    def clear(self):
        self.chunks = []
        self.embeddings = []

    @property
    def size(self) -> int:
        return len(self.chunks)


# Global store for the currently loaded paper
_store = VectorStore()


# ── Chunking ─────────────────────────────────────────────────────────────────

def chunk_document(text: str) -> list[str]:
    """Split text into overlapping chunks, preserving paragraph boundaries."""
    chunks = []
    start = 0
    while start < len(text):
        end = start + CHUNK_SIZE
        # Try to break at a paragraph or sentence boundary
        if end < len(text):
            para_break = text.rfind("\n\n", start, end)
            sent_break = text.rfind(". ", start, end)
            break_at = max(para_break, sent_break)
            if break_at > start + CHUNK_SIZE // 2:
                end = break_at + 1
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        start = end - CHUNK_OVERLAP
    return chunks


# ── Embedding ────────────────────────────────────────────────────────────────

async def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed a list of texts using Google text-embedding-004."""
    from google import genai

    client = genai.Client(api_key=os.environ["GOOGLE_API_KEY"])
    loop = asyncio.get_event_loop()

    # Embed in batches of 20 (API limit)
    all_embeddings = []
    batch_size = 20
    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        response = await loop.run_in_executor(
            None,
            lambda b=batch: client.models.embed_content(
                model=EMBED_MODEL,
                contents=b,
            ),
        )
        all_embeddings.extend([e.values for e in response.embeddings])

    return all_embeddings


async def embed_query(text: str) -> list[float]:
    """Embed a single query string."""
    embeddings = await embed_texts([text])
    return embeddings[0]


# ── Public API ───────────────────────────────────────────────────────────────

async def build_index(text: str) -> int:
    """Chunk and embed the full paper text. Returns number of chunks indexed."""
    _store.clear()
    chunks = chunk_document(text)
    if not chunks:
        return 0
    embeddings = await embed_texts(chunks)
    _store.add(chunks, embeddings)
    return _store.size


async def retrieve(query: str, top_k: int = TOP_K) -> list[dict]:
    """Find the most relevant chunks for a query."""
    if _store.size == 0:
        return []
    query_embedding = await embed_query(query)
    return _store.query(query_embedding, top_k=top_k)


def index_size() -> int:
    return _store.size
