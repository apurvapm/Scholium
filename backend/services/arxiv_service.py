"""
ArXiv service — search, fetch metadata, download PDFs.
"""
import re
import httpx
import arxiv


def extract_arxiv_id(url_or_id: str) -> str:
    """Extract ArXiv ID from a URL or raw ID string."""
    # Patterns: 2401.12345, 2401.12345v2, abs/2401.12345, pdf/2401.12345
    patterns = [
        r"arxiv\.org/(?:abs|pdf)/([0-9]{4}\.[0-9]{4,5}(?:v\d+)?)",
        r"^([0-9]{4}\.[0-9]{4,5}(?:v\d+)?)$",
        r"arxiv:([0-9]{4}\.[0-9]{4,5}(?:v\d+)?)",
    ]
    for pattern in patterns:
        match = re.search(pattern, url_or_id.strip())
        if match:
            return match.group(1)
    raise ValueError(f"Could not extract ArXiv ID from: {url_or_id}")


def search_papers(query: str, max_results: int = 10) -> list[dict]:
    """Search ArXiv and return paper metadata."""
    client = arxiv.Client()
    search = arxiv.Search(
        query=query,
        max_results=max_results,
        sort_by=arxiv.SortCriterion.Relevance,
    )
    results = []
    for paper in client.results(search):
        results.append({
            "id": paper.entry_id.split("/")[-1],
            "title": paper.title,
            "authors": [a.name for a in paper.authors],
            "abstract": paper.summary,
            "published": paper.published.strftime("%Y-%m-%d") if paper.published else "",
            "pdf_url": paper.pdf_url,
            "categories": paper.categories,
        })
    return results


def get_paper_metadata(arxiv_id: str) -> dict:
    """Fetch metadata for a single paper by ID."""
    client = arxiv.Client()
    search = arxiv.Search(id_list=[arxiv_id])
    papers = list(client.results(search))
    if not papers:
        raise ValueError(f"Paper not found: {arxiv_id}")
    paper = papers[0]
    return {
        "id": arxiv_id,
        "title": paper.title,
        "authors": [a.name for a in paper.authors],
        "abstract": paper.summary,
        "published": paper.published.strftime("%Y-%m-%d") if paper.published else "",
        "pdf_url": paper.pdf_url,
        "categories": paper.categories,
    }


async def download_pdf(pdf_url: str) -> bytes:
    """Download PDF bytes from a URL."""
    async with httpx.AsyncClient(follow_redirects=True, timeout=60.0) as client:
        response = await client.get(pdf_url)
        response.raise_for_status()
        return response.content
