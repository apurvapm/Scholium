import { MessageSquare, Bookmark, MousePointer, Download, Trash2 } from "lucide-react";
import "./AnnotationToolbar.css";

const TOOLS = [
  { id: "select",   icon: MousePointer,  label: "Select / Ask AI (select text)" },
  { id: "comment",  icon: MessageSquare, label: "Add Comment" },
  { id: "bookmark", icon: Bookmark,      label: "Add Bookmark" },
];

export default function AnnotationToolbar({
  activeTool,
  onToolChange,
  onDownload,
  onClearAll,
  annotationCount,
}) {
  return (
    <div className="annotation-toolbar">
      <div className="toolbar-section">
        <span className="toolbar-label">Tools</span>
        <div className="tool-buttons">
          {TOOLS.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              className={`tool-btn ${activeTool === id ? "active" : ""}`}
              onClick={() => onToolChange(id)}
              title={label}
            >
              <Icon size={16} />
            </button>
          ))}
        </div>
      </div>

      <div className="toolbar-spacer" />

      <div className="toolbar-section toolbar-right">
        {annotationCount > 0 && (
          <button className="tool-btn danger" onClick={onClearAll} title="Clear all annotations">
            <Trash2 size={15} />
          </button>
        )}
        <button className="tool-btn download-btn" onClick={onDownload} title="Download annotated PDF">
          <Download size={15} />
          <span>Save PDF</span>
        </button>
      </div>
    </div>
  );
}
