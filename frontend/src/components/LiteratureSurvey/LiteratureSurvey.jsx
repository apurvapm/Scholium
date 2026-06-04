/**
 * Literature Survey — accumulate papers (from ArXiv search or loaded paper)
 * and generate a coherent survey section.
 */
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Plus, Trash2, FileText, Loader, Copy } from "lucide-react";
import { generateSurvey } from "../../services/api";
import "./LiteratureSurvey.css";

export default function LiteratureSurvey({ currentPaperMeta }) {
  const [papers, setPapers] = useState([]);
  const [topic, setTopic] = useState("");
  const [survey, setSurvey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  // Add current paper to the survey pool
  const addCurrentPaper = () => {
    if (!currentPaperMeta) return;
    const exists = papers.find((p) => p.title === currentPaperMeta.title);
    if (exists) return;
    setPapers((prev) => [...prev, {
      title: currentPaperMeta.title || "Untitled",
      abstract: currentPaperMeta.abstract || "",
      summary: "",
    }]);
  };

  const removePaper = (idx) => {
    setPapers((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleGenerate = async () => {
    if (papers.length === 0) return;
    setLoading(true);
    setError("");
    try {
      const res = await generateSurvey(papers, topic || "AI and Machine Learning");
      setSurvey(res.data.survey);
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(survey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="lit-survey">
      <div className="survey-top">
        <div className="section-label">Papers in survey pool</div>

        <div className="survey-controls">
          <input
            className="topic-input"
            placeholder="Survey topic (e.g. 'Attention mechanisms in NLP')"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
          <div className="survey-btns">
            {currentPaperMeta && (
              <button className="btn btn-ghost btn-sm" onClick={addCurrentPaper} title="Add loaded paper">
                <Plus size={13} /> Add current paper
              </button>
            )}
            <button
              className="btn btn-primary btn-sm"
              onClick={handleGenerate}
              disabled={loading || papers.length === 0}
            >
              {loading ? <Loader size={13} className="spin" /> : <FileText size={13} />}
              Generate Survey
            </button>
          </div>
        </div>

        {papers.length === 0 ? (
          <div className="empty-pool">
            Add papers to generate a literature survey.<br/>
            Load a paper and click "Add current paper", or add papers manually.
          </div>
        ) : (
          <div className="paper-pool">
            {papers.map((p, i) => (
              <div key={i} className="pool-item">
                <span className="pool-title">{p.title}</span>
                <button className="remove-btn" onClick={() => removePaper(i)}>
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && <div className="survey-error">{error}</div>}

      {survey && (
        <div className="survey-output">
          <div className="survey-output-header">
            <span>Generated Survey</span>
            <button className="btn btn-ghost btn-sm" onClick={handleCopy}>
              <Copy size={12} /> {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <div className="survey-text prose">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{survey}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
