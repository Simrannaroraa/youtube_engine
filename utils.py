"""
Utility functions for YouTube video analysis.
Handles transcript extraction, LLM interactions, and data processing.
"""

import json
import os
import re
import subprocess
import time
from dotenv import load_dotenv
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from youtube_transcript_api import YouTubeTranscriptApi
from groq import Groq

load_dotenv()

groq_api_key = os.getenv("GROQ_API_KEY")

# Cache for analysis results (video_id -> {summary, takeaways, topics, vector_store})
_analysis_cache = {}


def validate_api_key():
    """Validate that Groq API key is configured."""
    if not groq_api_key:
        raise ValueError("Groq API Key not found. Please create a .env file with GROQ_API_KEY.")


def get_video_id(url):
    """
    Extracts the video ID from a YouTube URL.
    Supports standard youtube.com and youtu.be links.
    """
    regex = r"(?:v=|\/)([0-9A-Za-z_-]{11}).*"
    match = re.search(regex, url)
    if match:
        return match.group(1)
    return None


def get_transcript(video_url):
    """
    Extracts transcript from a YouTube video URL.
    Returns the transcript text or raises an exception.
    Uses the YouTubeTranscriptApi with updated API calls.
    """
    try:
        video_id = get_video_id(video_url)
        if not video_id:
            raise ValueError("Could not extract Video ID. Check URL.")

        # Create an instance of YouTubeTranscriptApi
        api = YouTubeTranscriptApi()
        
        # List all available transcripts using instance method
        transcript_data = None
        try:
            transcript_list = api.list(video_id)
            
            # Priority: Manual English -> Auto English -> Any Available Language
            transcript = None
            try:
                transcript = transcript_list.find_manually_created_transcript(['en'])
            except:
                try:
                    transcript = transcript_list.find_generated_transcript(['en'])
                except:
                    try:
                        transcript = transcript_list.find_generated_transcript(['en-US', 'en-GB'])
                    except:
                        # Get first available transcript (any language)
                        try:
                            transcript = transcript_list.find_generated_transcript()
                        except:
                            # If no generated, try first available
                            for t in transcript_list:
                                transcript = t
                                break
            
            if transcript is None:
                raise Exception("No transcripts found for this video")
            
            transcript_data = transcript.fetch()
            
        except Exception as e:
            error_msg = str(e).lower()
            
            # Check for IP blocking
            if "ipblocked" in error_msg or "your ip" in error_msg or "blocking requests" in error_msg:
                print("⚠️  YouTube IP Block Detected")
                print(f"Error: {e}")
                raise Exception(f"YouTube has temporarily blocked your IP due to too many requests. Please wait 30-60 minutes and try again. Alternatively, use a VPN to change your IP address.")
            
            # If list/find fails, try direct fetch with broader language support
            print(f"Transcript list method failed: {e}. Trying direct fetch with available languages...")
            try:
                time.sleep(2)
                transcript_data = api.fetch(video_id, languages=['en', 'en-US', 'en-GB', 'hi'])
            except Exception as e2:
                if "ipblocked" in str(e2).lower():
                    raise Exception(f"YouTube has temporarily blocked your IP. Please wait 30-60 minutes and try again.")
                try:
                    time.sleep(2)
                    transcript_data = api.fetch(video_id)
                except Exception as e3:
                    if "ipblocked" in str(e3).lower():
                        raise Exception(f"YouTube has temporarily blocked your IP. Please wait 30-60 minutes and try again.")
                    raise
        
        # Convert transcript snippets to list format and build text
        transcript_text = ""
        transcript_list_formatted = []
        
        for snippet in transcript_data:
            # Handle both dict and FetchedTranscriptSnippet object formats
            if isinstance(snippet, dict):
                text = snippet.get("text", "")
                start = snippet.get("start", 0)
                duration = snippet.get("duration", 0)
            else:
                # FetchedTranscriptSnippet object
                text = getattr(snippet, "text", "")
                start = getattr(snippet, "start", 0)
                duration = getattr(snippet, "duration", 0)
            
            transcript_text += " " + text
            transcript_list_formatted.append({
                "text": text,
                "start": start,
                "duration": duration
            })
            
        return transcript_text, transcript_list_formatted
        
    except Exception as e:
        error_msg = str(e)
        if "blocked your ip" in error_msg.lower():
            raise Exception(error_msg)
        raise Exception(f"Failed to fetch transcript: {e}. Please ensure the video has captions available.")


def list_available_models():
    """Lists available Groq models."""
    validate_api_key()
    models = [
        "llama-3.3-70b-versatile",
        "llama-3.2-90b-vision-preview",
        "mixtral-8x7b-32768-0405"
    ]
    return models


class GroqLLM:
    """Simple wrapper around Groq API compatible with LangChain interface."""
    def __init__(self, model_name, temperature=0.3):
        self.client = Groq(api_key=groq_api_key)
        self.model_name = model_name
        self.temperature = temperature
    
    def invoke(self, text):
        """Invoke the model with text input."""
        try:
            if isinstance(text, dict):
                text = text.get("text", "")
            
            message = self.client.chat.completions.create(
                model=self.model_name,
                messages=[{"role": "user", "content": text}],
                temperature=self.temperature,
                max_tokens=1000
            )
            
            class Response:
                def __init__(self, content):
                    self.content = content
            
            return Response(message.choices[0].message.content)
        except Exception as e:
            raise Exception(f"Groq API error: {e}")


