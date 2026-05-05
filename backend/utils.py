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
from chat_database import ChatDatabase

load_dotenv()

groq_api_key = os.getenv("GROQ_API_KEY")
gemini_api_key = os.getenv("GEMINI_API_KEY")

# Load prompts from YAML
with open("prompts.yaml", "r") as f:
    PROMPTS = yaml.safe_load(f)["prompts"]

# Initialize database
db = ChatDatabase()

# Cache for analysis results (video_id -> {summary, takeaways, topics, vector_store})
_analysis_cache = {}


def validate_api_key():
    if not groq_api_key:
        raise ValueError("Groq API Key not found. Please create a .env file with GROQ_API_KEY.")


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
        transcript_data = None
        
        # Try Method 1: Using fetch directly with language priority
        try:
            transcript_data = api.get_transcript(
                video_id,
                languages=['en', 'en-US', 'en-GB']
            )
        except Exception as e:
            print(f"English transcript not found, trying any available language...")
            try:
                # Try Method 2: Get any available transcript
                transcript_data = api.get_transcript(video_id)
            except Exception as e2:
                print(f"Direct fetch failed: {e2}. Trying list method...")
                try:
                    # Try Method 3: Use list() with priority
                    time.sleep(1)
                    transcript_list = api.list(video_id)
                    
                    # Try to find English first
                    transcript = None
                    try:
                        transcript = transcript_list.find_manually_created_transcript(['en'])
                    except:
                        try:
                            transcript = transcript_list.find_generated_transcript(['en'])
                        except:
                            # Get first available
                            for t in transcript_list:
                                transcript = t
                                break
                    
                    if transcript is None:
                        raise Exception("No transcripts available")
                    
                    transcript_data = transcript.fetch()
                except Exception as e3:
                    error_str = str(e3)
                    if "429" in error_str or "Too Many Requests" in error_str:
                        raise Exception("YouTube has temporarily blocked your IP. Please wait 24 hours or use a VPN.")
                    raise Exception(f"Failed to fetch transcript: {e3}. Please ensure the video has captions enabled.")
        
        transcript_text = ""
        transcript_list_formatted = []
        
        for snippet in transcript_data:
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
            
        return transcript_text, transcript_list_formatted
    
    except Exception as e:
        raise Exception(f"An unexpected error occurred: {str(e)}")

def list_available_models():
    validate_api_key()
    models = [
        "llama-3.3-70b-versatile",
        "llama-3.1-70b-versatile", 
        "mixtral-8x7b-32768",
        "llama-3-70b-8192"
    ]
    return models


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
    if not groq_api_key:
        raise ValueError("Groq API Key not found. Please create a .env file with GROQ_API_KEY.")
    
    models_to_try = list_available_models()
    
    for model_name in models_to_try:
        try:
            llm = GroqLLM(model_name, temperature=0.3)
            test_response = llm.invoke("test")
            print(f"✓ Using Groq model: {model_name}")
            return llm
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
