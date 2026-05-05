from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from utils import (
    get_video_id, get_transcript, analyze_in_parallel, 
    create_vector_db, get_qa_chain, _analysis_cache
)
import uuid
import time
import json
from datetime import datetime
from chat_database import ChatDatabase

app = FastAPI(title="YT Insight Engine API")

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

db = ChatDatabase()

# Request Models
class AnalyzeRequest(BaseModel):
    video_url: str

class RenameRequest(BaseModel):
    new_name: str

class QARequest(BaseModel):
    session_id: str
    video_url: str
    question: str

@app.post("/api/analyze")
def analyze_video(req: AnalyzeRequest):
    if not req.video_url:
        raise HTTPException(status_code=400, detail="Video URL is required")
    
    try:
        session_id = str(uuid.uuid4())
        start_time = time.time()
        
        video_id = get_video_id(req.video_url)
        if not video_id:
            raise HTTPException(status_code=400, detail="Invalid YouTube URL")

        # Extract transcript first
        transcript_text, transcript_list = get_transcript(req.video_url)
        
        # Analyze
        analysis_start = time.time()
        summary, takeaways, topics, vector_store, is_cached = analyze_in_parallel(
            req.video_url, transcript_text, transcript_list
        )
        analysis_time = time.time() - analysis_start
        total_time = time.time() - start_time

        # Save to DB
        chat_name = f"Analysis - {datetime.now().strftime('%b %d, %H:%M')}"
        db.save_chat(
            session_id=session_id,
            video_id=video_id,
            video_url=req.video_url,
            chat_name=chat_name,
            summary=summary,
            takeaways=takeaways,
            topics=topics,
            analysis_time=total_time
        )

        return {
            "session_id": session_id,
            "video_url": req.video_url,
            "summary": summary,
            "takeaways": takeaways,
            "topics": topics,
            "is_cached": is_cached,
            "total_time": total_time
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        import traceback
        print(f"ERROR in /api/analyze: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/chats")
def get_all_chats():
    chats = db.get_all_chats()
    result = []
    for chat in chats:
        session_id, video_id, video_url, chat_name, created_at, summary, takeaways, topics, analysis_time = chat
        result.append({
            "session_id": session_id,
            "video_id": video_id,
            "video_url": video_url,
            "chat_name": chat_name,
            "created_at": created_at
        })
    return result

@app.get("/api/chats/{session_id}")
def get_chat(session_id: str):
    chat = db.get_chat_by_id(session_id)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    session_id, video_id, video_url, chat_name, created_at, summary, takeaways, topics, analysis_time = chat
    
    takeaways_parsed = takeaways if takeaways else ""
    topics_parsed = topics if topics else ""

    qa_list = db.get_chat_qa(session_id)
    messages = []
    for question, answer, timestamp in qa_list:
        messages.append({"role": "user", "content": question})
        messages.append({"role": "assistant", "content": answer})

    return {
        "session_id": session_id,
        "video_id": video_id,
        "video_url": video_url,
        "chat_name": chat_name,
        "created_at": created_at,
        "summary": summary,
        "takeaways": takeaways_parsed,
        "topics": topics_parsed,
        "analysis_time": analysis_time,
        "messages": messages
    }

@app.delete("/api/chats/{session_id}")
def delete_chat(session_id: str):
    success = db.delete_chat(session_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete chat")
    return {"status": "success"}

@app.put("/api/chats/{session_id}/rename")
def rename_chat(session_id: str, req: RenameRequest):
    success = db.rename_chat(session_id, req.new_name)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to rename chat")
    return {"status": "success", "new_name": req.new_name}

@app.post("/api/qa")
def ask_question(req: QARequest):
    try:
        video_id = get_video_id(req.video_url)
        if not video_id:
             raise HTTPException(status_code=400, detail="Invalid YouTube URL")

        # Get vector store from cache or recreate it
        vector_store = None
        if video_id in _analysis_cache:
            vector_store = _analysis_cache[video_id].get("vector_store")
        
        if not vector_store:
            # Recreate vector store if not in cache
            transcript_text, _ = get_transcript(req.video_url)
            vector_store = create_vector_db(transcript_text)
            # Store in cache to avoid recreating
            if video_id not in _analysis_cache:
                _analysis_cache[video_id] = {}
            _analysis_cache[video_id]["vector_store"] = vector_store

        qa_chain = get_qa_chain(vector_store)
        response = qa_chain.run(req.question)

        db.add_qa(req.session_id, req.question, response)

        return {"answer": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
if __name__ == "__main__":
    main()