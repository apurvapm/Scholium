/**
 * App — three-column layout:
 *   LEFT  : ArXiv search + upload
 *   CENTER: PDF viewer + annotation toolbar
 *   RIGHT : tabbed panel (Summary | Chat | Annotations | Literature Survey)
 */
import { useState, useRef, useCallback } from "react";
import { Upload, Search, BookOpen, MessageSquare, Sparkles, List, FileText } from "lucide-react";

import PDFViewer from "./components/PDFViewer/PDFViewer";
import AnnotationToolbar from "./components/AnnotationToolbar/AnnotationToolbar";
import ChatPanel from "./components/ChatPanel/ChatPanel";
import SummaryPanel from "./components/SummaryPanel/SummaryPanel";
import ArXivSearch from "./components/ArXivSearch/ArXivSearch";
import LiteratureSurvey from "./components/LiteratureSurvey/LiteratureSurvey";

import { uploadPDF } from "./services/api";
import "./App.css";

const RIGHT_TABS = [
  { id: "summary",  label: "Summary",  icon: Sparkles },
  { id: "chat",     label: "Chat",     icon: MessageSquare },
  { id: "annots",   label: "Notes",    icon: List },
  { id: "survey",   label: "Survey",   icon: FileText },
];

const EMPTY_ANNOTATIONS = { highlights: [], drawings: [], comments: [], bookmarks: [] };

export default function App() {
  const [pdfBase64, setPdfBase64] = useState(null);
  const [paperMeta, setPaperMeta] = useState(null);
  const [activeTool, setActiveTool] = useState("select");
  const [annotations, setAnnotations] = useState(EMPTY_ANNOTATIONS);
  const [rightTab, setRightTab] = useState("summary");
  const [leftTab, setLeftTab] = useState("search");
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const pdfViewerRef = useRef(null);
  const fileInputRef = useRef(null);

  // ── Paper loading ─────────────────────────────────────────────────────────

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadLoading(true);
    setUploadError("");
    try {
      const res = await uploadPDF(file);
      setPdfBase64(res.data.pdf_base64);
      setPaperMeta({ filename: file.name, page_count: res.data.page_count, source: "upload" });
      setAnnotations(EMPTY_ANNOTATIONS);
      setRightTab("summary");
    } catch (err) {
      setUploadError(err.response?.data?.detail || err.message);
    } finally {
      setUploadLoading(false);
    }
  };

  const handleArxivLoaded = useCallback((data) => {
    setPdfBase64(data.pdf_base64);
    setPaperMeta(data.metadata);
    setAnnotations(EMPTY_ANNOTATIONS);
    setRightTab("summary");
  }, []);

  // ── Annotation changes ────────────────────────────────────────────────────

  const handleAnnotationsChange = useCallback((updater) => {
    setAnnotations((prev) => typeof updater === "function" ? updater(prev) : updater);
  }, []);

  const totalAnnotations =
    (annotations.comments?.length || 0) +
    (annotations.bookmarks?.length || 0);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="app">
      {/* ── Left sidebar ── */}
      <aside className="left-sidebar">
        <div className="sidebar-header">
          <div className="app-logo">📄 Scholium</div>
        </div>

        <div className="left-tabs">
          <button
            className={`left-tab ${leftTab === "search" ? "active" : ""}`}
            onClick={() => setLeftTab("search")}
          >
            <Search size={13} /> ArXiv
          </button>
          <button
            className={`left-tab ${leftTab === "upload" ? "active" : ""}`}
            onClick={() => setLeftTab("upload")}
          >
            <Upload size={13} /> Upload
          </button>
        </div>

        <div className="left-content">
          {leftTab === "search" && (
            <ArXivSearch onPaperLoaded={handleArxivLoaded} />
          )}

          {leftTab === "upload" && (
            <div className="upload-section">
              <div className="upload-zone" onClick={() => fileInputRef.current?.click()}>
                <Upload size={28} style={{ color: "var(--text-muted)" }} />
                <p>Click to upload PDF</p>
                <span>or drag & drop</span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                style={{ display: "none" }}
                onChange={handleUpload}
              />
              {uploadLoading && (
                <div className="upload-status">
                  <span className="spinner" style={{ width: 14, height: 14 }} /> Uploading…
                </div>
              )}
              {uploadError && <div className="upload-error">{uploadError}</div>}

              {paperMeta && (
                <div className="current-paper-badge">
                  <BookOpen size={12} />
                  <span>{paperMeta.title || paperMeta.filename}</span>
                  {paperMeta.page_count && <span className="pages">{paperMeta.page_count}p</span>}
                </div>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* ── Center: PDF Viewer ── */}
      <main className="center-col">
        <AnnotationToolbar
          activeTool={activeTool}
          onToolChange={setActiveTool}
          onDownload={() => pdfViewerRef.current?.downloadAnnotatedPDF()}
          onClearAll={() => setAnnotations(EMPTY_ANNOTATIONS)}
          annotationCount={totalAnnotations}
        />
        <div className="pdf-scroll">
          <PDFViewer
            ref={pdfViewerRef}
            pdfBase64={pdfBase64}
            activeTool={activeTool}
            annotations={annotations}
            onAnnotationsChange={handleAnnotationsChange}
          />
        </div>
      </main>

      {/* ── Right sidebar ── */}
      <aside className="right-sidebar">
        <div className="right-tabs">
          {RIGHT_TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`right-tab ${rightTab === id ? "active" : ""}`}
              onClick={() => setRightTab(id)}
            >
              <Icon size={13} />
              <span>{label}</span>
            </button>
          ))}
        </div>

        <div className="right-content">
          {rightTab === "summary" && (
            <SummaryPanel paperMeta={paperMeta} />
          )}
          {rightTab === "chat" && <ChatPanel />}
          {rightTab === "annots" && (
            <AnnotationsList
              annotations={annotations}
              onRemove={(type, id) => {
                setAnnotations((prev) => ({
                  ...prev,
                  [type]: prev[type].filter((a) => a.id !== id),
                }));
              }}
            />
          )}
          {rightTab === "survey" && (
            <LiteratureSurvey currentPaperMeta={paperMeta} />
          )}
        </div>
      </aside>
    </div>
  );
}

