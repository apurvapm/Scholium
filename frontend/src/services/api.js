import axios from "axios";

const api = axios.create({ baseURL: "/api" });

export const uploadPDF = (file) => {
  const form = new FormData();
  form.append("file", file);
  return api.post("/upload", form, { headers: { "Content-Type": "multipart/form-data" } });
};

export const loadArxiv = (url_or_id) =>
  api.post("/load-arxiv", { url_or_id });

export const summarizePaper = () => api.post("/summarize");

export const askQuestion = (question) => api.post("/qa", { question });

export const askSelectionQuestion = (selected_text, question, context) =>
  api.post("/qa-selection", { selected_text, question, context });

export const getRecommendations = (title, abstract, topics = []) =>
  api.post("/recommend", { title, abstract, topics });

export const generateSurvey = (papers, topic) =>
  api.post("/literature-survey", { papers, topic });

export const searchArxiv = (query, max_results = 10) =>
  api.post("/search-arxiv", { query, max_results });

export const getPaperInfo = () => api.get("/paper-info");

export const getRagStatus = () => api.get("/rag-status");
