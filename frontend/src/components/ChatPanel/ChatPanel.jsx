import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Send, Trash2 } from "lucide-react";
import { askQuestion, getRagStatus } from "../../services/api";
import "./ChatPanel.css";

export default function ChatPanel() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [ragStatus, setRagStatus] = useState({ ready: false, chunks: 0 });
  const bottomRef = useRef(null);

  // Poll RAG status until ready
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await getRagStatus();
        setRagStatus(res.data);
        if (!res.data.ready) setTimeout(poll, 3000);
      } catch (_) {}
    };
    poll();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async () => {
    const q = input.trim();
    if (!q || loading) return;
    setMessages(prev => [...prev, { role: "user", content: q }]);
    setInput("");
    setLoading(true);
    try {
      const res = await askQuestion(q);
      setMessages(prev => [...prev, { role: "assistant", content: res.data.answer, rag: res.data.rag }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", content: `Error: ${err.response?.data?.detail || err.message}`, error: true }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <span>Q&amp;A</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
          {ragStatus.ready ? (
            <span className="rag-badge rag-ready" title={`RAG active — ${ragStatus.chunks} chunks indexed`}>
              ⚡ RAG · {ragStatus.chunks} chunks
            </span>
          ) : (
            <span className="rag-badge rag-indexing" title="Building semantic index…">
              ⏳ Indexing…
            </span>
          )}
          {messages.length > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={() => setMessages([])}>
              <Trash2 size={12} /> Clear
            </button>
          )}
        </div>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">Ask any question about the paper.</div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role} ${msg.error ? "error" : ""}`}>
            <div className="message-content prose">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
            </div>
            {msg.rag && <div className="rag-indicator">⚡ answered via RAG</div>}
          </div>
        ))}
        {loading && (
          <div className="message assistant">
            <div className="typing-indicator"><span /><span /><span /></div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-row">
        <textarea
          className="chat-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question about the paper…"
          rows={2}
        />
        <button className="send-btn" onClick={sendMessage} disabled={loading || !input.trim()}>
          <Send size={15} />
        </button>
      </div>
    </div>
  );
}