/** Inline annotations list panel — shows all highlights, comments, bookmarks */
function AnnotationsList({ annotations, onRemove }) {
  const all = [
    ...(annotations.highlights || []).map((h) => ({ ...h, type: "highlights", kind: "Highlight" })),
    ...(annotations.comments || []).map((c) => ({ ...c, type: "comments", kind: "Comment" })),
    ...(annotations.bookmarks || []).map((b) => ({ ...b, type: "bookmarks", kind: "Bookmark" })),
    ...(annotations.drawings || []).map((d) => ({ ...d, type: "drawings", kind: "Drawing" })),
  ];

  if (all.length === 0) {
    return (
      <div className="annot-empty">
        No annotations yet.<br />
        Use the toolbar to highlight, draw, comment, or add bookmarks.
      </div>
    );
  }

  return (
    <div className="annot-list">
      <div className="annot-count">{all.length} annotation{all.length !== 1 ? "s" : ""}</div>
      {all.map((a) => (
        <div key={a.id} className={`annot-item annot-${a.kind.toLowerCase()}`}>
          <div className="annot-header">
            <span className="annot-kind">{a.kind}</span>
            <span className="annot-page">p.{a.pageNum}</span>
            <button
              className="annot-remove"
              onClick={() => onRemove(a.type, a.id)}
              title="Remove"
            >✕</button>
          </div>
          {(a.text || a.label) && (
            <div className="annot-body">{a.text || a.label}</div>
          )}
        </div>
      ))}
    </div>
  );
}
