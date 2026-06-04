# PaperMind — Research Paper Assistant

A full-stack tool for reading, annotating, and analyzing research papers using Gemini Flash AI.

---

## Features

- **Upload PDF** or **load from ArXiv** (URL or ID)
- **ArXiv search** — find and load papers directly
- **AI Summary** — TL;DR, contributions, methodology, results, limitations
- **Q&A Chat** — ask anything about the paper
- **Text selection → Ask AI** — select any passage, get instant explanation
- **Annotations**:
  - Highlight text
  - Freehand drawing with color picker
  - Comments (click to place)
  - Bookmarks
- **Download annotated PDF** — highlights, drawings, comments embedded; summary page appended
- **Paper Recommendations** — 5 related papers
- **Literature Survey** — add multiple papers and generate a survey section

---

## Project Structure

```
research-paper-assistant/
├── backend/                  # FastAPI Python server
│   ├── main.py
│   ├── requirements.txt
│   ├── .env.example
│   └── services/
│       ├── llm_service.py    # Gemini Flash (swappable to OpenAI)
│       ├── arxiv_service.py  # ArXiv search + download
│       └── pdf_service.py    # PDF text extraction
└── frontend/                 # React + Vite
    ├── package.json
    └── src/
        ├── App.jsx           # Main shell (3-column layout)
        ├── components/
        │   ├── PDFViewer/    # pdf.js + fabric.js annotation canvas
        │   ├── AnnotationToolbar/
        │   ├── ChatPanel/    # Q&A + text selection chat
        │   ├── SummaryPanel/ # Summary + recommendations
        │   ├── ArXivSearch/  # Search + load papers
        │   └── LiteratureSurvey/
        └── services/api.js   # API calls to backend
```

---

## Setup

### 1. Get a Gemini API Key

Go to https://aistudio.google.com/app/apikey and create a free key.

### 2. Backend

```bash
cd backend

# Copy and fill in your API key
cp .env.example .env
# Edit .env: set GOOGLE_API_KEY=your_key_here

# Install dependencies (Python 3.10+)
pip install -r requirements.txt

# Run the server
uvicorn main:app --reload --port 8000
```

Backend will be available at http://localhost:8000

### 3. Frontend

```bash
cd frontend

# Install dependencies (Node 18+)
npm install

# Start dev server
npm run dev
```

Open http://localhost:5173

---

## Switching to OpenAI Later

1. In `backend/.env`:
   ```
   LLM_PROVIDER=openai
   OPENAI_API_KEY=your_openai_key
   OPENAI_MODEL=gpt-4o
   ```
2. Install: `pip install openai`
3. Restart the backend. No frontend changes needed.

---

## How to Use

| Task | How |
|------|-----|
| Load paper | Upload PDF in left sidebar, or paste ArXiv URL/ID |
| Search papers | Left sidebar → ArXiv tab → type query |
| Summarize | Right panel → Summary tab → click Summarize |
| Ask a question | Right panel → Chat tab → type question |
| Ask about selected text | Select text in PDF → click "Ask AI" popup |
| Highlight | Select text → click "Highlight" popup |
| Draw | Toolbar → Draw tool → pick color → draw on PDF |
| Add comment | Toolbar → Comment tool → click anywhere on page |
| Bookmark a page | Toolbar → Bookmark tool → click on page |
| View all annotations | Right panel → Notes tab |
| Download annotated PDF | Toolbar → "Save PDF" button |
| Get related papers | Right panel → Summary tab → click "Related Papers" |
| Literature survey | Right panel → Survey tab → add papers → Generate |
