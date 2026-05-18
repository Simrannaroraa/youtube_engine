import os
import re
import time
import yaml
import uuid
from datetime import datetime
from dotenv import load_dotenv
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from youtube_transcript_api import YouTubeTranscriptApi
from groq import Groq
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_community.vectorstores import FAISS
load_dotenv()

groq_api_key = os.getenv("GROQ_API_KEY")
gemini_api_key = os.getenv("GEMINI_API_KEY")

# Load prompts from YAML
_yaml_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "prompts.yaml")
with open(_yaml_path, "r") as f:
    PROMPTS = yaml.safe_load(f)["prompts"]

# Cache for analysis results (video_id -> {summary, takeaways, topics, vector_store})
_analysis_cache = {}

# Cached LLM instance — initialized once on first call, reused for every request
_llm_instance = None


def get_video_id(url):
    regex = r"(?:v=|\/)([0-9A-Za-z_-]{11}).*"
    match = re.search(regex, url)
    if match:
        return match.group(1)
    return None


def get_transcript(video_url):
    try:
        video_id = get_video_id(video_url)
        if not video_id:
            raise ValueError("Could not extract Video ID. Check URL.")

        api = YouTubeTranscriptApi()

        # List available transcripts
        transcript_list = api.list(video_id)

        # Try to find English first (manual, then auto-generated), then any language
        transcript = None
        try:
            transcript = transcript_list.find_manually_created_transcript(['en', 'en-US', 'en-GB'])
        except Exception:
            try:
                transcript = transcript_list.find_generated_transcript(['en', 'en-US', 'en-GB'])
            except Exception:
                # Fall back to any available transcript
                for t in transcript_list:
                    transcript = t
                    break

        if transcript is None:
            raise Exception("This video does not have captions/subtitles. Please try another video that has captions enabled.")

        fetched = transcript.fetch()

        transcript_text = ""
        transcript_list_formatted = []

        for snippet in fetched:
            # Support both dict (old API) and object (new API) styles
            if isinstance(snippet, dict):
                text = snippet.get("text", "")
                start = snippet.get("start", 0)
                duration = snippet.get("duration", 0)
            else:
                text = getattr(snippet, "text", "")
                start = getattr(snippet, "start", 0)
                duration = getattr(snippet, "duration", 0)

            transcript_text += " " + text
            transcript_list_formatted.append({
                "text": text,
                "start": start,
                "duration": duration
            })

        return transcript_text.strip(), transcript_list_formatted

    except Exception as e:
        error_str = str(e)
        # Surface friendly messages for known errors
        if "429" in error_str or "Too Many Requests" in error_str:
            raise Exception("YouTube is temporarily rate-limiting this server. Please wait a few minutes and try again.")
        if "disabled" in error_str.lower() or "no transcript" in error_str.lower():
            raise Exception("This video does not have captions enabled. YouTube Transcript API requires videos to have captions/subtitles. Please try another video that has captions enabled.")
        raise Exception(f"An unexpected error occurred: {error_str}")




class GroqLLM:
    def __init__(self, model_name, temperature=0.3):
        self.client = Groq(api_key=groq_api_key)
        self.model_name = model_name
        self.temperature = temperature
    
    def invoke(self, text):
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
    global _llm_instance
    if _llm_instance is not None:
        return _llm_instance

    if not groq_api_key:
        raise ValueError("Groq API Key not found. Please create a .env file with GROQ_API_KEY.")
    
    models_to_try = [
        "llama-3.3-70b-versatile",
        "llama-3.1-70b-versatile",
        "mixtral-8x7b-32768",
        "llama-3-70b-8192"
    ]
    
    for model_name in models_to_try:
        try:
            llm = GroqLLM(model_name, temperature=0.3)
            llm.invoke("test")  # Validate model is accessible — runs ONCE at startup
            print(f"✓ Using Groq model: {model_name}")
            _llm_instance = llm
            return _llm_instance
        except Exception as model_error:
            print(f"✗ Model {model_name} failed: {model_error}")
            continue
    
    raise Exception("All Groq models failed. Please check your API key and try again.")


def generate_summary(text):
    llm = get_llm()
    limited_text = text[:8000]
    prompt_text = PROMPTS["summary"]["user"].format(text=limited_text)
    response = llm.invoke(prompt_text)
    return response.content


def generate_key_takeaways(text):
    llm = get_llm()
    limited_text = text[:8000]
    prompt_text = PROMPTS["key_takeaways"]["user"].format(text=limited_text)
    response = llm.invoke(prompt_text)
    return response.content


def generate_topics(transcript_list):
    formatted_transcript = ""
    for item in transcript_list[:150]:
        time_val = int(item['start'])
        minutes = time_val // 60
        seconds = time_val % 60
        timestamp = f"{minutes:02d}:{seconds:02d}"
        formatted_transcript += f"[{timestamp}] {item['text']}\n"
    
    formatted_transcript = formatted_transcript[:6000]
    
    llm = get_llm()
    prompt_text = PROMPTS["topics"]["user"].format(text=formatted_transcript)
    response = llm.invoke(prompt_text)
    return response.content


def create_vector_db(text):
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
    chunks = text_splitter.split_text(text)
    
    try:
        if not gemini_api_key:
            print("⚠️  Gemini API key not found. Using text-based retrieval instead.")
            return create_text_vector_db(text)
        
        # Use Google Embeddings (models/text-embedding-004)
        embeddings = GoogleGenerativeAIEmbeddings(model="models/text-embedding-004", google_api_key=gemini_api_key)
        
        # Create documents
        docs = [Document(page_content=chunk) for chunk in chunks]
        
        # Create FAISS vector store
        vector_store = FAISS.from_documents(docs, embeddings)
        print(f"✓ Created FAISS vector store with {len(chunks)} chunks using Google embeddings")
        return vector_store
    except Exception as e:
        print(f"Warning: FAISS creation failed ({e}), falling back to text-based retrieval")
        # Fallback to text-based retrieval if embeddings fail
        return create_text_vector_db(text)


def create_text_vector_db(text):
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
    chunks = text_splitter.split_text(text)
    
    print(f"Using text-based retrieval (fallback)")
    
    class SimpleTextVectorStore:
        def __init__(self, texts):
            self.texts = texts
        
        def as_retriever(self):
            return SimpleTextRetriever(self.texts)
    
    class SimpleTextRetriever:
        def __init__(self, texts):
            self.texts = texts
        
        def invoke(self, query_dict):
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
    llm = get_llm()  # Use Groq for Q&A
    retriever = vector_store.as_retriever()
    
    class QAChainWrapper:
        def __init__(self, llm_obj, retriever_obj):
            self.llm = llm_obj
            self.retriever = retriever_obj
        
        def run(self, question):
            docs = self.retriever.invoke({"question": question})
            context = "\n\n".join([doc.page_content for doc in docs]) if docs else "No relevant context found."
            
            prompt_text = PROMPTS["qa"]["user"].format(context=context, question=question)
            
            result = self.llm.invoke(prompt_text)
            return result.content if hasattr(result, 'content') else str(result)
    
    return QAChainWrapper(llm, retriever)


def analyze_in_parallel(video_url, transcript_text, transcript_list):
    
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
