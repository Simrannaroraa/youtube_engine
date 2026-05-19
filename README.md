# YT Insight Engine ⚡

A Full-Stack Retrieval-Augmented Generation (RAG) Application that transforms long-form YouTube videos into structured, searchable, and interactive intelligence in seconds.

![YT Insight Engine](https://img.shields.io/badge/Status-Active-brightgreen) ![React](https://img.shields.io/badge/Frontend-React-blue) ![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688) ![Groq](https://img.shields.io/badge/LLM-Groq-f54242)

## 🚀 Features

- **Executive Summary:** Instantly generates a precise, single-paragraph overview of the entire video.
- **Timestamp Chapters:** Automatically maps major topic shifts to exact MM:SS markers. Jump straight to the information you need.
- **Key Takeaways:** Extracts the top 5–7 actionable insights formatted as a scannable list.
- **RAG-Powered Chatbot:** Chat directly with the video. Every answer is mathematically grounded in the transcript using Vector Search (FAISS) to eliminate AI hallucinations.
- **Secure History:** Powered by Firebase Authentication, allowing you to securely log in and save your past analysis sessions.

## 🛠️ Tech Stack

### Frontend Architecture
- **React.js & Vite:** Extremely fast, modern Single Page Application (SPA).
- **Styling:** Custom CSS with a sleek, dynamic Cyberpunk glassmorphism aesthetic.
- **Auth:** Firebase Authentication (Stateless JWTs).

### Backend Architecture
- **FastAPI (Python):** Asynchronous, high-performance API server.
- **LLM Engine:** Groq API using `llama-3.3-70b-versatile` for blazing-fast inference (hundreds of tokens/sec).
- **Embeddings:** Google Generative AI (`models/text-embedding-004`).
- **Vector Database:** FAISS (Facebook AI Similarity Search) running in-memory for lightning-fast context retrieval.
- **Data Ingestion:** `youtube_transcript_api` with advanced fallback logic and proxy support to bypass rate limits.
- **Database:** SQLite (`chat_sessions.db`) for persistent storage of chat histories and metadata.

## ⚙️ Architecture & Data Flow

1. **Client Request:** User logs in via Firebase and submits a YouTube URL.
2. **Ingestion:** The FastAPI backend securely extracts the video transcript.
3. **Chunking & Vectorization:** The transcript is split into overlapping chunks and converted into high-dimensional vectors via Gemini Embeddings, then stored in FAISS.
4. **Generation:** Parallel tasks run to ask the Groq LLM for a summary, topics, and takeaways.
5. **Retrieval-Augmented Generation (RAG):** When the user asks a question, the backend embeds the query, performs a Cosine Similarity search on the FAISS DB, and feeds the relevant chunks into the LLM prompt to generate an accurate, hallucination-free response.

## 💻 Local Setup & Installation

### Prerequisites
- Node.js (v18+)
- Python (3.9+)
- API Keys: Firebase, Groq, Google Gemini

### 1. Backend Setup
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r ../requirements.txt
```

Create a `.env` file in the `backend/` directory:
```env
GROQ_API_KEY=your_groq_api_key
GEMINI_API_KEY=your_gemini_api_key
ALLOWED_ORIGINS=http://localhost:5173
FIREBASE_PROJECT_ID=yt-insight-engine
# Optional: Proxy for YouTube API
# WEBSHARE_PROXY_USERNAME=...
# WEBSHARE_PROXY_PASSWORD=...
```

Run the backend:
```bash
uvicorn main:app --reload --port 8000
```

### 2. Frontend Setup
```bash
cd frontend
npm install
```

Create a `.env.local` file in the `frontend/` directory:
```env
VITE_API_BASE=http://localhost:8000/api
```

Run the frontend:
```bash
npm run dev
```

## 🤝 Contributing
Contributions, issues, and feature requests are welcome!

## 📜 License
This project is licensed under the MIT License.
