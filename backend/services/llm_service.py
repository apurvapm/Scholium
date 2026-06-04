"""
LLM Service — abstracts Gemini (google-genai) and OpenAI so they're swappable.
"""
import os
from dotenv import load_dotenv

load_dotenv()

LLM_PROVIDER = os.getenv("LLM_PROVIDER", "gemini")


async def generate(prompt: str, system: str = "") -> str:
    if LLM_PROVIDER == "gemini":
        return await _gemini_generate(prompt, system)
    else:
        return await _openai_generate(prompt, system)


async def _gemini_generate(prompt: str, system: str) -> str:
    import asyncio
    from google import genai

    client = genai.Client(api_key=os.environ["GOOGLE_API_KEY"])
    model_name = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
    full_prompt = f"{system}\n\n{prompt}" if system else prompt

    loop = asyncio.get_event_loop()
    response = await loop.run_in_executor(
        None,
        lambda: client.models.generate_content(model=model_name, contents=full_prompt),
    )
    return response.text or ""


async def _openai_generate(prompt: str, system: str) -> str:
    import asyncio
    from openai import OpenAI

    client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    model_name = os.getenv("OPENAI_MODEL", "gpt-4o")
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    loop = asyncio.get_event_loop()
    response = await loop.run_in_executor(
        None,
        lambda: client.chat.completions.create(model=model_name, messages=messages),
    )
    return response.choices[0].message.content


SUMMARIZE_SYSTEM = """You are an expert research paper analyst. Structure your response with:
## TL;DR
## Key Contributions
## Methodology
## Results
## Limitations"""

QA_SYSTEM = """You are a research assistant. Answer based ONLY on the paper text provided. Cite relevant sections."""

RAG_QA_SYSTEM = """You are a research assistant. You are given the most relevant passages from a research paper, retrieved by semantic search.
Answer the question using ONLY these passages. For each key claim, cite which chunk it came from (e.g. [Chunk 2]).
If the answer is not in the provided passages, say so clearly — do not guess.
Be concise and precise."""

SELECTION_QA_SYSTEM = """You are a research assistant. The user selected a passage and has a question. Be concise."""

RECOMMEND_SYSTEM = """Suggest 5 related papers. For each: Title, why it's relevant, key topics. Numbered list."""

SURVEY_SYSTEM = """Generate a literature survey with: introduction, thematic grouping, comparison of approaches, open problems."""