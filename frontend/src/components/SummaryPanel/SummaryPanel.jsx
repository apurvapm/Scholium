import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Sparkles, BookOpen, Users, Tag } from "lucide-react";
import { summarizePaper, getRecommendations } from "../../services/api";
import "./SummaryPanel.css";

export default function SummaryPanel({ paperMeta }) {
  const [summary, setSummary] = useState("");
  const [recommendations, setRecommendations] = useState("");
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingRec, setLoadingRec] = useState(false);
  const [tab, setTab] = useState("summary");
  const [error, setError] = useState("");

  const handleSummarize = async () => {
    setLoadingSummary(true);
    setError("");
    try {
      const res = await summarizePaper();
      setSummary(res.data.summary);
      setTab("summary");
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setLoadingSummary(false);
    }
  };

  const handleRecommend = async () => {
    if (!paperMeta) return;
    setLoadingRec(true);
    setError("");
    try {
      const res = await getRecommendations(
        paperMeta.title || "Unknown",
        paperMeta.abstract || "",
        paperMeta.categories || []
      );
      setRecommendations(res.data.recommendations);
      setTab("recommendations");
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setLoadingRec(false);
    }
  };

  return (
    <div className="summary-panel">
      <div className="summary-header">
        {paperMeta ? (
          <div className="paper-meta">
            <div className="paper-title">{paperMeta.title || paperMeta.filename}</div>
            {paperMeta.authors && (
              <div className="paper-authors">
                <Users size={11} />
                {paperMeta.authors.slice(0, 3).join(", ")}
                {paperMeta.authors.length > 3 ? ` +${paperMeta.authors.length - 3} more` : ""}
              </div>
            )}
            {paperMeta.published && (
              <div className="paper-date">{paperMeta.published}</div>
            )}
            {paperMeta.categories && (
              <div className="paper-tags">
                {paperMeta.categories.slice(0, 3).map((c) => (
                  <span key={c} className="tag"><Tag size={9} />{c}</span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="no-paper-note">Load a paper to see its details here.</div>
        )}
      </div>

      <div className="summary-actions">
        <button
          className="btn btn-primary btn-sm"
          onClick={handleSummarize}
          disabled={loadingSummary || !paperMeta}
        >
          {loadingSummary ? <span className="spinner" style={{width:14,height:14}} /> : <Sparkles size={13} />}
          Summarize
        </button>
        <button
          className="btn btn-ghost btn-sm"
          onClick={handleRecommend}
          disabled={loadingRec || !paperMeta}
        >
          {loadingRec ? <span className="spinner" style={{width:14,height:14}} /> : <BookOpen size={13} />}
          Related Papers
        </button>
      </div>

      {error && <div className="error-note">{error}</div>}

      {(summary || recommendations) && (
        <div className="summary-tabs">
          {summary && (
            <button
              className={`tab-btn ${tab === "summary" ? "active" : ""}`}
              onClick={() => setTab("summary")}
            >Summary</button>
          )}
          {recommendations && (
            <button
              className={`tab-btn ${tab === "recommendations" ? "active" : ""}`}
              onClick={() => setTab("recommendations")}
            >Related</button>
          )}
        </div>
      )}

      <div className="summary-body prose">
        {tab === "summary" && summary && (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{summary}</ReactMarkdown>
        )}
        {tab === "recommendations" && recommendations && (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{recommendations}</ReactMarkdown>
        )}
        {!summary && !recommendations && (
          <div className="empty-note">
            Click <strong>Summarize</strong> to get an AI summary of the paper.
          </div>
        )}
      </div>
    </div>
  );
}
