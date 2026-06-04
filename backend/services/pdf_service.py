"""
PDF Service — extract text from PDFs using PyMuPDF.
"""
import fitz  # PyMuPDF


def extract_text(pdf_bytes: bytes) -> str:
    """Extract full text from PDF bytes."""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    pages = []
    for page_num, page in enumerate(doc):
        text = page.get_text("text")
        pages.append(f"[Page {page_num + 1}]\n{text}")
    doc.close()
    return "\n\n".join(pages)


def extract_text_by_page(pdf_bytes: bytes) -> list[dict]:
    """Extract text per page with page numbers."""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    pages = []
    for page_num, page in enumerate(doc):
        text = page.get_text("text")
        pages.append({"page": page_num + 1, "text": text})
    doc.close()
    return pages


def get_page_count(pdf_bytes: bytes) -> int:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    count = doc.page_count
    doc.close()
    return count


def chunk_text(text: str, max_chars: int = 80000) -> str:
    """Truncate text to fit within LLM context window."""
    if len(text) <= max_chars:
        return text
    # Try to cut at a paragraph boundary
    truncated = text[:max_chars]
    last_para = truncated.rfind("\n\n")
    if last_para > max_chars * 0.8:
        truncated = truncated[:last_para]
    return truncated + "\n\n[... text truncated for length ...]"
