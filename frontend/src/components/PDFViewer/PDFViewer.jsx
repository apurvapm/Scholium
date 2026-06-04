import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { Bookmark, MessageSquare } from "lucide-react";
import "./PDFViewer.css";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url
).href;

const SCALE = 1.5;
let _id = 0;
const uid = () => `ann_${++_id}_${Date.now()}`;

const PDFViewer = forwardRef(function PDFViewer(
  { pdfBase64, activeTool, annotations, onAnnotationsChange },
  ref
) {
  const containerRef = useRef(null);
  const pdfDocRef = useRef(null);
  const activeToolRef = useRef(activeTool);
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [commentDialog, setCommentDialog] = useState(null);
  const [commentText, setCommentText] = useState("");
  const [bookmarkDialog, setBookmarkDialog] = useState(null);
  const [bookmarkLabel, setBookmarkLabel] = useState("");

  useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);

  useImperativeHandle(ref, () => ({ downloadAnnotatedPDF: handleDownload }));

  // Load PDF
  useEffect(() => {
    if (!pdfBase64) return;
    setLoading(true);
    const bytes = Uint8Array.from(atob(pdfBase64), c => c.charCodeAt(0));
    pdfjsLib.getDocument({ data: bytes }).promise.then(doc => {
      pdfDocRef.current = doc;
      setNumPages(doc.numPages);
      setLoading(false);
    }).catch(err => { console.error(err); setLoading(false); });
  }, [pdfBase64]);

  // Render pages
  useEffect(() => {
    if (!numPages || !pdfDocRef.current) return;
    Array.from({ length: numPages }, (_, i) => i + 1).forEach(renderPage);
  }, [numPages]);

  const renderPage = useCallback(async (pageNum) => {
    const doc = pdfDocRef.current;
    if (!doc) return;
    const page = await doc.getPage(pageNum);
    const vp = page.getViewport({ scale: SCALE });

    const pdfCanvas = document.getElementById(`pdf-canvas-${pageNum}`);
    if (!pdfCanvas) return;
    pdfCanvas.width = vp.width;
    pdfCanvas.height = vp.height;
    await page.render({ canvasContext: pdfCanvas.getContext("2d"), viewport: vp }).promise;
  }, []);

  // Click on page — comment + bookmark
  const handlePageClick = useCallback((e, pageNum) => {
    const tool = activeToolRef.current;
    if (tool !== "comment" && tool !== "bookmark") return;
    const inner = document.getElementById(`page-container-${pageNum}`)?.querySelector("div[style]");
    const rect = (inner || e.currentTarget).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (tool === "comment") { setCommentDialog({ pageNum, x, y }); setCommentText(""); }
    if (tool === "bookmark") { setBookmarkDialog({ pageNum }); setBookmarkLabel(`Page ${pageNum}`); }
  }, []);

  const addComment = () => {
    if (!commentDialog) return;
    onAnnotationsChange(prev => ({ ...prev, comments: [...(prev.comments || []), { id: uid(), ...commentDialog, text: commentText }] }));
    setCommentDialog(null); setCommentText("");
  };

  const addBookmark = () => {
    if (!bookmarkDialog) return;
    onAnnotationsChange(prev => ({ ...prev, bookmarks: [...(prev.bookmarks || []), { id: uid(), pageNum: bookmarkDialog.pageNum, label: bookmarkLabel }] }));
    setBookmarkDialog(null); setBookmarkLabel("");
  };

  const handleDownload = async () => {
    if (!pdfBase64) return;
    const bytes = Uint8Array.from(atob(pdfBase64), c => c.charCodeAt(0));
    const pdfDoc = await PDFDocument.load(bytes);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const pages = pdfDoc.getPages();

    const all = [
      ...(annotations.comments || []).map(c => `[Comment p${c.pageNum}]: ${c.text}`),
      ...(annotations.bookmarks || []).map(b => `[Bookmark p${b.pageNum}]: ${b.label}`),
    ];
    if (all.length) {
      const sp = pdfDoc.addPage();
      const { height } = sp.getSize();
      sp.drawText("Annotations Summary", { x: 40, y: height - 50, size: 16, font, color: rgb(0.4, 0.4, 0.9) });
      let y = height - 80;
      all.forEach(line => {
        if (y > 40) { sp.drawText(line.slice(0, 100), { x: 40, y, size: 9, font, color: rgb(0.2, 0.2, 0.2) }); y -= 16; }
      });
    }
    (annotations.comments || []).forEach(c => {
      const p = pages[c.pageNum - 1]; if (!p) return;
      const { height } = p.getSize();
      p.drawCircle({ x: c.x / SCALE, y: height - c.y / SCALE, size: 8, color: rgb(0.96, 0.62, 0.04) });
    });

    const blob = new Blob([await pdfDoc.save()], { type: "application/pdf" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "annotated_paper.pdf";
    a.click();
  };

  if (!pdfBase64) return <div className="pdf-empty"><p>Upload a PDF or enter an ArXiv URL.</p></div>;
  if (loading) return <div className="pdf-empty"><div className="spinner" /><p style={{ marginTop: 12 }}>Loading PDF…</p></div>;

  return (
    <div className="pdf-viewer-root" ref={containerRef}>
      {Array.from({ length: numPages }, (_, i) => i + 1).map(pageNum => (
        <div
          key={pageNum}
          className="page-wrapper"
          id={`page-container-${pageNum}`}
          onClick={e => handlePageClick(e, pageNum)}
          style={{
            cursor: activeTool === "comment" ? "crosshair"
              : activeTool === "bookmark" ? "pointer"
              : "default"
          }}
        >
          <div className="page-number-badge">Page {pageNum}</div>
          <div style={{ position: "relative", display: "inline-block" }}>
            <canvas id={`pdf-canvas-${pageNum}`} className="pdf-canvas" />
            {(annotations.comments || []).filter(c => c.pageNum === pageNum).map(c => (
              <div key={c.id} className="comment-marker" style={{ left: c.x - 10, top: c.y - 10 }} title={c.text}>✎</div>
            ))}
            {(annotations.bookmarks || []).some(b => b.pageNum === pageNum) && (
              <div className="bookmark-marker">🔖</div>
            )}
          </div>
        </div>
      ))}

      {commentDialog && (
        <div className="annotation-dialog">
          <div className="dialog-header"><MessageSquare size={14} /> Add Comment — Page {commentDialog.pageNum}</div>
          <textarea className="dialog-textarea" placeholder="Type your comment…" value={commentText}
            onChange={e => setCommentText(e.target.value)} autoFocus rows={4} />
          <div className="dialog-actions">
            <button className="btn btn-primary btn-sm" onClick={addComment}>Save</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setCommentDialog(null)}>Cancel</button>
          </div>
        </div>
      )}

      {bookmarkDialog && (
        <div className="annotation-dialog">
          <div className="dialog-header"><Bookmark size={14} /> Add Bookmark — Page {bookmarkDialog.pageNum}</div>
          <input className="dialog-input" placeholder="Bookmark label…" value={bookmarkLabel}
            onChange={e => setBookmarkLabel(e.target.value)} autoFocus />
          <div className="dialog-actions">
            <button className="btn btn-primary btn-sm" onClick={addBookmark}>Save</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setBookmarkDialog(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
});

export default PDFViewer;
