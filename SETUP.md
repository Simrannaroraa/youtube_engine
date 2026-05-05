# YouTube Engine - Quick Start Guide

## Project Structure
```
pbl/
├── backend/           # FastAPI server
│   ├── main.py       # API endpoints
│   ├── utils.py      # Analysis logic
│   ├── chat_database.py  # Database manager
│   └── prompts.yaml  # LLM prompts
├── frontend/         # React + Vite app
│   ├── src/
│   ├── package.json
│   └── vite.config.js
├── .env              # API keys
├── requirements.txt  # Python dependencies
└── run.sh           # One-command startup script
```

## Quick Start (Recommended)

### One Command to Run Everything:
```bash
cd /Users/simran/Desktop/pbl
./run.sh
```

This script will:
- Create/activate virtual environment
- Install all dependencies
- Start backend on http://localhost:8000
- Start frontend on http://localhost:5173
- Open your browser automatically

Press `Ctrl+C` to stop both servers.

---

## Manual Setup (if needed)

### Backend Setup:
```bash
cd /Users/simran/Desktop/pbl

# Create virtual environment
python3 -m venv .venv

# Activate it
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start server
cd backend
python -m uvicorn main:app --reload --port 8000
```

### Frontend Setup (in new terminal):
```bash
cd /Users/simran/Desktop/pbl/frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

---

## Environment Setup

Make sure `.env` has:
```
GROQ_API_KEY=your_api_key_here
```

Get your key from: https://console.groq.com

---

## API Endpoints

- `POST /api/analyze` - Analyze YouTube video
- `GET /api/chats` - Get all chat history
- `GET /api/chats/{session_id}` - Get specific chat
- `POST /api/chats/{session_id}/qa` - Ask a question
- `PUT /api/chats/{session_id}/rename` - Rename chat
- `DELETE /api/chats/{session_id}` - Delete chat

---

## Troubleshooting

### Port Already in Use
```bash
# Kill process on port 8000
lsof -i :8000 | grep LISTEN | awk '{print $2}' | xargs kill -9

# Kill process on port 5173
lsof -i :5173 | grep LISTEN | awk '{print $2}' | xargs kill -9
```

### Missing Dependencies
```bash
# Backend
pip install -r requirements.txt

# Frontend
cd frontend
npm install
```

### Database Issues
```bash
# Delete and recreate database
rm chat_sessions.db
# Restart backend - it will auto-create new DB
```

---

## Project Info

- **Backend**: FastAPI + Python
- **Frontend**: React 18 + Vite + Tailwind
- **LLM**: Groq API (llama-3.3-70b-versatile)
- **Database**: SQLite

---

Happy analyzing! 🚀
