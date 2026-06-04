import { useState } from "react";
import { Search, ExternalLink, Plus, Loader } from "lucide-react";
import { searchArxiv, loadArxiv } from "../../services/api";
import "./ArXivSearch.css";

export default function ArXivSearch({ onPaperLoaded }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingId, setLoadingId] = useState(null);
  const [error, setError] = useState("");
  const [arxivInput, setArxivInput] = useState("");

  const handleSearch = async (e) => {
    e?.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await searchArxiv(query, 8);
      setResults(res.data.results);
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadPaper = async (idOrUrl) => {
    setLoadingId(idOrUrl);
    setError("");
    try {
      const res = await loadArxiv(idOrUrl);
      onPaperLoaded?.(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setLoadingId(null);
    }
  };

  const handleArxivInput = async (e) => {
    e.preventDefault();
    if (!arxivInput.trim()) return;
    await handleLoadPaper(arxivInput.trim());
    setArxivInput("");
  };

  return (
    <div className="arxiv-search">
      {/* Direct URL/ID input */}
      <div className="section-label">Load from ArXiv</div>
      <form className="arxiv-input-row" onSubmit={handleArxivInput}>
        <input
          className="arxiv-input"
          placeholder="ArXiv URL or ID (e.g. 2303.08774)"
          value={arxivInput}
          onChange={(e) => setArxivInput(e.target.value)}
        />
        <button className="btn btn-primary btn-sm" type="submit" disabled={!!loadingId}>
          {loadingId === arxivInput ? <Loader size={13} className="spin" /> : "Load"}
        </button>
      </form>

      {/* Search */}
      <div className="section-label" style={{ marginTop: 14 }}>Search ArXiv</div>
      <form className="search-row" onSubmit={handleSearch}>
        <input
          className="search-input"
          placeholder="e.g. attention mechanism transformers"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="btn btn-primary btn-sm" type="submit" disabled={loading}>
          {loading ? <Loader size={13} className="spin" /> : <Search size={13} />}
        </button>
      </form>

      {error && <div className="search-error">{error}</div>}

      <div className="search-results">
        {results.map((paper) => (
          <div key={paper.id} className="result-card">
            <div className="result-title">{paper.title}</div>
            <div className="result-authors">
              {paper.authors.slice(0, 3).join(", ")}
              {paper.authors.length > 3 ? " et al." : ""}
            </div>
            <div className="result-abstract">{paper.abstract.slice(0, 180)}…</div>
            <div className="result-meta">
              <span className="result-date">{paper.published}</span>
              <div className="result-actions">
                <a
                  href={`https://arxiv.org/abs/${paper.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="icon-btn"
                  title="Open on ArXiv"
                >
                  <ExternalLink size={13} />
                </a>
                <button
                  className="icon-btn load-btn"
                  onClick={() => handleLoadPaper(paper.id)}
                  disabled={!!loadingId}
                  title="Load this paper"
                >
                  {loadingId === paper.id
                    ? <Loader size={13} className="spin" />
                    : <Plus size={13} />}
                </button>
              </div>
            </div>
          </div>
        ))}
        {results.length === 0 && !loading && (
          <div className="no-results">Search for papers to find related work.</div>
        )}
      </div>
    </div>
  );
}