def get_llm():
    """Returns a configured Groq model with fallback support."""
    validate_api_key()
    
    models_to_try = list_available_models()
    
    for model_name in models_to_try:
        try:
            llm = GroqLLM(model_name, temperature=0.3)
            test_response = llm.invoke("test")
            print(f"✓ Using model: {model_name}")
            return llm
        except Exception as model_error:
            print(f"✗ Model {model_name} failed: {model_error}")
            continue
    
    raise Exception(
        "⚠️  All Groq models are unavailable. Please check:\n"
        "1. Your Groq API key is valid\n"
        "2. Your internet connection is working\n"
        "3. Visit https://console.groq.com for status updates"
    )


def generate_summary(text):
    """Generates a concise executive summary."""
    llm = get_llm()
    limited_text = text[:8000]
    prompt_text = f"""Summarize this transcript in one paragraph. IMPORTANT: Always respond in ENGLISH ONLY, no matter what language the transcript is in.
{limited_text}"""
    response = llm.invoke(prompt_text)
    return response.content


def generate_key_takeaways(text):
    """Generates 5-7 key takeaways (Gold Nuggets)."""
    llm = get_llm()
    limited_text = text[:8000]
    prompt_text = f"""List 5-7 key insights as bullet points. IMPORTANT: Always respond in ENGLISH ONLY, no matter what language the transcript is in.
{limited_text}"""
    response = llm.invoke(prompt_text)
    return response.content


def generate_topics(transcript_list):
    """Generates topic segmentation from the raw transcript list (with timestamps)."""
    formatted_transcript = ""
    for item in transcript_list[:150]:
        time_val = int(item['start'])
        minutes = time_val // 60
        seconds = time_val % 60
        timestamp = f"{minutes:02d}:{seconds:02d}"
        formatted_transcript += f"[{timestamp}] {item['text']}\n"
    
    formatted_transcript = formatted_transcript[:6000]
    
    llm = get_llm()
    prompt_text = f"""List 5-8 topics with timestamps (MM:SS - Title). IMPORTANT: Always respond in ENGLISH ONLY, no matter what language the transcript is in.
{formatted_transcript}"""
    response = llm.invoke(prompt_text)
    return response.content


def create_vector_db(text):
    """Creates a mock text-based vector store for transcript retrieval."""
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
    chunks = text_splitter.split_text(text)
    
    print(f"Using text-based retrieval for QA functionality.")
    
    class SimpleTextVectorStore:
        def __init__(self, texts):
            self.texts = texts
        
        def as_retriever(self):
            return SimpleTextRetriever(self.texts)
    
    class SimpleTextRetriever:
        def __init__(self, texts):
            self.texts = texts
        
        def invoke(self, query_dict):
            """Retrieve relevant text chunks based on query."""
            if isinstance(query_dict, dict):
                question = query_dict.get("question", "")
            else:
                question = str(query_dict)
            
            query_words = [w.lower() for w in question.split() if len(w) > 2]
            relevant_docs = []
            
            for text in self.texts:
                score = sum(1 for word in query_words if word in text.lower())
                if score > 0 or len(query_words) == 0:
                    relevant_docs.append((score, text))
            
            relevant_docs.sort(reverse=True, key=lambda x: x[0])
            
            docs = [Document(page_content=text) for _, text in relevant_docs[:4]]
            
            if not docs:
                docs = [Document(page_content=text) for text in self.texts[:4]]
            
            return docs
    
    return SimpleTextVectorStore(chunks)


def get_qa_chain(vector_store):
    """Returns a QA chain for the vector store."""
    llm = get_llm()
    retriever = vector_store.as_retriever()
    
    class QAChainWrapper:
        def __init__(self, llm_obj, retriever_obj):
            self.llm = llm_obj
            self.retriever = retriever_obj
        
        def run(self, question):
            docs = self.retriever.invoke({"question": question})
            context = "\n\n".join([doc.page_content for doc in docs]) if docs else "No relevant context found."
            
            prompt_text = f"""You are a helpful assistant. Answer the question in depth  from the provided context. 
If the answer is not in the provided context, just say "answer is not available in the context", don't provide the wrong answer.
IMPORTANT: Always respond in English only, regardless of the language of the question.

Context:
{context}

Question:
{question}

Answer (in English):"""
            
            result = self.llm.invoke(prompt_text)
            return result.content if hasattr(result, 'content') else str(result)
    
    return QAChainWrapper(llm, retriever)


def analyze_in_parallel(video_url, transcript_text, transcript_list):
    """
    Executes all 4 analysis steps sequentially with delays to respect rate limits.
    Uses caching to avoid re-analyzing the same video.
    Returns: (summary, takeaways, topics, vector_store, is_cached)
    """
    video_id = get_video_id(video_url)
    
    # Check if cached
    if video_id in _analysis_cache:
        cached = _analysis_cache[video_id]
        return cached['summary'], cached['takeaways'], cached['topics'], cached['vector_store'], True
    
    # Run sequentially with delays to respect rate limits
    print("Running analysis sequentially to respect rate limits...")
    
    print("Generating summary...")
    summary = generate_summary(transcript_text)
    time.sleep(1)
    
    print("Extracting takeaways...")
    takeaways = generate_key_takeaways(transcript_text)
    time.sleep(1)
    
    print("Segmenting topics...")
    topics = generate_topics(transcript_list)
    time.sleep(1)
    
    print("Building knowledge base...")
    vector_store = create_vector_db(transcript_text)
    
    # Cache the results
    _analysis_cache[video_id] = {
        'summary': summary,
        'takeaways': takeaways,
        'topics': topics,
        'vector_store': vector_store
    }
    
    return summary, takeaways, topics, vector_store, False


def clear_analysis_cache():
    """Clears the analysis cache."""
    global _analysis_cache
    _analysis_cache = {}
